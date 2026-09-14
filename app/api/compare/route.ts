import { NextRequest, NextResponse } from "next/server";
import { callGeminiWithRetry, usedBackupModel } from "../../lib/gemini";
import { fetchSiteData, SiteDataResult } from "../../lib/siteData";
import { createProgressStream } from "../../lib/progress";
import { computeSeoAudit } from "../../lib/seoAudit";
import { computeContentChecks } from "../../lib/contentChecks";
import { computeOverallScore, parseAssessments, scoreOf } from "../../lib/scoring";
import { buildRoastParts, buildCompareParts, ComparisonSide } from "../../lib/prompts";
import { criterionDef, criterionLabel, criterionWeight } from "../../lib/criteria";
import { hostOf, logEvent } from "../../lib/log";
import {
  CategoryAssessment,
  ComparisonCategory,
  ComparisonReport,
  ComparisonWinner,
  CriterionResult,
  ReportMode,
  SeoChecks,
} from "../../lib/types";

/** How many strengths/weaknesses to surface per site in the summary. */
const HIGHLIGHT_COUNT = 4;

interface SiteAssessment {
  url: string;
  seoChecks: SeoChecks;
  assessments: CategoryAssessment[];
  designScore: number;
  trustScore: number;
  uxScore: number;
  overallScore: number;
  firstImpression: string;
  plainFirstImpression: string;
  dataSource: string;
  isVerified: boolean;
}

/**
 * Runs the SAME assessment a single-site report runs: identical rubric, identical prompt,
 * identical scoring code. That is the whole point of this rewrite — previously the
 * comparison asked Gemini for `"yourScore": <0-10>` directly, so the two products could
 * disagree about the same website, and the comparison page was the one place left where a
 * score was invented rather than computed.
 */
async function assessSite(site: Extract<SiteDataResult, { ok: true }>, url: string): Promise<SiteAssessment> {
  const seoChecks = computeSeoAudit(site.extractedData);
  const contentChecks = computeContentChecks(site.fullMarkdown, {
    siteUrl: url,
    domLinks: site.extractedData.domLinks,
    structuredAddress: site.extractedData.structuredAddress,
    commerceSignals: site.extractedData.commerceSignals,
  });

  const parts = buildRoastParts({
    extractedData: site.extractedData,
    seoChecks,
    screenshotBase64: site.screenshotBase64,
    markdown: site.markdown,
  });

  const { data } = await callGeminiWithRetry(parts, undefined, { jsonMode: true });
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim());

  const assessments = parseAssessments(parsed, contentChecks);
  if (!assessments) {
    throw new Error(`Incomplete criterion ratings for ${url}`);
  }

  const designScore = scoreOf(assessments, "design");
  const trustScore = scoreOf(assessments, "trust");
  const uxScore = scoreOf(assessments, "ux");

  return {
    url,
    seoChecks,
    assessments,
    designScore,
    trustScore,
    uxScore,
    overallScore: computeOverallScore(designScore, trustScore, uxScore, seoChecks.seoScore),
    firstImpression: typeof parsed.firstImpression === "string" ? parsed.firstImpression : "",
    plainFirstImpression:
      typeof parsed.plainFirstImpression === "string" ? parsed.plainFirstImpression : "",
    dataSource: site.extractedData.dataSource,
    isVerified: site.extractedData.isVerified,
  };
}

/**
 * Picks the criteria worth naming, heaviest-weighted first. Derived from the ratings
 * rather than asked of the model: these are already-settled facts, so generating them
 * would be inventing a second opinion about data we hold.
 */
function highlights(
  assessments: CategoryAssessment[],
  rating: CriterionResult["rating"],
  mode: ReportMode
): string[] {
  return assessments
    .flatMap((a) => a.criteria)
    .filter((c) => c.rating === rating)
    .sort((a, b) => {
      const wa = criterionDef(a.id);
      const wb = criterionDef(b.id);
      return (wb ? criterionWeight(wb) : 1) - (wa ? criterionWeight(wa) : 1);
    })
    .slice(0, HIGHLIGHT_COUNT)
    .map((c) => {
      const label = criterionLabel(c.id, mode);
      return c.evidence ? `${label}: ${c.evidence}` : label;
    });
}

