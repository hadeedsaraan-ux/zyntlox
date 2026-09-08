import { Report } from "./types";

export const sampleReport: Report = {
  overallScore: 40,
  firstImpression:
    "The page loads into a wall of dense text with no clear focal point — a visitor has to hunt for what the business actually sells before they've decided whether to stick around.",
  plainFirstImpression:
    "When someone lands on this page, they see a big block of text and can't tell what the business sells. Most people will just leave before figuring it out.",
  // Scores below are derived from the criteria in `assessments` (5/12, 4/12, 4/12),
  // and overallScore from those plus seoScore — same arithmetic the routes run.
  designScore: 4.2,
  trustScore: 3.3,
  uxScore: 3.3,
  seoScore: 5.9,
  modelUsed: "gemini-flash-latest",
  assessments: [
    {
      category: "design",
      score: 4.2,
      criteria: [
        { id: "hierarchy", rating: "poor", evidence: "no dominant element; three blocks compete" },
        { id: "spacing", rating: "poor", evidence: "text runs edge to edge, no margins" },
        { id: "typography", rating: "adequate", evidence: "readable but four sizes in use" },
        { id: "color", rating: "adequate", evidence: "muted palette, low contrast accents" },
        { id: "imagery", rating: "adequate", evidence: "product photos present, inconsistent crops" },
        { id: "consistency", rating: "good", evidence: "buttons share one style throughout" },
      ],
    },
    {
      category: "trust",
      score: 3.3,
      criteria: [
        { id: "contactInfo", rating: "poor", evidence: "no phone, email or address visible" },
        { id: "socialProof", rating: "poor", evidence: "no reviews or testimonials anywhere" },
        { id: "identity", rating: "adequate", evidence: "short About link in footer only" },
        { id: "polish", rating: "good", evidence: "no placeholder text or broken images" },
        { id: "transparency", rating: "poor", evidence: "pricing not shown before checkout" },
        { id: "legitimacy", rating: "adequate", evidence: "custom logo, otherwise stock layout" },
      ],
    },
    {
      category: "ux",
      score: 3.3,
      criteria: [
        { id: "navClarity", rating: "adequate", evidence: "menu present, vague labels" },
        { id: "primaryAction", rating: "poor", evidence: "main button sits below three scrolls" },
        { id: "valueClarity", rating: "poor", evidence: "cannot tell what is sold on arrival" },
        { id: "readability", rating: "good", evidence: "dark text on white, good contrast" },
        { id: "scannability", rating: "poor", evidence: "one long unbroken intro paragraph" },
        { id: "focus", rating: "adequate", evidence: "single column, but no clear path" },
      ],
    },
  ],
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
