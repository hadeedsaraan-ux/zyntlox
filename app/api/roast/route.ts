import { NextRequest, NextResponse } from "next/server";
import { callGeminiWithRetry } from "../../lib/gemini";
import { fetchSiteData, ExtractedSiteData } from "../../lib/siteData";
import { createProgressStream } from "../../lib/progress";
import { computeSeoAudit } from "../../lib/seoAudit";
import { computeOverallScore } from "../../lib/scoring";
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
    try {
      const siteData = await fetchSiteData(url, sendStage);
      if (!siteData.ok) {
        sendError(siteData.error);
        return;
      }

      const { extractedData, screenshotBase64 } = siteData;
      const seoChecks = computeSeoAudit(extractedData);

      // Build the Gemini prompt (with image if we have one)
      const promptText = `You are a brutally honest but helpful website reviewer. Analyze this website${
        screenshotBase64 ? " (both the data below AND the attached screenshot image)" : ""
      } and return a JSON report.

Website data:
- Title: ${extractedData.title ?? "No title found"}
- Meta Description: ${extractedData.metaDescription ?? "No meta description found"}
- H1 Headings: ${extractedData.h1Tags.join(", ") || "None found"}
- Total Images: ${extractedData.totalImages}
- Images Missing Alt Text: ${extractedData.imagesWithoutAlt}
- Uses HTTPS: ${extractedData.hasHttps}
- Detected Tech Stack: ${extractedData.detectedStack}

Pre-verified SEO facts (already computed by code — treat as ground truth, do NOT recompute or restate differently):
- HTTPS: ${extractedData.hasHttps}
- Meta description: ${extractedData.metaDescription ? "present" : "missing"}, ${extractedData.metaDescriptionLength} characters
- Title length: ${extractedData.titleLength} characters
- H1 tags found: ${extractedData.h1Count}
- Viewport tag: ${extractedData.viewportPresent ? "present" : "missing"}
- Canonical tag: ${extractedData.canonicalPresent ? "present" : "missing"}
- Images missing alt text: ${extractedData.imagesWithoutAlt} of ${extractedData.totalImages}
- Computed technical SEO score (already final — do not output your own seoScore or overallScore): ${seoChecks.seoScore}/10

IMPORTANT: The SEO facts above are already verified by code. Do NOT invent your own counts, percentages, or scores for anything listed above. If your prose (firstImpression, biggestProblems, quickWins, suggestions) references any of these specific facts, you must reuse the exact figures given verbatim — do not recalculate, round differently, or estimate your own numbers for these items. Do not comment on SEO technical facts already listed above (meta description, H1 count, alt text, viewport, canonical, title length) in biggestProblems/quickWins/suggestions — a separate Technical SEO Checks section already covers those verbatim. Focus your problems/wins/suggestions on Design, Trust, UX, and genuinely subjective/strategic issues instead.

For every text field below, provide TWO versions: a "technical" version (fine to use terms like UX, SEO, CTA, alt text) and a plain-English version prefixed "plain" (zero jargon, as if explaining to a small business owner with no web background — same meaning, same problems, just plain words). Keep the plain arrays the same length and order as their technical counterparts.

For every item in "quickWins" and "suggestions", include a "snippet" only when the fix can be expressed as a concrete, ready-to-paste code change (e.g. a color/contrast fix or a heading structure fix — NOT alt text or meta tags, those are already handled by the Technical SEO Checks section). Write the snippet in a style matching the Detected Tech Stack above (use JSX for React/Next.js, PHP-friendly HTML for WordPress, otherwise plain HTML/CSS), and use realistic values pulled from the actual website data above where possible (real image context, real heading text) instead of generic placeholders like "TODO". If an item is not a code fix (e.g. content, copy, or strategy advice), set "snippet" to null. Do not force a snippet where one doesn't make sense.

Return ONLY valid JSON (no markdown, no backticks, no extra text) in exactly this structure:
{
  "firstImpression": "<technical: 2-3 sentences on what a visitor feels in the first 5 seconds>",
  "plainFirstImpression": "<same idea, plain English, no jargon>",
  "designScore": <number 0-10>,
  "trustScore": <number 0-10>,
  "uxScore": <number 0-10>,
  "biggestProblems": [
    {"issue": "<technical problem>", "plainIssue": "<same problem, plain English>", "impact": "High|Medium|Low", "effort": "Easy|Medium|Hard"}
  ],
  "quickWins": [
    {"text": "<technical, fixable in 10-30 min>", "plainText": "<same, plain English>", "snippet": {"language": "html|css|jsx|js|php", "code": "<ready-to-paste fix>"} or null}
  ],
  "suggestions": [
    {"text": "<specific actionable technical suggestion>", "plainText": "<same, plain English>", "snippet": {"language": "html|css|jsx|js|php", "code": "<ready-to-paste fix>"} or null}
  ]
}`;

      const parts: any[] = [{ text: promptText }];
      if (screenshotBase64) {
        parts.push({
          inline_data: {
            mime_type: "image/png",
            data: screenshotBase64,
          },
        });
      }

      let geminiData;
      let modelUsed;
      try {
        ({ data: geminiData, modelUsed } = await callGeminiWithRetry(parts, sendStage));
      } catch (err) {
        console.error("Gemini failed after all retries/fallbacks:", err);
        sendError("AI analysis failed. Please try again in a moment.");
        return;
      }

      let aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();

      const aiReport = JSON.parse(aiText);

      const overallScore = computeOverallScore(
        aiReport.designScore,
        aiReport.trustScore,
        aiReport.uxScore,
        seoChecks.seoScore
      );

      const report: Report = {
        ...aiReport,
        seoScore: seoChecks.seoScore,
        seoChecks,
        overallScore,
        modelUsed,
      };

      sendResult({ report, rawData: extractedData });
    } catch (error) {
      console.error(error);
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
