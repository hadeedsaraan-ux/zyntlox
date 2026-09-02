import { ProgressStage } from "./types";

// Models to try, in order. If one is overloaded (503), we fall back to the next.
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

export async function callGeminiWithRetry(
  parts: any[],
  onStage?: (stage: ProgressStage) => void
) {
  let lastError: any = null;

  for (const model of MODELS) {
    // Try each model up to 2 times (in case of a temporary overload)
    for (let attempt = 1; attempt <= 2; attempt++) {
      onStage?.({ id: "gemini", label: "Analyzing with Gemini…" });
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
