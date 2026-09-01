import { Report, ReportMode } from "./types";

export const LABELS: Record<
  ReportMode,
  {
    firstImpression: string;
    design: string;
    trust: string;
    ux: string;
    seo: string;
    biggestProblems: string;
    quickWins: string;
    suggestions: string;
  }
> = {
  technical: {
    firstImpression: "First Impression",
    design: "Design",
    trust: "Trust",
    ux: "UX",
    seo: "SEO",
    biggestProblems: "Biggest Problems",
    quickWins: "Quick Wins",
    suggestions: "AI Suggestions",
  },
  plain: {
    firstImpression: "What Visitors See",
    design: "Looks",
    trust: "Trustworthiness",
    ux: "Ease of Use",
    seo: "Found on Google?",
    biggestProblems: "What's Hurting You",
    quickWins: "Easy Fixes",
    suggestions: "What To Do Next",
  },
};

export const IMPACT_LABELS: Record<
  ReportMode,
  Record<Report["biggestProblems"][number]["impact"], string>
> = {
  technical: { High: "High", Medium: "Medium", Low: "Low" },
  plain: { High: "Big Deal", Medium: "Worth Fixing", Low: "Minor" },
};

export const EFFORT_LABELS: Record<
  ReportMode,
  Record<Report["biggestProblems"][number]["effort"], string>
> = {
  technical: { Easy: "Easy", Medium: "Medium", Hard: "Hard" },
  plain: { Easy: "Quick Fix", Medium: "Some Work", Hard: "Bigger Project" },
};
