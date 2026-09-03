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
- Detected Tech Stack: ${extractedData.detectedStack}

For every text field below, provide TWO versions: a "technical" version (fine to use terms like UX, SEO, CTA, alt text) and a plain-English version prefixed "plain" (zero jargon, as if explaining to a small business owner with no web background — same meaning, same problems, just plain words). Keep the plain arrays the same length and order as their technical counterparts.

For every item in "quickWins" and "suggestions", include a "snippet" only when the fix can be expressed as a concrete, ready-to-paste code change (e.g. missing alt text, a color/contrast fix, a missing meta tag, a heading structure fix). Write the snippet in a style matching the Detected Tech Stack above (use JSX for React/Next.js, PHP-friendly HTML for WordPress, otherwise plain HTML/CSS), and use realistic values pulled from the actual website data above where possible (real image context, real heading text) instead of generic placeholders like "TODO". If an item is not a code fix (e.g. content, copy, or strategy advice), set "snippet" to null. Do not force a snippet where one doesn't make sense.

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
