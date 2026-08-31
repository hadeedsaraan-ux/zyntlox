export type ReportMode = "technical" | "plain";

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
