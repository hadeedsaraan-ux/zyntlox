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

export interface Report {
  overallScore: number;
  firstImpression: string;
  plainFirstImpression: string;
  designScore: number;
  trustScore: number;
  uxScore: number;
  seoScore: number;
  biggestProblems: Problem[];
  quickWins: string[];
  plainQuickWins: string[];
  suggestions: string[];
  plainSuggestions: string[];
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
  overallWinner: ComparisonWinner;
  overallVerdict: string;
  plainOverallVerdict: string;
  topRecommendations: string[];
  plainTopRecommendations: string[];
}
