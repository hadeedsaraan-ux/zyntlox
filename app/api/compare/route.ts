import { NextRequest, NextResponse } from "next/server";
import { callGeminiWithRetry } from "../../lib/gemini";
import { fetchSiteData } from "../../lib/siteData";
import { createProgressStream } from "../../lib/progress";
import { computeSeoAudit } from "../../lib/seoAudit";
import { computeOverallScore } from "../../lib/scoring";
import { buildCompareParts } from "../../lib/prompts";
import { hostOf, logEvent } from "../../lib/log";
import { ComparisonCategory, ComparisonReport, ComparisonWinner } from "../../lib/types";

/** Gemini must return these as finite numbers or overallScore silently becomes NaN. */
function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasValidScores(category: ComparisonCategory | undefined): category is ComparisonCategory {
  return (
    category !== undefined &&
    isValidScore(category.yourScore) &&
    isValidScore(category.competitorScore)
  );
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

      const yourSeoChecks = computeSeoAudit(yourSite.extractedData);
      const competitorSeoChecks = computeSeoAudit(competitorSite.extractedData);

      // Prompt construction lives in lib/prompts.ts so the diagnostics harness can
      // replay the exact prompt production sends, rather than a copy that can drift.
      const parts = buildCompareParts({
        yourUrl,
        competitorUrl,
        yourData: yourSite.extractedData,
        competitorData: competitorSite.extractedData,
        yourSeoChecks,
        competitorSeoChecks,
        yourScreenshotBase64: yourSite.screenshotBase64,
        competitorScreenshotBase64: competitorSite.screenshotBase64,
      });

      sendStage({ id: "gemini", label: "Analyzing both sites with Gemini AI" });
      let geminiData;
      let modelUsed;
      try {
        ({ data: geminiData, modelUsed } = await callGeminiWithRetry(parts, sendStage));
      } catch (err) {
        console.error("Gemini failed after all retries/fallbacks:", err);
        sendError("AI comparison failed. Please try again in a moment.");
        return;
      }

      let aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();

      let aiComparison;
      try {
        aiComparison = JSON.parse(aiText);
      } catch (err) {
        console.error("Gemini returned malformed JSON:", err);
        sendError("The AI returned an unreadable response. Please try again.");
        return;
      }

      const findCategory = (name: "Design" | "Trust" | "UX") =>
        (aiComparison.categories as ComparisonCategory[] | undefined)?.find(
          (c) => c.category === name
        );

      const designCat = findCategory("Design");
      const trustCat = findCategory("Trust");
      const uxCat = findCategory("UX");

      // Without this, a missing category throws a TypeError (or a missing score yields
      // NaN scores) and surfaces only as the generic catch-all error below.
      if (!hasValidScores(designCat) || !hasValidScores(trustCat) || !hasValidScores(uxCat)) {
        console.error("Gemini comparison missing valid Design/Trust/UX categories:", {
          categories: aiComparison.categories,
        });
        sendError("The AI returned an incomplete comparison. Please try again.");
        return;
      }

      const yourOverallScore = computeOverallScore(
        designCat.yourScore,
        trustCat.yourScore,
        uxCat.yourScore,
        yourSeoChecks.seoScore
      );
      const competitorOverallScore = computeOverallScore(
        designCat.competitorScore,
        trustCat.competitorScore,
        uxCat.competitorScore,
        competitorSeoChecks.seoScore
      );

      const seoWinner: ComparisonWinner =
        yourSeoChecks.seoScore === competitorSeoChecks.seoScore
          ? "tie"
          : yourSeoChecks.seoScore > competitorSeoChecks.seoScore
          ? "yours"
          : "competitor";

      const seoCategory: ComparisonCategory = {
        category: "SEO",
        yourScore: yourSeoChecks.seoScore,
        competitorScore: competitorSeoChecks.seoScore,
        winner: seoWinner,
        verdict: aiComparison.seoVerdict,
        plainVerdict: aiComparison.plainSeoVerdict,
      };

      const overallWinner: ComparisonWinner =
        Math.abs(yourOverallScore - competitorOverallScore) <= 2
          ? "tie"
          : yourOverallScore > competitorOverallScore
          ? "yours"
          : "competitor";

      const comparison: ComparisonReport = {
        yours: { ...aiComparison.yours, overallScore: yourOverallScore },
        competitor: { ...aiComparison.competitor, overallScore: competitorOverallScore },
        categories: [...aiComparison.categories, seoCategory],
        yourSeoChecks,
        competitorSeoChecks,
        overallWinner,
        overallVerdict: aiComparison.overallVerdict,
        plainOverallVerdict: aiComparison.plainOverallVerdict,
        topRecommendations: aiComparison.topRecommendations,
        plainTopRecommendations: aiComparison.plainTopRecommendations,
        modelUsed,
      };

      logEvent("compare.completed", {
        yoursHost: hostOf(yourUrl),
        competitorHost: hostOf(competitorUrl),
        modelUsed,
        modelFellBack: modelUsed !== "gemini-flash-latest",
        yours: {
          dataSource: yourSite.extractedData.dataSource,
          isVerified: yourSite.extractedData.isVerified,
          seoScore: yourSeoChecks.seoScore,
          designScore: designCat.yourScore,
          trustScore: trustCat.yourScore,
          uxScore: uxCat.yourScore,
          overallScore: yourOverallScore,
        },
        competitor: {
          dataSource: competitorSite.extractedData.dataSource,
          isVerified: competitorSite.extractedData.isVerified,
          seoScore: competitorSeoChecks.seoScore,
          designScore: designCat.competitorScore,
          trustScore: trustCat.competitorScore,
          uxScore: uxCat.competitorScore,
          overallScore: competitorOverallScore,
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
