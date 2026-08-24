import { NextRequest, NextResponse } from "next/server";

// Models to try, in order. If one is overloaded (503), we fall back to the next.
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

async function callGeminiWithRetry(parts: any[]) {
  let lastError: any = null;

  for (const model of MODELS) {
    // Try each model up to 2 times (in case of a temporary overload)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts }] }),
          }
        );

        const geminiData = await geminiResponse.json();

        if (geminiResponse.ok) {
          return geminiData; // success, return immediately
        }

        console.error(`Gemini error (model: ${model}, attempt: ${attempt}):`, geminiData);
        lastError = geminiData;

        // If it's an overload (503), wait a bit and retry/fallback. Otherwise stop trying.
        const isOverloaded = geminiData?.error?.code === 503;
        if (!isOverloaded) break;

        await new Promise((res) => setTimeout(res, 1500)); // wait 1.5s before retrying
      } catch (err) {
        console.error(`Gemini fetch failed (model: ${model}, attempt: ${attempt}):`, err);
        lastError = err;
      }
    }
  }

  throw lastError; // all models/attempts failed
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Step 1: Fetch the website HTML
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not fetch this website. Please check the URL." },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Step 2: Extract basic data
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const metaDescMatch = html.match(
  /<meta\s+name=["']description["']\s+content="([^"]*)"/i
) || html.match(
  /<meta\s+name=["']description["']\s+content='([^']*)'/i
);
    const h1Matches = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, "").trim()
    );
    const imgMatches = [...html.matchAll(/<img[^>]*>/gi)];
    const imagesWithoutAlt = imgMatches.filter(
      (img) => !/alt=["'][^"']+["']/i.test(img[0])
    ).length;
    const hasHttps = response.url.startsWith("https://");

    const extractedData = {
      title: titleMatch ? titleMatch[1].trim() : "No title found",
      metaDescription: metaDescMatch ? metaDescMatch[1].trim() : "No meta description found",
      h1Tags: h1Matches,
      totalImages: imgMatches.length,
      imagesWithoutAlt,
      hasHttps,
    };

    // Step 3: Get a screenshot via Microlink (free, no API key needed)
    let screenshotBase64 = null;
    try {
      const screenshotRes = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&waitFor=6000&fullPage=true`
      );
      const screenshotData = await screenshotRes.json();
      const screenshotImageUrl = screenshotData?.data?.screenshot?.url;

      if (screenshotImageUrl) {
        const imageRes = await fetch(screenshotImageUrl);
        const imageBuffer = await imageRes.arrayBuffer();
        screenshotBase64 = Buffer.from(imageBuffer).toString("base64");
      }
    } catch (screenshotError) {
      console.error("Screenshot failed, continuing without it:", screenshotError);
    }

    // Step 4: Build the Gemini prompt (with image if we have one)
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
CRITICAL ACCURACY RULES — follow these strictly:
- Only state facts that are directly present in the website data above or clearly visible in the screenshot. Do NOT guess, assume, or invent specific details (e.g. locations, company names, exact wording, industries) that are not explicitly shown.
- If the data or screenshot doesn't give you enough to make a specific factual claim, speak in general terms instead of inventing specifics. For example, prefer "the meta description could be more detailed" over inventing what it should say.
- Numeric/count-based observations (image counts, missing alt text, heading structure) can be stated confidently since they come directly from the data.
- Descriptive or interpretive claims (what the site is about, who it's for, what a specific piece of text says) must be grounded only in what's actually in the Title, Meta Description, H1 Headings, or clearly readable in the screenshot — never fill in gaps with plausible-sounding guesses.
- If the screenshot appears broken, blank, or still loading, mention that as a possible issue rather than describing content that may not be reliable.
Return ONLY valid JSON (no markdown, no backticks, no extra text) in exactly this structure:
{
  "overallScore": <number 0-100>,
  "firstImpression": "<2-3 sentences on what a visitor feels in the first 5 seconds>",
  "designScore": <number 0-10>,
  "trustScore": <number 0-10>,
  "uxScore": <number 0-10>,
  "seoScore": <number 0-10>,
  "biggestProblems": [
    {"issue": "<problem>", "impact": "High|Medium|Low", "effort": "Easy|Medium|Hard"}
  ],
  "quickWins": ["<fixable in 10-30 min>"],
  "suggestions": ["<specific actionable suggestion>"]
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
      geminiData = await callGeminiWithRetry(parts);
    } catch (err) {
      console.error("Gemini failed after all retries/fallbacks:", err);
      return NextResponse.json(
        { error: "AI analysis failed. Please try again in a moment." },
        { status: 500 }
      );
    }

    let aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();

    const report = JSON.parse(aiText);

    return NextResponse.json({ success: true, report, rawData: extractedData });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong while analyzing the website." },
      { status: 500 }
    );
  }
}