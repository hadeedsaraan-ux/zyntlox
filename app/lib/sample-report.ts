import { PRIMARY_MODEL } from "./gemini";
import { computeContentChecks } from "./contentChecks";
import { computeOverallScore, parseAssessments, scoreOf } from "./scoring";
import { computeSeoAudit } from "./seoAudit";
import { CriterionRating, Report, SeoFacts } from "./types";

/**
 * The demo report shown on the landing page.
 *
 * Nothing here is hand-computed. The sample's raw inputs — head metadata, page markdown,
 * and the model's criterion answers — are run through the SAME functions production uses
 * (computeSeoAudit, computeContentChecks, parseAssessments, computeOverallScore). A
 * hardcoded demo drifted from real scoring every time a weight or criterion changed;
 * deriving it means the marketing page can never show arithmetic the product wouldn't.
 */

const SAMPLE_FACTS: SeoFacts = {
  hasHttps: false,
  title: "Bella's Artisan Bakery — Fresh Sourdough Daily",
  titleLength: 47,
  titleIsGeneric: false,
  metaDescription:
    "Small-batch sourdough, pastries and celebration cakes baked fresh every morning in Fitzroy.",
  metaDescriptionLength: 91,
  metaDescriptionIsGeneric: false,
  viewportPresent: true,
  viewportContent: "width=device-width, initial-scale=1",
  viewportBlocksZoom: false,
  canonicalPresent: false,
  isVerified: true,
  robotsDirectives: null,
  isNoindex: false,
  ogTitle: null,
  ogDescription: null,
  ogImage: null,
  langAttribute: "en",
  faviconPresent: false,
  // No live browser behind the sample data — matches the raw-fetch path's "cannot know
  // this at all" state, exercised the same way a real unverified report would be.
  h1Count: null,
  domImages: null,
};

/** Stands in for the scraper's markdown, so the code-tier checks run for real. */
const SAMPLE_MARKDOWN = `Bella's Artisan Bakery
======================

Handmade in Fitzroy since 2009

*   [Home](/)
*   [Shop](/shop)
*   [About us](/about)
*   [Contact](/contact)

Real bread takes time. Every loaf we sell is mixed, folded and proved by hand over
two days, then baked in a stone deck oven before the shop opens. We mill a portion of
our own flour and use nothing but flour, water, salt and a starter that has been going
since the day we opened.

## Our breads

Country sourdough, seeded rye, baguettes and a Friday-only olive loaf. Loaves start at
$8.50 and we bake until we sell out, which on weekends is usually before noon.

## Celebration cakes

We take a small number of custom cake orders each week — birthdays, weddings and
christenings. Every cake is quoted individually depending on size and decoration, and we
ask for at least two weeks' notice so we can talk through what you want.

## Wholesale

We supply a handful of cafes around the inner north with bread and pastries each morning.

[Order online](/shop)
`;

/**
 * The model's answers for the AI-tier criteria, in the shape Gemini returns them.
 * Deliberately a mediocre-but-not-terrible site: enough strengths to be believable,
 * enough failures to make the report worth reading.
 */
const rate = (rating: CriterionRating, evidence: string) => ({ rating, evidence });