/** All criterion labels a site met / failed, for the comparison writer's evidence. */
function criteriaSplit(assessments: CategoryAssessment[]): { met: string[]; failed: string[] } {
  const all = assessments.flatMap((a) => a.criteria);
  return {
    met: all.filter((c) => c.rating === "yes").map((c) => criterionLabel(c.id, "technical")),
    failed: all.filter((c) => c.rating === "no").map((c) => criterionLabel(c.id, "technical")),
  };
}

function toSide(a: SiteAssessment): ComparisonSide {
  const split = criteriaSplit(a.assessments);
  return {
    url: a.url,
    designScore: a.designScore,
    trustScore: a.trustScore,
    uxScore: a.uxScore,
    seoScore: a.seoChecks.seoScore,
    overallScore: a.overallScore,
    firstImpression: a.firstImpression,
    met: split.met,
    failed: split.failed,
  };
}

/** A category is a tie inside this margin, on the 0-10 scale. */
const TIE_MARGIN = 0.5;

function winnerOf(yours: number, competitor: number): ComparisonWinner {
  if (Math.abs(yours - competitor) <= TIE_MARGIN) return "tie";
  return yours > competitor ? "yours" : "competitor";
}

export async function POST(request: NextRequest) {
  const { yourUrl, competitorUrl } = await request.json();

  if (!yourUrl || !competitorUrl) {
    return NextResponse.json({ error: "Both URLs are required" }, { status: 400 });
  }

  const { stream, sendStage, sendResult, sendError } = createProgressStream<{
    comparison: ComparisonReport;
  }>();

  (async () => {
    try {
      const [yourSite, competitorSite] = await Promise.all([
        fetchSiteData(yourUrl, sendStage, "Your site"),
        fetchSiteData(competitorUrl, sendStage, "Competitor site"),
      ]);

      if (!yourSite.ok && !competitorSite.ok) {
        sendError("Could not fetch either website. Please check both URLs.");
        return;
      }
      if (!yourSite.ok) {
        sendError("Could not fetch your website. Please check the URL.");
        return;
      }
      if (!competitorSite.ok) {
        sendError("Could not fetch the competitor's website. Please check the URL.");
        return;
      }

      // Both sites are assessed in parallel, so the wall time is one assessment, not two.
      sendStage({ id: "gemini", label: "Scoring both sites against the checklist" });
      let yours: SiteAssessment;
      let competitor: SiteAssessment;
      try {
        [yours, competitor] = await Promise.all([
          assessSite(yourSite, yourUrl),
          assessSite(competitorSite, competitorUrl),
        ]);
      } catch (err) {
        console.error("Per-site assessment failed:", err);
        logEvent("compare.failed", {
          stage: "assess",
          yoursHost: hostOf(yourUrl),
          competitorHost: hostOf(competitorUrl),
          error: err instanceof Error ? err.message : String(err),
        });
        sendError("AI comparison failed. Please try again in a moment.");
        return;
      }

      // Every number below is now settled. The remaining call writes prose only.
      sendStage({ id: "gemini", label: "Writing the head-to-head verdict" });
      let modelUsed;
      let narrative;
      try {
        const res = await callGeminiWithRetry(
          buildCompareParts({ yours: toSide(yours), competitor: toSide(competitor) }),
          sendStage,
          { jsonMode: true }
        );
        modelUsed = res.modelUsed;
        const raw = res.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        narrative = JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim());
      } catch (err) {
        console.error("Comparison narrative failed:", err);
        logEvent("compare.failed", {
          stage: "narrative",
          yoursHost: hostOf(yourUrl),
          competitorHost: hostOf(competitorUrl),
          error: err instanceof Error ? err.message : String(err),
        });
        sendError("AI comparison failed. Please try again in a moment.");
        return;
      }

      const verdictFor = (name: "Design" | "Trust" | "UX") => {
        const found = (narrative.categories as ComparisonCategory[] | undefined)?.find(
          (c) => c.category === name
        );
        return {
          verdict: typeof found?.verdict === "string" ? found.verdict : "",
          plainVerdict: typeof found?.plainVerdict === "string" ? found.plainVerdict : "",
        };
      };

      // Scores and winners come from code; only the prose comes from the model, so a
      // missing verdict costs a sentence rather than the whole comparison.
      const categories: ComparisonCategory[] = [
        {
          category: "Design",
          yourScore: yours.designScore,
          competitorScore: competitor.designScore,
          winner: winnerOf(yours.designScore, competitor.designScore),
          ...verdictFor("Design"),
        },
        {
          category: "Trust",
          yourScore: yours.trustScore,
          competitorScore: competitor.trustScore,
          winner: winnerOf(yours.trustScore, competitor.trustScore),
          ...verdictFor("Trust"),
        },
        {
          category: "UX",
          yourScore: yours.uxScore,
          competitorScore: competitor.uxScore,
          winner: winnerOf(yours.uxScore, competitor.uxScore),
          ...verdictFor("UX"),
        },
        {
          category: "SEO",
          yourScore: yours.seoChecks.seoScore,
          competitorScore: competitor.seoChecks.seoScore,
          winner: winnerOf(yours.seoChecks.seoScore, competitor.seoChecks.seoScore),
          verdict: typeof narrative.seoVerdict === "string" ? narrative.seoVerdict : "",
          plainVerdict:
            typeof narrative.plainSeoVerdict === "string" ? narrative.plainSeoVerdict : "",
        },
      ];

      // 2 points on the 0-100 scale, matching the previous behaviour.
      const overallWinner: ComparisonWinner =
        Math.abs(yours.overallScore - competitor.overallScore) <= 2
          ? "tie"
          : yours.overallScore > competitor.overallScore
          ? "yours"
          : "competitor";

      const comparison: ComparisonReport = {
        yours: {
          url: yourUrl,
          overallScore: yours.overallScore,
          firstImpression: yours.firstImpression,
          plainFirstImpression: yours.plainFirstImpression,
          strengths: highlights(yours.assessments, "yes", "technical"),
          plainStrengths: highlights(yours.assessments, "yes", "plain"),
          weaknesses: highlights(yours.assessments, "no", "technical"),
          plainWeaknesses: highlights(yours.assessments, "no", "plain"),
        },
        competitor: {
          url: competitorUrl,
          overallScore: competitor.overallScore,
          firstImpression: competitor.firstImpression,
          plainFirstImpression: competitor.plainFirstImpression,
          strengths: highlights(competitor.assessments, "yes", "technical"),
          plainStrengths: highlights(competitor.assessments, "yes", "plain"),
          weaknesses: highlights(competitor.assessments, "no", "technical"),
          plainWeaknesses: highlights(competitor.assessments, "no", "plain"),
        },
        categories,
        yourSeoChecks: yours.seoChecks,
        competitorSeoChecks: competitor.seoChecks,
        overallWinner,
        overallVerdict: typeof narrative.overallVerdict === "string" ? narrative.overallVerdict : "",
        plainOverallVerdict:
          typeof narrative.plainOverallVerdict === "string" ? narrative.plainOverallVerdict : "",
        topRecommendations: Array.isArray(narrative.topRecommendations)
          ? narrative.topRecommendations
          : [],
        plainTopRecommendations: Array.isArray(narrative.plainTopRecommendations)
          ? narrative.plainTopRecommendations
          : [],
        modelUsed,
      };

      logEvent("compare.completed", {
        yoursHost: hostOf(yourUrl),
        competitorHost: hostOf(competitorUrl),
        modelUsed,
        modelFellBack: usedBackupModel(modelUsed),
        yours: {
          dataSource: yours.dataSource,
          isVerified: yours.isVerified,
          seoScore: yours.seoChecks.seoScore,
          designScore: yours.designScore,
          trustScore: yours.trustScore,
          uxScore: yours.uxScore,
          overallScore: yours.overallScore,
        },
        competitor: {
          dataSource: competitor.dataSource,
          isVerified: competitor.isVerified,
          seoScore: competitor.seoChecks.seoScore,
          designScore: competitor.designScore,
          trustScore: competitor.trustScore,
          uxScore: competitor.uxScore,
          overallScore: competitor.overallScore,
        },
        overallWinner,
        parseOk: true,
      });

      sendResult({ comparison });
    } catch (error) {
      console.error(error);
      logEvent("compare.failed", {
        stage: "unknown",
        yoursHost: hostOf(yourUrl),
        competitorHost: hostOf(competitorUrl),
        error: error instanceof Error ? error.message : String(error),
      });
      sendError("Something went wrong while comparing the websites.");
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
