import { GeminiModel, GeminiPart, ProgressStage } from "./types";

/**
 * Models to try, in order. If one is overloaded (503) or rate-limited (429), we retry it
 * a few times with backoff before falling back to the next.
 *
 * Order is measured, not assumed. `gemini-flash-latest` used to lead this list and is
 * reliably 503 "experiencing high demand" against our payload, which is why every report
 * carried a "backup model used" notice — the fallback was the normal path, not the
 * exception. Probed on the real fixture:
 *
 *   gemini-flash-lite-latest   200   8.1s   0 thinking tokens
 *   gemini-3.5-flash-lite      200   6.9s   0 thinking tokens
 *   gemini-flash-latest        503   overloaded
 *   gemini-3-flash-preview     200   25s    1591 thinking tokens (too slow)
 *   gemini-2.5-flash           404   retired
 */
const MODELS: readonly GeminiModel[] = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
];

/** The model a healthy request is expected to use. Drives the report's backup notice. */
export const PRIMARY_MODEL: GeminiModel = MODELS[0];
const MAX_ATTEMPTS_PER_MODEL = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8000;

function backoffDelay(attempt: number): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
  return exp + Math.random() * 300;
}

/** A per-DAY quota. Distinct from a per-minute rate limit, which backoff does clear. */
function isDailyQuotaError(message: string): boolean {
  return /per ?day|perday|daily limit|quota.*exceeded.*day/i.test(message);
}

/**
 * Whether retrying this same model could plausibly succeed within our backoff window.
 *
 * 429 is deliberately NOT retryable as a class. A per-minute rate limit clears in
 * seconds, but the free tier's per-day quota does not clear for hours — retrying it three
 * times with exponential backoff spent ~10 seconds of the user's wait on an error that
 * was never going to resolve, and only then fell through to the next model.
 *
 * 404 means the model id was retired (as `gemini-2.5-flash` was). Never retryable, and
 * worth shouting about, because it silently removes an entry from the fallback chain.
 */
function isRetryableError(response: GeminiApiResponse, model: GeminiModel): boolean {
  const code = response?.error?.code;
  const message = response?.error?.message ?? "";

  if (code === 404) {
    console.error(
      `Gemini model "${model}" returned 404 — it has probably been retired. ` +
        `Remove it from MODELS or replace it with a -latest alias.`
    );
    return false;
  }

  if (code === 429) {
    if (isDailyQuotaError(message)) {
      console.error(`Gemini daily quota exhausted for "${model}"; moving to the next model.`);
      return false;
    }
    return true; // per-minute rate limit — backoff genuinely helps
  }

  return code === 503;
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
   * When set, sent as generationConfig.temperature. When undefined, no temperature key
   * is emitted and the server's own default applies.
   */
  temperature?: number;
  /**
   * Ask the API to guarantee syntactically valid JSON. Worth doing now that a response
   * carries ~45 criterion objects: the odds of a stray backtick or an unterminated string
   * scale with response length, and a parse failure costs the entire report.
   *
   * This does NOT validate our schema — only that the bytes parse. Missing or misnamed
   * criterion keys are still handled downstream by parseAssessments.
   */
  jsonMode?: boolean;
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
        // Conditional KEYS, not conditional values: an absent key means "whatever the
        // server defaults to". Sending an explicit temperature: 1.0 instead would pin a
        // value nobody chose and destroy the baseline the diagnostics measure against.
        const body: {
          contents: [{ parts: GeminiPart[] }];
          generationConfig?: { temperature?: number; responseMimeType?: string };
        } = { contents: [{ parts }] };

        const generationConfig: { temperature?: number; responseMimeType?: string } = {};
        if (options?.temperature !== undefined) {
          generationConfig.temperature = options.temperature;
        }
        if (options?.jsonMode) {
          generationConfig.responseMimeType = "application/json";
        }
        if (Object.keys(generationConfig).length > 0) {
          body.generationConfig = generationConfig;
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

        if (!isRetryableError(geminiData, model)) break;

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

/**
 * Whether a report was answered by something other than the primary model.
 *
 * Derived from the chain rather than compared against a hardcoded id: the previous
 * version tested `modelUsed !== "gemini-flash-latest"`, so reordering the chain would
 * have inverted the notice and shown it on every healthy request.
 */
export function usedBackupModel(modelUsed: GeminiModel | undefined): boolean {
  return modelUsed !== undefined && modelUsed !== PRIMARY_MODEL;
}
