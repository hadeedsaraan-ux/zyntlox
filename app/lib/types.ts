export interface Problem {
  issue: string;
  impact: "High" | "Medium" | "Low";
  effort: "Easy" | "Medium" | "Hard";
}

export interface Report {
  overallScore: number;
  firstImpression: string;
  designScore: number;
  trustScore: number;
  uxScore: number;
  seoScore: number;
  biggestProblems: Problem[];
  quickWins: string[];
  suggestions: string[];
}
