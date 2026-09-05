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
  seoScore: 5.9,
  modelUsed: "gemini-flash-latest",
  seoChecks: {
    isVerified: true,
    seoScore: 5.9,
    checks: [
      {
        id: "https",
        status: "fail",
        pointsDeducted: 3.0,
        values: { hasHttps: false },
      },
      {
        id: "metaDescription",
        status: "pass",
        pointsDeducted: 0,
        values: { present: true, length: 120 },
      },
      {
        id: "title",
        status: "pass",
        pointsDeducted: 0,
        values: { present: true, length: 50 },
      },
      {
        id: "h1",
        status: "pass",
        pointsDeducted: 0,
        values: { count: 1 },
      },
      {
        id: "viewport",
        status: "pass",
        pointsDeducted: 0,
        values: { present: true },
      },
      {
        id: "canonical",
        status: "fail",
        pointsDeducted: 0.5,
        values: { present: false },
      },
      {
        id: "altText",
        status: "warn",
        pointsDeducted: 0.6,
        values: { totalImages: 20, imagesWithAlt: 8, imagesWithoutAlt: 12 },
      },
    ],
  },
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
    {
      text: "Move the 'Get Started' button above the fold.",
      plainText: "Move the main 'Get Started' button so it's visible without scrolling.",
      snippet: null,
    },
    {
      text: "Add alt text to the 12 product images currently missing it.",
      plainText: "Add short descriptions to the 12 product photos that are missing them.",
      snippet: {
        language: "html",
        code: '<img src="oak-dining-table.jpg" alt="Solid oak dining table, seats six, natural finish">',
      },
    },
    {
      text: "Compress the hero image — it's 4.2MB and slowing the whole page down.",
      plainText:
        "Shrink the big banner image at the top — it's huge and making the page slow to load.",
      snippet: null,
    },
  ],
  suggestions: [
    {
      text: "Add a visible trust signal (reviews, security badges, or a phone number) near the CTA.",
      plainText:
        "Put something trustworthy — reviews, a security badge, or a phone number — right next to the main button.",
      snippet: null,
    },
    {
      text: "Break up the long intro paragraph into scannable bullet points.",
      plainText: "Turn the long opening paragraph into a few short bullet points people can skim.",
      snippet: null,
    },
    {
      text: "Increase contrast on the hero text — light grey on white fails WCAG AA.",
      plainText: "Make the big headline text darker so it's easier to read against the white background.",
      snippet: {
        language: "css",
        code: ".hero-text {\n  color: #1a1a1a;\n  background: #ffffff;\n}",
      },
    },
  ],
};

export const sampleUrl = "cratewood-furniture.com";
