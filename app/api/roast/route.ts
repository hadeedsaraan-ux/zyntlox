import { NextRequest, NextResponse } from "next/server";
import { callGeminiWithRetry } from "../../lib/gemini";
import { fetchSiteData, ExtractedSiteData } from "../../lib/siteData";
import { createProgressStream } from "../../lib/progress";
import { computeSeoAudit } from "../../lib/seoAudit";
import { computeContentChecks } from "../../lib/contentChecks";
import { computeOverallScore, parseAssessments, scoreOf } from "../../lib/scoring";
import { buildRoastParts } from "../../lib/prompts";
import { hostOf, logEvent } from "../../lib/log";
import { Report } from "../../lib/types";

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const { stream, sendStage, sendResult, sendError } = createProgressStream<{
    report: Report;
    rawData: ExtractedSiteData;
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
      const contentChecks = computeContentChecks(fullMarkdown);

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

      const report: Report = {
        ...aiReport,
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
        modelFellBack: modelUsed !== "gemini-flash-latest",
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
        parseOk: true,
      });

      sendResult({ report, rawData: extractedData });
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
