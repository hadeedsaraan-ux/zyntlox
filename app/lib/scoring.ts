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
