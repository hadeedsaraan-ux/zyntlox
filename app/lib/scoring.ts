import { ASSESSED_CATEGORIES, CRITERIA_BY_CATEGORY } from "./criteria";
import { CategoryAssessment, CriterionRating, CriterionResult } from "./types";

const VALID_RATINGS: CriterionRating[] = ["good", "adequate", "poor"];

function isRating(value: unknown): value is CriterionRating {
  return typeof value === "string" && (VALID_RATINGS as string[]).includes(value);
}

/**
 * Validates the model's criterion ratings and scores each category.
 *
 * Returns null if anything is missing or malformed, rather than defaulting the gaps —
 * a score built on silently-substituted values is exactly the kind of false precision
 * this whole rework exists to remove. The caller surfaces a retryable error instead.
 */
export function parseAssessments(raw: Record<string, unknown>): CategoryAssessment[] | null {
  const assessments: CategoryAssessment[] = [];

  for (const category of ASSESSED_CATEGORIES) {
    const block = raw[category];
    if (!block || typeof block !== "object") return null;

    const entries = block as Record<string, unknown>;
    const criteria: CriterionResult[] = [];

    for (const def of CRITERIA_BY_CATEGORY[category]) {
      const entry = entries[def.id];
      if (!entry || typeof entry !== "object") return null;

      const { rating, evidence } = entry as { rating?: unknown; evidence?: unknown };
      if (!isRating(rating)) return null;

      criteria.push({
        id: def.id,
        rating,
        evidence: typeof evidence === "string" ? evidence.trim() : "",
      });
    }

    assessments.push({
      category,
      score: computeCategoryScore(criteria),
      criteria,
    });
  }

  return assessments;
}

export function scoreOf(assessments: CategoryAssessment[], category: string): number {
  return assessments.find((a) => a.category === category)?.score ?? 0;
}

/** good/adequate/poor → points. Six criteria per category, so 12 is a perfect score. */
export const RATING_POINTS: Record<CriterionRating, number> = {
  good: 2,
  adequate: 1,
  poor: 0,
};

/**
 * Turns a category's criterion ratings into its 0-10 score.
 *
 * The model rates six concrete, screenshot-answerable things; the arithmetic happens
 * here. Same ratings always produce the same score, and no single shaky judgment can
 * swing the result the way one freehand 0-10 guess could.
 */
export function computeCategoryScore(criteria: CriterionResult[]): number {
  if (criteria.length === 0) return 0;

  const earned = criteria.reduce((sum, c) => sum + (RATING_POINTS[c.rating] ?? 0), 0);
  const max = criteria.length * RATING_POINTS.good;

  return Math.round((earned / max) * 10 * 10) / 10;
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
