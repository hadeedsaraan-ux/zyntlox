import { NextRequest, NextResponse } from "next/server";
import { callGeminiWithRetry } from "../../lib/gemini";
import { fetchSiteData, ExtractedSiteData } from "../../lib/siteData";
import { createProgressStream } from "../../lib/progress";
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

      // Build the Gemini prompt (with image if we have one)
      const promptText = `You are a brutally honest but helpful website reviewer. Analyze this website${
        screenshotBase64 ? " (both the data below AND the attached screenshot image)" : ""
      } and return a JSON report.

Website data:
- Title: ${extractedData.title}
- Meta Description: ${extractedData.metaDescription}
- H1 Headings: ${extractedData.h1Tags.join(", ") || "None found"}
- Total Images: ${extractedData.totalImages}
- Images Missing Alt Text: ${extractedData.imagesWithoutAlt}
- Uses HTTPS: ${extractedData.hasHttps}

For every text field below, provide TWO versions: a "technical" version (fine to use terms like UX, SEO, CTA, alt text) and a plain-English version prefixed "plain" (zero jargon, as if explaining to a small business owner with no web background — same meaning, same problems, just plain words). Keep the plain arrays the same length and order as their technical counterparts.

Return ONLY valid JSON (no markdown, no backticks, no extra text) in exactly this structure:
{
  "overallScore": <number 0-100>,
  "firstImpression": "<technical: 2-3 sentences on what a visitor feels in the first 5 seconds>",
  "plainFirstImpression": "<same idea, plain English, no jargon>",
  "designScore": <number 0-10>,
  "trustScore": <number 0-10>,
  "uxScore": <number 0-10>,
  "seoScore": <number 0-10>,
  "biggestProblems": [
    {"issue": "<technical problem>", "plainIssue": "<same problem, plain English>", "impact": "High|Medium|Low", "effort": "Easy|Medium|Hard"}
  ],
  "quickWins": ["<technical, fixable in 10-30 min>"],
  "plainQuickWins": ["<same items, same order, plain English>"],
  "suggestions": ["<specific actionable technical suggestion>"],
  "plainSuggestions": ["<same items, same order, plain English>"]
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
      try {
        geminiData = await callGeminiWithRetry(parts, sendStage);
      } catch (err) {
        console.error("Gemini failed after all retries/fallbacks:", err);
        sendError("AI analysis failed. Please try again in a moment.");
        return;
      }

      let aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();

      const report = JSON.parse(aiText);

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
