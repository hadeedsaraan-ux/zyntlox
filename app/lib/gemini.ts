import { GeminiModel, ProgressStage } from "./types";

// Models to try, in order. If one is overloaded (503) or rate-limited (429), we retry it
// a few times with backoff before falling back to the next.
const MODELS: GeminiModel[] = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const MAX_ATTEMPTS_PER_MODEL = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8000;

function backoffDelay(attempt: number): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
  return exp + Math.random() * 300;
}

export interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { code?: number; message?: string };
}

export interface GeminiCallResult {
  data: GeminiApiResponse;
  modelUsed: GeminiModel;
}

export async function callGeminiWithRetry(
  parts: any[],
  onStage?: (stage: ProgressStage) => void
): Promise<GeminiCallResult> {
  let lastError: any = null;

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
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

        const geminiData: GeminiApiResponse = await geminiResponse.json();

        if (geminiResponse.ok) {
          return { data: geminiData, modelUsed: model };
        }

        console.error(`Gemini error (model: ${model}, attempt: ${attempt}):`, geminiData);
        lastError = geminiData;

        const isRetryable =
          geminiData?.error?.code === 503 || geminiData?.error?.code === 429;
        if (!isRetryable) break;

        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
          await new Promise((res) => setTimeout(res, backoffDelay(attempt)));
        }
      } catch (err) {
        console.error(`Gemini fetch failed (model: ${model}, attempt: ${attempt}):`, err);
        lastError = err;

        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
          await new Promise((res) => setTimeout(res, backoffDelay(attempt)));
        }
      }
    }
  }

  throw lastError; // all models/attempts failed
}
