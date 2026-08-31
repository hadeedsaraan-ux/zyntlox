import { Report } from "./types";

export const sampleReport: Report = {
  overallScore: 42,
  firstImpression:
    "The page loads into a wall of dense text with no clear focal point — a visitor has to hunt for what the business actually sells before they've decided whether to stick around.",
  plainFirstImpression:
    "When someone lands on this page, they see a big block of text and can't tell what the business sells. Most people will just leave before figuring it out.",
  designScore: 4,
  trustScore: 3,
  uxScore: 5,
  seoScore: 6,
  biggestProblems: [
    {
      issue: "No HTTPS on the checkout flow — browsers flag it as 'Not Secure'.",
      plainIssue:
        "The checkout page isn't secure, so browsers show customers a scary 'Not Secure' warning right when they're about to pay.",
      impact: "High",
      effort: "Easy",
    },
    {
      issue: "Primary call-to-action is buried below three scrolls of copy.",
      plainIssue:
        "The main button you want visitors to click is hidden way down the page — most people won't scroll far enough to find it.",
      impact: "High",
      effort: "Medium",
    },
    {
      issue: "No customer reviews, testimonials, or contact info anywhere on the homepage.",
      plainIssue:
        "There's nothing on the homepage to make visitors trust the business — no reviews, no customer quotes, no way to contact anyone.",
      impact: "Medium",
      effort: "Medium",
    },
  ],
  quickWins: [
    "Move the 'Get Started' button above the fold.",
    "Add alt text to the 12 product images currently missing it.",
    "Compress the hero image — it's 4.2MB and slowing the whole page down.",
  ],
  plainQuickWins: [
    "Move the main 'Get Started' button so it's visible without scrolling.",
    "Add short descriptions to the 12 product photos that are missing them.",
    "Shrink the big banner image at the top — it's huge and making the page slow to load.",
  ],
  suggestions: [
    "Add a visible trust signal (reviews, security badges, or a phone number) near the CTA.",
    "Break up the long intro paragraph into scannable bullet points.",
    "Set up a redirect from HTTP to HTTPS site-wide.",
  ],
  plainSuggestions: [
    "Put something trustworthy — reviews, a security badge, or a phone number — right next to the main button.",
    "Turn the long opening paragraph into a few short bullet points people can skim.",
    "Make sure every page automatically loads the secure, locked version.",
  ],
};

export const sampleUrl = "cratewood-furniture.com";
