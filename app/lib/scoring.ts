import {
  ASSESSED_CATEGORIES,
  AssessedCategory,
  CRITERIA_BY_CATEGORY,
  aiCriteria,
  criterionDef,
  criterionWeight,
} from "./criteria";
import { CategoryAssessment, CriterionRating, CriterionResult } from "./types";

const VALID_RATINGS: CriterionRating[] = ["yes", "no", "unclear"];

function isRating(value: unknown): value is CriterionRating {
  return typeof value === "string" && (VALID_RATINGS as string[]).includes(value);
}

/**
 * A category needs this share of its criteria actually answered yes/no before we will
 * score it. Without a floor, a model that hedges everything would produce a score from
 * two data points and present it with the same confidence as one from thirty.
 */
const MIN_ANSWERED_RATIO = 0.6;

/**
 * Validates the model's criterion ratings and merges in the deterministic code-tier
 * results, then scores each category.
 *
 * Tolerant by design, unlike the previous all-or-nothing version. With ~45 AI criteria
 * the odds of one key being missing or misspelled are far higher than they were at 18,
 * and failing the entire report over one absent entry would trade a small inaccuracy for
 * a total outage. A missing or malformed entry becomes "unclear", which is excluded from
 * scoring — so it cannot silently substitute a value the way defaulting to a grade would.
 *
 * Returns null only when a category falls below MIN_ANSWERED_RATIO, which means the
 * response was genuinely unusable rather than merely imperfect.
 */
export function parseAssessments(
  raw: Record<string, unknown>,
  codeResults?: Map<string, CriterionResult>
): CategoryAssessment[] | null {
  const assessments: CategoryAssessment[] = [];

  for (const category of ASSESSED_CATEGORIES) {
    const block = (raw[category] ?? {}) as Record<string, unknown>;
    if (typeof block !== "object") return null;

    const criteria: CriterionResult[] = [];

    // Declared order, so the report reads the same way every time.
    for (const def of CRITERIA_BY_CATEGORY[category]) {
      if (def.source === "code") {
        criteria.push(
          codeResults?.get(def.id) ?? {
            id: def.id,
            rating: "unclear",
            evidence: "This check could not be run.",
          }
        );
        continue;
      }

      const entry = block[def.id];
      if (!entry || typeof entry !== "object") {
        criteria.push({ id: def.id, rating: "unclear", evidence: "" });
        continue;
      }

      const { rating, evidence } = entry as { rating?: unknown; evidence?: unknown };
      criteria.push({
        id: def.id,
        rating: isRating(rating) ? rating : "unclear",
        evidence: typeof evidence === "string" ? evidence.trim() : "",
      });
    }

    if (!meetsAnsweredFloor(category, criteria)) return null;

    assessments.push({
      category,
      score: computeCategoryScore(criteria),
      criteria,
    });
  }

  return assessments;
}

/** Only the AI tier can fail to answer; the code tier always resolves. */
function meetsAnsweredFloor(
  category: AssessedCategory,
  criteria: CriterionResult[]
): boolean {
  const askedIds = new Set(aiCriteria(category).map((c) => c.id));
  if (askedIds.size === 0) return true;

  const answered = criteria.filter(
    (c) => askedIds.has(c.id) && c.rating !== "unclear"
  ).length;

  return answered / askedIds.size >= MIN_ANSWERED_RATIO;
}

export function scoreOf(assessments: CategoryAssessment[], category: string): number {
  return assessments.find((a) => a.category === category)?.score ?? 0;
}

/**
 * Turns a category's criterion ratings into its 0-10 score: the weighted share of
 * answerable criteria that were met.
 *
 *     score = 10 x (weight of "yes") / (weight of "yes" + weight of "no")
 *
 * "unclear" is excluded from BOTH sides rather than scored as a half-point. That removes
 * the incentive to hedge — hedging cannot move the number in either direction — and
 * equally removes the penalty for admitting something genuinely isn't visible in a
 * screenshot. A middle grade would have reintroduced exactly the dumping-ground problem
 * that "adequate" created.
 */
export function computeCategoryScore(criteria: CriterionResult[]): number {
  let met = 0;
  let answered = 0;

  for (const c of criteria) {
    if (c.rating === "unclear") continue;
    const def = criterionDef(c.id);
    const weight = def ? criterionWeight(def) : 1;
    answered += weight;
    if (c.rating === "yes") met += weight;
  }

  if (answered === 0) return 0;

  return Math.round((met / answered) * 10 * 10) / 10;
}

// Trust weighted highest since it's the most conversion-critical, first-impression
// dimension and fits the app's "brutally honest" framing. Design/UX are tied as the
// next-most-visible dimensions. SEO is weighted lowest — it's now a fully objective,
// code-computed "discoverability" metric and shouldn't dominate what is fundamentally
// a subjective roast score.
export const OVERALL_SCORE_WEIGHTS = {
  design: 0.25,
  trust: 0.3,
  ux: 0.25,
  seo: 0.2,
} as const;

export function computeOverallScore(
  designScore: number,
  trustScore: number,
  uxScore: number,
  seoScore: number
): number {
  const weighted =
    designScore * OVERALL_SCORE_WEIGHTS.design +
    trustScore * OVERALL_SCORE_WEIGHTS.trust +
    uxScore * OVERALL_SCORE_WEIGHTS.ux +
    seoScore * OVERALL_SCORE_WEIGHTS.seo;

  // Sub-scores are 0-10; overallScore is 0-100.
  return Math.max(0, Math.min(100, Math.round(weighted * 10)));
}
