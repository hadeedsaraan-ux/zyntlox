import { Report } from "./types";

export const sampleReport: Report = {
  overallScore: 42,
  firstImpression:
    "The page loads into a wall of dense text with no clear focal point — a visitor has to hunt for what the business actually sells before they've decided whether to stick around.",
  designScore: 4,
  trustScore: 3,
  uxScore: 5,
  seoScore: 6,
  biggestProblems: [
    {
      issue: "No HTTPS on the checkout flow — browsers flag it as 'Not Secure'.",
      impact: "High",
      effort: "Easy",
    },
    {
      issue: "Primary call-to-action is buried below three scrolls of copy.",
      impact: "High",
      effort: "Medium",
    },
    {
      issue: "No customer reviews, testimonials, or contact info anywhere on the homepage.",
      impact: "Medium",
      effort: "Medium",
    },
  ],
  quickWins: [
    "Move the 'Get Started' button above the fold.",
    "Add alt text to the 12 product images currently missing it.",
    "Compress the hero image — it's 4.2MB and slowing the whole page down.",
  ],
  suggestions: [
    "Add a visible trust signal (reviews, security badges, or a phone number) near the CTA.",
    "Break up the long intro paragraph into scannable bullet points.",
    "Set up a redirect from HTTP to HTTPS site-wide.",
  ],
};

export const sampleUrl = "cratewood-furniture.com";
