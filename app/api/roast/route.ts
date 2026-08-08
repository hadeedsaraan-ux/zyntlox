import { NextRequest, NextResponse } from "next/server";

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
      /<meta\s+name=["']description["']\s+content=["'](.*?)["']/i
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
      const microlinkUrl = `https://api.microlink.io/?url=${encodeURIComponent(
        url
      )}&screenshot=true&meta=false&embed=screenshot.url`;
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

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
        }),
      }
    );

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini error:", geminiData);
      return NextResponse.json(
        { error: "AI analysis failed. Please try again." },
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