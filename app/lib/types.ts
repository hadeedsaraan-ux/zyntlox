export type ReportMode = "technical" | "plain";

export interface ProgressStage {
  id: string;
  label: string;
}

export type StreamEvent<T> =
  | { type: "stage"; stage: ProgressStage }
  | { type: "result"; data: T }
  | { type: "error"; error: string };

export interface Problem {
  issue: string;
  plainIssue: string;
  impact: "High" | "Medium" | "Low";
  effort: "Easy" | "Medium" | "Hard";
}

export interface CodeSnippet {
  language: string;
  code: string;
}

export interface ActionItem {
  text: string;
  plainText: string;
  snippet: CodeSnippet | null;
}

/**
 * Prefer `-latest` aliases over pinned versions. Pinned model ids are retired without
 * warning — `gemini-2.5-flash` now returns 404 — which would take the primary model out
 * silently. `gemini-3.5-flash-lite` is the one pinned entry, kept as a middle fallback.
 */
export type GeminiModel =
  | "gemini-flash-lite-latest"
  | "gemini-3.5-flash-lite"
  | "gemini-flash-latest";

/** A single element of the Gemini `contents[0].parts` array. */
export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export type CheckStatus = "pass" | "warn" | "fail";

/**
 * Every check is derived from `<head>` metadata (plus the URL's scheme and `<html lang>`).
 *
 * Body-DOM checks — alt-text counts, H1 counts, link names, form labels, mixed content —
 * were deliberately removed. They required crawling the whole document, and on the
 * raw-fetch path (unrendered HTML) an SPA's body is empty, so those counts were the least
 * trustworthy numbers in the report. Head tags don't have that problem: they are
 * server-rendered by necessity, since that's what crawlers and social-card scrapers read.
 */
export interface SeoCheck {
  id:
    | "https"
    | "noindex"
    | "metaDescription"
    | "title"
    | "viewport"
    | "zoomBlocked"
    | "canonical"
    | "socialPreview"
    | "favicon"
    | "langAttribute";
  status: CheckStatus;
  pointsDeducted: number;
  // Raw facts only (numbers/booleans/strings) — prose is built at render time
  // from these values, never stored here, so plain/technical copy can never
  // drift from what was actually verified.
  values: Record<string, string | number | boolean | null>;
}

export interface SeoChecks {
  checks: SeoCheck[];
  seoScore: number;
  isVerified: boolean;
}

export interface SeoFacts {
  hasHttps: boolean;
  title: string | null;
  titleLength: number;
  /** Title left at a framework/CMS default ("Home", "Create Next App", "Untitled"). */
  titleIsGeneric: boolean;
  metaDescription: string | null;
  metaDescriptionLength: number;
  viewportPresent: boolean;
  canonicalPresent: boolean;
  isVerified: boolean;

  /**
   * The combined `robots` + `googlebot` meta directives, verbatim. Note this cannot see
   * an `X-Robots-Tag` HTTP header, so a page can be de-indexed in a way we can't detect —
   * absence of noindex here is "no noindex in the HTML", not proof the page is indexable.
   */
  robotsDirectives: string | null;
  /** The single most damaging finding available from markup: invisible to search. */
  isNoindex: boolean;

  /** Open Graph tags — what a link to this page looks like when shared. */
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;

  /** The viewport tag's raw content, so the report can quote what's actually set. */
  viewportContent: string | null;
  /** `user-scalable=no` / `maximum-scale=1` — blocks pinch-zoom, a WCAG failure. */
  viewportBlocksZoom: boolean;

  /** `<html lang>` — screen readers use it to pick a pronunciation. */
  langAttribute: string | null;

  faviconPresent: boolean;
}

/**
 * Binary, because the old good/adequate/poor scale was the dominant remaining variance
 * source: "adequate" absorbed all uncertainty and the good/adequate line was pure taste.
 * "unclear" is not a middle grade — it is excluded from scoring entirely (see
 * computeCategoryScore), so hedging can neither help nor hurt a site's score.
 */
export type CriterionRating = "yes" | "no" | "unclear";

export interface CriterionResult {
  id: string;
  rating: CriterionRating;
  /** Short observation the rating is based on — forces grounding before judging. */
  evidence: string;
}

/**
 * One subjective category. The model supplies ratings for the AI-tier criteria and
 * contentChecks.ts supplies the code tier; `score` is computed from both in code, so no
 * number is ever invented.
 */
export interface CategoryAssessment {
  category: "design" | "trust" | "ux";
  score: number;
  criteria: CriterionResult[];
}

export interface Report {
  overallScore: number;
  firstImpression: string;
  plainFirstImpression: string;
  designScore: number;
  trustScore: number;
  uxScore: number;
  seoScore: number;
  seoChecks: SeoChecks;
  /** Per-criterion breakdown behind designScore/trustScore/uxScore. */
  assessments: CategoryAssessment[];
  modelUsed: GeminiModel;
  biggestProblems: Problem[];
  quickWins: ActionItem[];
  suggestions: ActionItem[];
}

export type ComparisonWinner = "yours" | "competitor" | "tie";

export interface SiteSummary {
  url: string;
  overallScore: number;
  firstImpression: string;
  plainFirstImpression: string;
  strengths: string[];
  plainStrengths: string[];
  weaknesses: string[];
  plainWeaknesses: string[];
}

export interface ComparisonCategory {
  category: "Design" | "Trust" | "UX" | "SEO";
  yourScore: number;
  competitorScore: number;
  winner: ComparisonWinner;
  verdict: string;
  plainVerdict: string;
}

export interface ComparisonReport {
  yours: SiteSummary;
  competitor: SiteSummary;
  categories: ComparisonCategory[];
  yourSeoChecks: SeoChecks;
  competitorSeoChecks: SeoChecks;
  overallWinner: ComparisonWinner;
  overallVerdict: string;
  plainOverallVerdict: string;
  topRecommendations: string[];
  plainTopRecommendations: string[];
  modelUsed: GeminiModel;
}
