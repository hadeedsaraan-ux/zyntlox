import { NextRequest, NextResponse } from "next/server";
import { callGeminiWithRetry, usedBackupModel } from "../../lib/gemini";
import { fetchSiteData, ExtractedSiteData } from "../../lib/siteData";
import { createProgressStream } from "../../lib/progress";
import { computeSeoAudit } from "../../lib/seoAudit";
import { computeContentChecks } from "../../lib/contentChecks";
import { computeOverallScore, parseAssessments, scoreOf } from "../../lib/scoring";
import { criterionDef, criterionLabel, criterionWeight } from "../../lib/criteria";
import { buildRoastParts, buildProseParts } from "../../lib/prompts";
import { hostOf, logEvent } from "../../lib/log";
import { Report, RawScrapeData, Problem, ActionItem } from "../../lib/types";

// The prose call's JSON mode guarantees syntactically valid JSON, not schema conformance —
// an occasional item comes back with a null/missing text field. Drop those rather than
// shipping a blank card to the report.
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function isValidProblem(p: unknown): p is Problem {
  return !!p && typeof p === "object" && isNonEmptyString((p as Problem).issue);
}
function isValidActionItem(a: unknown): a is ActionItem {
  return !!a && typeof a === "object" && isNonEmptyString((a as ActionItem).text);
}

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const { stream, sendStage, sendResult, sendError } = createProgressStream<{
    report: Report;
    rawData: ExtractedSiteData;
    rawScrape: RawScrapeData;
  }>();

  (async () => {
    const requestStartedAt = Date.now();
    const host = hostOf(url);

    try {
      const siteData = await fetchSiteData(url, sendStage);
      if (!siteData.ok) {
        logEvent("roast.failed", {
          stage: "fetch",
          host,
          error: siteData.error,
          elapsedMs: Date.now() - requestStartedAt,
        });
        sendError(siteData.error);
        return;
      }

      const { extractedData, screenshotBase64, markdown, fullMarkdown, timings } = siteData;
      const seoChecks = computeSeoAudit(extractedData);

      // The code tier: criteria answered deterministically rather than by the model.
      // Runs on the UNCAPPED markdown — footer links are what the prompt cap truncates.
      // siteUrl is passed so externalLinkBalance can compare hostnames instead of just
      // checking whether a link is an absolute URL — see contentChecks.ts.
      const contentChecks = computeContentChecks(fullMarkdown, {
        siteUrl: url,
        domLinks: extractedData.domLinks,
        structuredAddress: extractedData.structuredAddress,
        commerceSignals: extractedData.commerceSignals,
      });

      // Prompt construction lives in lib/prompts.ts so the diagnostics harness can
      // replay the exact prompt production sends, rather than a copy that can drift.
      const parts = buildRoastParts({ extractedData, seoChecks, screenshotBase64, markdown });

      let geminiData;
      let modelUsed;
      let geminiAttempts = 0;
      let geminiMs = 0;
      try {
        const res = await callGeminiWithRetry(parts, sendStage, { jsonMode: true });
        geminiData = res.data;
        modelUsed = res.modelUsed;
        geminiAttempts = res.attempts;
        geminiMs = res.latencyMs;
      } catch (err) {
        console.error("Gemini failed after all retries/fallbacks:", err);
        logEvent("roast.failed", {
          stage: "gemini",
          host,
          error: err instanceof Error ? err.message : String(err),
          elapsedMs: Date.now() - requestStartedAt,
        });
        sendError("AI analysis failed. Please try again in a moment.");
        return;
      }

      let aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();

      let aiReport;
      try {
        aiReport = JSON.parse(aiText);
      } catch (err) {
        console.error("Gemini returned malformed JSON:", err);
        logEvent("roast.failed", {
          stage: "parse",
          host,
          modelUsed,
          error: err instanceof Error ? err.message : String(err),
          elapsedMs: Date.now() - requestStartedAt,
        });
        sendError("The AI returned an unreadable response. Please try again.");
        return;
      }

      // The model answers the AI tier; contentChecks supplies the code tier. Individual
      // missing answers become "unclear" and drop out of scoring rather than failing the
      // whole report — at ~45 criteria a single absent key is likely, and trading a small
      // inaccuracy for a total outage would be the wrong call. parseAssessments still
      // returns null when a category is too sparse to score honestly.
      const assessments = parseAssessments(aiReport, contentChecks);
      if (!assessments) {
        console.error("Gemini response missing valid criterion ratings:", {
          design: aiReport.design,
          trust: aiReport.trust,
          ux: aiReport.ux,
        });
        logEvent("roast.failed", {
          stage: "criteria",
          host,
          modelUsed,
          elapsedMs: Date.now() - requestStartedAt,
        });
        sendError("The AI returned an incomplete analysis. Please try again.");
        return;
      }

      const designScore = scoreOf(assessments, "design");
      const trustScore = scoreOf(assessments, "trust");
      const uxScore = scoreOf(assessments, "ux");
      const overallScore = computeOverallScore(
        designScore,
        trustScore,
        uxScore,
        seoChecks.seoScore
      );

      // Second call: the written sections. Split out because when criteria and prose
      // shared one response the prose lost — every model returned one or two items per
      // section instead of three to five. This call sees the failed criteria, so the
      // advice is grounded in real findings rather than improvised.
      sendStage({ id: "gemini", label: "Writing up what to fix…" });
      const rated = assessments.flatMap((a) => a.criteria);
      const byWeight = (a: { id: string }, b: { id: string }) => {
        const da = criterionDef(a.id);
        const db = criterionDef(b.id);
        return (db ? criterionWeight(db) : 1) - (da ? criterionWeight(da) : 1);
      };
      const labelOf = (c: { id: string; evidence: string }) =>
        c.evidence ? `${criterionLabel(c.id, "technical")} — ${c.evidence}` : criterionLabel(c.id, "technical");

      let prose: Record<string, unknown> = {};
      try {
        const res = await callGeminiWithRetry(
          buildProseParts({
            url,
            designScore,
            trustScore,
            uxScore,
            seoScore: seoChecks.seoScore,
            overallScore,
            detectedStack: extractedData.detectedStack,
            failed: rated.filter((c) => c.rating === "no").sort(byWeight).map(labelOf),
            met: rated.filter((c) => c.rating === "yes").sort(byWeight).map((c) => criterionLabel(c.id, "technical")),
          }),
          sendStage,
          { jsonMode: true }
        );
        const raw = res.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        prose = JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim());
      } catch (err) {
        // The scores and the full criteria breakdown are already complete and correct.
        // Losing the write-up should cost those sections, never the whole report.
        console.error("Prose call failed; returning the report without written sections:", err);
      }

      const report: Report = {
        ...aiReport,
        biggestProblems: Array.isArray(prose.biggestProblems)
          ? prose.biggestProblems.filter(isValidProblem)
          : [],
        quickWins: Array.isArray(prose.quickWins) ? prose.quickWins.filter(isValidActionItem) : [],
        suggestions: Array.isArray(prose.suggestions)
          ? prose.suggestions.filter(isValidActionItem)
          : [],
        designScore,
        trustScore,
        uxScore,
        seoScore: seoChecks.seoScore,
        seoChecks,
        assessments,
        overallScore,
        modelUsed,
      };

      logEvent("roast.completed", {
        host,
        dataSource: extractedData.dataSource,
        isVerified: extractedData.isVerified,
        hasScreenshot: Boolean(screenshotBase64),
        modelUsed,
        modelFellBack: usedBackupModel(modelUsed),
        geminiAttempts,
        temperature: null, // production sends no generationConfig
        designScore,
        trustScore,
        uxScore,
        seoScore: seoChecks.seoScore,
        overallScore,
        titleLength: extractedData.titleLength,
        metaDescriptionLength: extractedData.metaDescriptionLength,
        isNoindex: extractedData.isNoindex,
        viewportPresent: extractedData.viewportPresent,
        canonicalPresent: extractedData.canonicalPresent,
        hasHttps: extractedData.hasHttps,
        detectedStack: extractedData.detectedStack,
        scraperMs: timings.scraperMs,
        htmlFetchMs: timings.htmlFetchMs,
        markdownChars: markdown?.length ?? 0,
        fullMarkdownChars: fullMarkdown?.length ?? 0,
        markdownTruncated: (fullMarkdown?.length ?? 0) > (markdown?.length ?? 0),
        criteriaUnclear: assessments.reduce(
          (n, a) => n + a.criteria.filter((c) => c.rating === "unclear").length,
          0
        ),
        geminiMs,
        totalMs: Date.now() - requestStartedAt,
        promptChars: parts[0] && "text" in parts[0] ? parts[0].text.length : 0,
        proseCounts: {
          problems: Array.isArray(prose.biggestProblems) ? prose.biggestProblems.length : 0,
          wins: Array.isArray(prose.quickWins) ? prose.quickWins.length : 0,
          suggestions: Array.isArray(prose.suggestions) ? prose.suggestions.length : 0,
        },
        parseOk: true,
      });

      sendResult({
        report,
        rawData: extractedData,
        rawScrape: { url, screenshotBase64, markdown: fullMarkdown },
      });
    } catch (error) {
      console.error(error);
      logEvent("roast.failed", {
        stage: "unknown",
        host,
        error: error instanceof Error ? error.message : String(error),
        elapsedMs: Date.now() - requestStartedAt,
      });
      sendError("Something went wrong while analyzing the website.");
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
