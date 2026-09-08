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

export type GeminiModel = "gemini-flash-latest" | "gemini-flash-lite-latest";

/** A single element of the Gemini `contents[0].parts` array. */
export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export type CheckStatus = "pass" | "warn" | "fail";

export interface SeoCheck {
  id:
    | "https"
    | "metaDescription"
    | "title"
    | "h1"
    | "viewport"
    | "canonical"
    | "altText";
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
  metaDescription: string | null;
  metaDescriptionLength: number;
  /** H1 elements that actually contain text. */
  h1Count: number;
  /**
   * H1 elements present in the DOM, text-bearing or not. Distinguishes "no H1 at all"
   * from "an H1 that holds only a logo image" — reporting the latter as "no H1 found"
   * is a false claim.
   */
  h1ElementCount: number;
  viewportPresent: boolean;
  canonicalPresent: boolean;
  totalImages: number;
  imagesWithAlt: number;
  imagesWithoutAlt: number;
  isVerified: boolean;
}

export type CriterionRating = "good" | "adequate" | "poor";

export interface CriterionResult {
  id: string;
  rating: CriterionRating;
  /** Short observation the rating is based on — forces grounding before judging. */
  evidence: string;
}

/**
 * One subjective category. The model supplies `criteria` (observations); `score` is
 * computed from them in code, so it never invents a number.
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
