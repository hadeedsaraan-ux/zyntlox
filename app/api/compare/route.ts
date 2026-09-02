import { NextRequest, NextResponse } from "next/server";
import { callGeminiWithRetry } from "../../lib/gemini";
import { fetchSiteData } from "../../lib/siteData";
import { createProgressStream } from "../../lib/progress";
import { ComparisonReport } from "../../lib/types";

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

      const promptText = `You are a brutally honest but helpful website reviewer. Compare these two websites head-to-head and return a JSON comparison report.

Site A — "Your Site" (${yourUrl}):
- Title: ${yourSite.extractedData.title}
- Meta Description: ${yourSite.extractedData.metaDescription}
- H1 Headings: ${yourSite.extractedData.h1Tags.join(", ") || "None found"}
- Total Images: ${yourSite.extractedData.totalImages}
- Images Missing Alt Text: ${yourSite.extractedData.imagesWithoutAlt}
- Uses HTTPS: ${yourSite.extractedData.hasHttps}

Site B — "Competitor Site" (${competitorUrl}):
- Title: ${competitorSite.extractedData.title}
- Meta Description: ${competitorSite.extractedData.metaDescription}
- H1 Headings: ${competitorSite.extractedData.h1Tags.join(", ") || "None found"}
- Total Images: ${competitorSite.extractedData.totalImages}
- Images Missing Alt Text: ${competitorSite.extractedData.imagesWithoutAlt}
- Uses HTTPS: ${competitorSite.extractedData.hasHttps}

${
  yourSite.screenshotBase64 || competitorSite.screenshotBase64
    ? "Screenshots for both sites are attached (in the order: Your Site, then Competitor Site, for whichever are available)."
    : ""
}

For every text field below, provide TWO versions: a "technical" version (fine to use terms like UX, SEO, CTA, alt text) and a plain-English version prefixed "plain" (zero jargon, as if explaining to a small business owner with no web background — same meaning, same problems, just plain words). Keep plain arrays the same length and order as their technical counterparts.

Judge each category on its own merits — do not default to always favoring Site A. "winner" must be "yours", "competitor", or "tie".

Return ONLY valid JSON (no markdown, no backticks, no extra text) in exactly this structure:
{
  "yours": {
    "url": "${yourUrl}",
    "overallScore": <number 0-100>,
    "firstImpression": "<2-3 sentences>",
    "plainFirstImpression": "<same, plain English>",
    "strengths": ["<technical strength>"],
    "plainStrengths": ["<same items, same order, plain English>"],
    "weaknesses": ["<technical weakness>"],
    "plainWeaknesses": ["<same items, same order, plain English>"]
  },
  "competitor": {
    "url": "${competitorUrl}",
    "overallScore": <number 0-100>,
    "firstImpression": "<2-3 sentences>",
    "plainFirstImpression": "<same, plain English>",
    "strengths": ["<technical strength>"],
    "plainStrengths": ["<same items, same order, plain English>"],
    "weaknesses": ["<technical weakness>"],
    "plainWeaknesses": ["<same items, same order, plain English>"]
  },
  "categories": [
    {"category": "Design", "yourScore": <0-10>, "competitorScore": <0-10>, "winner": "yours|competitor|tie", "verdict": "<technical, 1-2 sentences>", "plainVerdict": "<same, plain English>"},
    {"category": "Trust", "yourScore": <0-10>, "competitorScore": <0-10>, "winner": "yours|competitor|tie", "verdict": "<technical>", "plainVerdict": "<plain English>"},
    {"category": "UX", "yourScore": <0-10>, "competitorScore": <0-10>, "winner": "yours|competitor|tie", "verdict": "<technical>", "plainVerdict": "<plain English>"},
    {"category": "SEO", "yourScore": <0-10>, "competitorScore": <0-10>, "winner": "yours|competitor|tie", "verdict": "<technical>", "plainVerdict": "<plain English>"}
  ],
  "overallWinner": "yours|competitor|tie",
  "overallVerdict": "<technical, 2-3 sentences on who wins overall and why>",
  "plainOverallVerdict": "<same, plain English>",
  "topRecommendations": ["<specific actionable step for 'yours' to beat the competitor>"],
  "plainTopRecommendations": ["<same items, same order, plain English>"]
}`;

      const parts: any[] = [{ text: promptText }];
      if (yourSite.screenshotBase64) {
        parts.push({
          inline_data: { mime_type: "image/png", data: yourSite.screenshotBase64 },
        });
      }
      if (competitorSite.screenshotBase64) {
        parts.push({
          inline_data: { mime_type: "image/png", data: competitorSite.screenshotBase64 },
        });
      }

      sendStage({ id: "gemini", label: "Analyzing both sites with Gemini AI" });
      let geminiData;
      try {
        geminiData = await callGeminiWithRetry(parts, sendStage);
      } catch (err) {
        console.error("Gemini failed after all retries/fallbacks:", err);
        sendError("AI comparison failed. Please try again in a moment.");
        return;
      }

      let aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();

      const comparison = JSON.parse(aiText);

      sendResult({ comparison });
    } catch (error) {
      console.error(error);
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
