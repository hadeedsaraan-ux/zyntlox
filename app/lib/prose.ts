import { callGeminiWithRetry, GeminiCallOptions } from "./gemini";
import { buildProseParts, ProsePromptInput } from "./prompts";
import { criterionDef, criterionLabel, criterionWeight } from "./criteria";
import { ActionItem, CategoryAssessment, GeminiModel, Problem, ProgressStage } from "./types";

/**
 * The written half of a report (biggest problems, quick wins, suggestions), shared by the
 * roast route and the diagnostics harness so the harness measures exactly what production
 * sends.
 *
 * Temperature is set explicitly here, unlike the criteria call. Earlier measurements found
 * temperature had no effect on SCORES, but that was never measured for the write-up. At
 * the server default (~1.0) the same site could get a detailed write-up on one run and
 * a thin one on the next. See `npm run diag -- replay --prose-temps`.
 */
export const PROSE_TEMPERATURE = 0.2;

export interface ProseSections {
  biggestProblems: Problem[];
  quickWins: ActionItem[];
  suggestions: ActionItem[];
}

const EMPTY_SECTIONS: ProseSections = { biggestProblems: [], quickWins: [], suggestions: [] };

// JSON mode guarantees syntactically valid JSON, not schema conformance — an occasional
// item comes back with a null/missing text field. Drop those rather than shipping a blank
// card to the report.
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function isValidProblem(p: unknown): p is Problem {
  return !!p && typeof p === "object" && isNonEmptyString((p as Problem).issue);
}
function isValidActionItem(a: unknown): a is ActionItem {
  return !!a && typeof a === "object" && isNonEmptyString((a as ActionItem).text);
}

/** Throws on unparseable JSON; invalid items are dropped rather than failing the whole call. */
export function parseProse(rawText: string): ProseSections {
  const prose = JSON.parse(rawText.replace(/```json/g, "").replace(/```/g, "").trim() || "{}");
  return {
    biggestProblems: Array.isArray(prose.biggestProblems)
      ? prose.biggestProblems.filter(isValidProblem)
      : [],
    quickWins: Array.isArray(prose.quickWins) ? prose.quickWins.filter(isValidActionItem) : [],
    suggestions: Array.isArray(prose.suggestions) ? prose.suggestions.filter(isValidActionItem) : [],
  };
}

/**
 * The page failed real criteria but the write-up has nothing to say about any of them.
 * The prompt's relevance filter does permit an empty section, so this is not proof of a bad
 * response — but both sections empty at once, with failures available, is the "second
 * report was much weaker" symptom, and worth one retry.
 */
export function isHollow(sections: ProseSections, failedCount: number): boolean {
  return failedCount > 0 && sections.biggestProblems.length === 0 && sections.suggestions.length === 0;
}

/**
 * Turns the criteria call's output into the prose prompt's input. The FAILED list carries
 * the model's evidence, heaviest criteria first, so the advice leads with what matters most.
 */
export function buildProseInput(args: {
  url: string;
  firstImpression: string;
  assessments: CategoryAssessment[];
  designScore: number;
  trustScore: number;
  uxScore: number;
  seoScore: number;
  overallScore: number;
  detectedStack: string;
}): ProsePromptInput {
  const rated = args.assessments.flatMap((a) => a.criteria);
  const byWeight = (a: { id: string }, b: { id: string }) => {
    const da = criterionDef(a.id);
    const db = criterionDef(b.id);
    return (db ? criterionWeight(db) : 1) - (da ? criterionWeight(da) : 1);
  };
  const labelOf = (c: { id: string; evidence: string }) =>
    c.evidence ? `${criterionLabel(c.id, "technical")} — ${c.evidence}` : criterionLabel(c.id, "technical");

  return {
    url: args.url,
    firstImpression: args.firstImpression,
    designScore: args.designScore,
    trustScore: args.trustScore,
    uxScore: args.uxScore,
    seoScore: args.seoScore,
    overallScore: args.overallScore,
    detectedStack: args.detectedStack,
    failed: rated.filter((c) => c.rating === "no").sort(byWeight).map(labelOf),
    met: rated.filter((c) => c.rating === "yes").sort(byWeight).map((c) => criterionLabel(c.id, "technical")),
  };
}

export interface ProseResult {
  sections: ProseSections;
  /** null when every attempt failed. */
  modelUsed: GeminiModel | null;
  /** Both attempts threw or returned unparseable JSON — the sections are empty for that reason. */
  unavailable: boolean;
  /** 1, or 2 when the first attempt failed or came back hollow. */
  tries: number;
}

const MAX_TRIES = 2;

export async function generateProse(
  input: ProsePromptInput,
  onStage?: (stage: ProgressStage) => void,
  options?: Pick<GeminiCallOptions, "models" | "temperature">
): Promise<ProseResult> {
  const temperature = options && "temperature" in options ? options.temperature : PROSE_TEMPERATURE;
  let best: { sections: ProseSections; modelUsed: GeminiModel } | null = null;
  let tries = 0;

  for (let i = 0; i < MAX_TRIES; i++) {
    tries++;
    try {
      const res = await callGeminiWithRetry(buildProseParts(input), onStage, {
        jsonMode: true,
        models: options?.models,
        temperature,
      });
      const sections = parseProse(res.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
      best = { sections, modelUsed: res.modelUsed };
      if (!isHollow(sections, input.failed.length)) break;
      console.warn(`Prose attempt ${tries} was hollow (${input.failed.length} failed criteria); retrying.`);
    } catch (err) {
      console.error(`Prose attempt ${tries} failed:`, err);
    }
  }

  if (!best) return { sections: EMPTY_SECTIONS, modelUsed: null, unavailable: true, tries };
  return { ...best, unavailable: false, tries };
}
