import { GeminiModel, GeminiPart, ProgressStage } from "./types";

// Models to try, in order. If one is overloaded (503) or rate-limited (429), we retry it
// a few times with backoff before falling back to the next.
const MODELS: readonly GeminiModel[] = ["gemini-flash-latest", "gemini-flash-lite-latest"];
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

export interface GeminiCallOptions {
  /**
   * Override the model fallback chain. Defaults to MODELS.
   * The diagnostics harness passes a SINGLE-element array per experiment cell: with the
   * default chain, a 503 on the primary silently turns a "flash" datapoint into a
   * "flash-lite" one and contaminates the very comparison being measured.
   */
  models?: readonly GeminiModel[];
  /**
   * When set, sent as generationConfig.temperature. When undefined, NO generationConfig
   * key is emitted at all — the request body stays byte-identical to today's.
   */
  temperature?: number;
}

export interface GeminiCallResult {
  data: GeminiApiResponse;
  modelUsed: GeminiModel;
  /** Total attempts across every model tried. >1 is the rate-limit canary. */
  attempts: number;
  /** Wall time of the whole call, including retries and backoff. */
  latencyMs: number;
}

export async function callGeminiWithRetry(
  parts: GeminiPart[],
  onStage?: (stage: ProgressStage) => void,
  options?: GeminiCallOptions
): Promise<GeminiCallResult> {
  let lastError: unknown = null;
  let attempts = 0;
  const startedAt = Date.now();

  // Without this, an unset key is interpolated into the URL as the literal string
  // "undefined", producing a 400 that isn't retryable — indistinguishable in the logs
  // from a genuine API failure. The user-facing message stays generic; only this is new.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server (see .env.example). No request was attempted."
    );
  }

  const models = options?.models ?? MODELS;

  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      attempts++;
      onStage?.({ id: "gemini", label: "Analyzing with Gemini…" });
      try {
        // Conditional KEY, not conditional value: omitting generationConfig means
        // "whatever the server defaults to", which is what production sends today.
        // Sending an explicit temperature: 1.0 instead would pin a value nobody chose
        // and destroy the baseline the diagnostics are measuring against.
        const body: {
          contents: [{ parts: GeminiPart[] }];
          generationConfig?: { temperature: number };
        } = { contents: [{ parts }] };

        if (options?.temperature !== undefined) {
          body.generationConfig = { temperature: options.temperature };
        }

        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );

        const geminiData: GeminiApiResponse = await geminiResponse.json();

        if (geminiResponse.ok) {
          return {
            data: geminiData,
            modelUsed: model,
            attempts,
            latencyMs: Date.now() - startedAt,
          };
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