const SAMPLE_AI_ANSWERS = {
  design: {
    focalPoint: rate("no", "business name and intro compete equally"),
    alignment: rate("yes", "content sits on one consistent column"),
    sectionBoundaries: rate("no", "sections run together without dividers"),
    contentWidth: rate("yes", "held to a central column"),
    aboveFoldPurpose: rate("yes", "name, tagline and menu at the top"),
    breathingRoom: rate("no", "text runs close to the page edges"),
    spacingConsistency: rate("yes", "section gaps look evenly sized"),
    noDeadSpace: rate("yes", "no large unexplained empty regions"),
    verticalRhythm: rate("no", "even gaps above and below headings"),
    fontRestraint: rate("no", "four typefaces visible across the page"),
    headingContrast: rate("yes", "headings clearly larger than body"),
    lineLength: rate("no", "paragraphs span the full window width"),
    textAlignment: rate("no", "intro paragraph is centred"),
    capsRestraint: rate("yes", "no shouting capitals"),
    fontSizeSteps: rate("yes", "three clear text sizes"),
    paletteRestraint: rate("yes", "cream, brown and one accent"),
    textContrast: rate("no", "light grey captions on white"),
    accentPurpose: rate("yes", "accent used only on the order link"),
    backgroundRestraint: rate("yes", "plain backgrounds behind all text"),
    imageQuality: rate("yes", "loaf photographs are sharp"),
    imageConsistency: rate("no", "crops and lighting vary between shots"),
    imageRelevance: rate("yes", "photos show the actual bread"),
    imagePresence: rate("yes", "several product photographs"),
    buttonStyling: rate("yes", "nav items read as clickable"),
    buttonConsistency: rate("yes", "nav items share one style"),
    buttonHierarchy: rate("no", "order link styled like every other link"),
    linkAffordance: rate("yes", "links are underlined"),
    navPlacement: rate("yes", "menu across the top"),
    navSeparation: rate("yes", "menu sits on its own bar"),
    logoPlacement: rate("yes", "name top-left where expected"),
    footerPresent: rate("yes", "distinct footer area"),
    footerOrganised: rate("no", "footer is one undivided run of links"),
    pageEndsCleanly: rate("yes", "nothing cut off at the bottom"),
    componentConsistency: rate("yes", "section blocks share one layout"),
    iconConsistency: rate("yes", "icons share one style"),
    cornerConsistency: rate("yes", "consistent rounding throughout"),
  },
  trust: {
    customLogo: rate("yes", "hand-drawn wordmark in the header"),
    distinctBranding: rate("no", "unmodified theme layout"),
    consistentIdentity: rate("yes", "name written the same way throughout"),
    testimonialsPresent: rate("no", "no reviews or quotes anywhere"),
    namedAttribution: rate("unclear", "no testimonials present to attribute"),
    testimonialSpecific: rate("unclear", "no testimonials present"),
    testimonialPhoto: rate("unclear", "no testimonials present"),
    credibilityMarkers: rate("no", "no awards, press or certifications"),
    socialProofQuantity: rate("no", "no customer or year counts given"),
    noPlaceholder: rate("yes", "no lorem ipsum or template text"),
    noBrokenMedia: rate("yes", "all images load correctly"),
    writingQuality: rate("yes", "copy is clean and error-free"),
    professionalTone: rate("yes", "reads as deliberately written"),
    noLayoutBreakage: rate("yes", "nothing overlaps or spills"),
    expectationsSet: rate("no", "no pickup or lead times stated"),
    offerSpecific: rate("yes", "names two-day prove and stone oven"),
    noDarkPatterns: rate("yes", "no countdowns or forced urgency"),
    claimsSupported: rate("no", "handmade claim has no supporting detail"),
    realPhotography: rate("unclear", "no people shown anywhere"),
    contentFreshness: rate("yes", "current copyright year"),
    teamVisible: rate("no", "no named people behind the bakery"),
    premisesOrProcess: rate("no", "no photos of the shop or baking"),
  },
  ux: {
    navVisible: rate("yes", "four-item menu across the top"),
    navLabelsPlain: rate("yes", "Home, Shop, About us, Contact"),
    navScannable: rate("yes", "only four top-level items"),
    searchVisible: rate("unclear", "small site, search may not be needed"),
    currentLocationClear: rate("no", "menu does not mark the current page"),
    ctaAboveFold: rate("no", "order link sits at the page bottom"),
    ctaDistinct: rate("no", "order link styled as plain text"),
    singleDominantAction: rate("no", "no action stands out over others"),
    ctaRepeated: rate("no", "order link appears only once"),
    ctaCopySpecific: rate("yes", "button reads 'Order online'"),
    valueInFiveSeconds: rate("yes", "bakery and breads named immediately"),
    headlineStatesValue: rate("no", "headline is the business name only"),
    audienceIdentifiable: rate("yes", "local shoppers and cafes"),
    differentiationClear: rate("no", "nothing says why here over another bakery"),
    bodyTextSize: rate("yes", "body copy comfortably sized"),
    textChunking: rate("no", "long unbroken opening paragraph"),
    scanableStructure: rate("yes", "three headings break up the page"),
    noIntrusiveOverlay: rate("yes", "no popups or cookie wall"),
    noAutoplayMedia: rate("yes", "nothing moves on its own"),
    notOverwhelming: rate("yes", "calm single-column layout"),
    noAdClutter: rate("yes", "no advertising blocks"),
    touchTargetSize: rate("no", "menu items are small, tightly packed text"),
    contentFitsWidth: rate("yes", "nothing runs off the side"),
  },
};

