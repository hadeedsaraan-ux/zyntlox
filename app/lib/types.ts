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
  h1Count: number;
  viewportPresent: boolean;
  canonicalPresent: boolean;
  totalImages: number;
  imagesWithAlt: number;
  imagesWithoutAlt: number;
  isVerified: boolean;
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