const sampleSeoChecks = computeSeoAudit(SAMPLE_FACTS);
// Matches sampleUrl (declared below) with a scheme added — hostnameOf() needs an
// absolute URL to parse, and the exported display string is deliberately bare.
const sampleContentChecks = computeContentChecks(SAMPLE_MARKDOWN, {
  siteUrl: "https://bellas-artisan-bakery.com",
});

const sampleAssessments = parseAssessments(SAMPLE_AI_ANSWERS, sampleContentChecks);
if (!sampleAssessments) {
  // Only reachable if a criterion is added without a corresponding sample answer, which
  // would otherwise ship a landing page whose demo silently fails to render.
  throw new Error(
    "sample-report: SAMPLE_AI_ANSWERS no longer covers enough criteria to score. Add the missing ids."
  );
}

const SAMPLE_DESIGN = scoreOf(sampleAssessments, "design");
const SAMPLE_TRUST = scoreOf(sampleAssessments, "trust");
const SAMPLE_UX = scoreOf(sampleAssessments, "ux");

export const sampleReport: Report = {
  overallScore: computeOverallScore(
    SAMPLE_DESIGN,
    SAMPLE_TRUST,
    SAMPLE_UX,
    sampleSeoChecks.seoScore
  ),
  firstImpression:
    "The page opens with the business name and a paragraph about process — a visitor has to read three sentences before learning that bread is for sale, and the order link is buried at the very bottom.",
  plainFirstImpression:
    "The top of the page talks about how the bread is made instead of saying you can buy it. The 'Order online' link is right at the bottom, where most people will never scroll.",
  designScore: SAMPLE_DESIGN,
  trustScore: SAMPLE_TRUST,
  uxScore: SAMPLE_UX,
  seoScore: sampleSeoChecks.seoScore,
  // The primary, so the sample never shows a "backup model was busy" notice.
  modelUsed: PRIMARY_MODEL,
  assessments: sampleAssessments,
  seoChecks: sampleSeoChecks,
  biggestProblems: [
    {
      issue: "No HTTPS — browsers flag the site as 'Not Secure' before anyone reads a word.",
      plainIssue:
        "Your site isn't secure, so browsers show visitors a 'Not Secure' warning as soon as they arrive.",
      impact: "High",
      effort: "Easy",
    },
    {
      issue: "The primary call-to-action sits below three sections of copy.",
      plainIssue:
        "The 'Order online' link is at the very bottom of the page — most people won't scroll far enough to find it.",
      impact: "High",
      effort: "Medium",
    },
    {
      issue: "No social proof anywhere — no reviews, ratings, or customer quotes.",
      plainIssue:
        "There's nothing from past customers on the page, so a first-time visitor has only your word to go on.",
      impact: "Medium",
      effort: "Medium",
    },
  ],
  quickWins: [
    {
      text: "Lead with the offer — the headline is the business name, not what you sell.",
      plainText:
        "Change the big text at the top to say what you sell, instead of just the bakery's name.",
      snippet: null,
    },
    {
      text: "Move 'Order online' above the fold and style it as a button.",
      plainText:
        "Move the 'Order online' link to the top of the page and make it look like a button.",
      snippet: {
        language: "css",
        code: ".order-link {\n  display: inline-block;\n  padding: 12px 24px;\n  background: #b45309;\n  color: #ffffff;\n  border-radius: 6px;\n  font-weight: 600;\n}",
      },
    },
    {
      text: "Break the opening paragraph into two or three shorter ones.",
      plainText:
        "Split the long paragraph at the top into a couple of shorter ones so it's easier to read.",
      snippet: null,
    },
  ],
  suggestions: [
    {
      text: "Add three customer quotes with names near the top of the page.",
      plainText:
        "Ask three regulars for a sentence about your bread and put them near the top, with their first names.",
      snippet: null,
    },
    {
      text: "Darken the caption text — light grey on white fails WCAG AA contrast.",
      plainText:
        "Make the small grey text darker so people can actually read it against the white background.",
      snippet: {
        language: "css",
        code: ".caption {\n  color: #3f3f46;\n}",
      },
    },
    {
      text: "State pickup and custom-order lead times so expectations are set before contact.",
      plainText:
        "Say how long a custom cake takes and when bread is ready for pickup, so people know what to expect.",
      snippet: null,
    },
  ],
};

export const sampleUrl = "bellas-artisan-bakery.com";
