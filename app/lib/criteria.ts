import { CriterionResult, ReportMode } from "./types";

/**
 * Canonical definition of every criterion, in ONE place.
 *
 * History of this file explains its shape. The original prompt asked for
 * `"designScore": <number 0-10>` with no definition, leaving the model to improvise an
 * 11-way choice each run; measured spread on a frozen input was 21 points of
 * overallScore, and temperature had no effect on it. Replacing that with 18 criteria
 * rated good/adequate/poor helped but did not fix it, because:
 *
 *   - "adequate" is a dumping ground — it is where uncertainty goes, and the
 *     good/adequate boundary is pure taste.
 *   - The questions asked for quality judgments ("is the typography good?") rather than
 *     observations ("are there 3 or fewer typefaces?"). Only the latter has an answer.
 *   - With six criteria per category, one rating flipping moved a category score by
 *     0.83 points — about 2.1 points of overallScore. Small disagreements, large swings.
 *
 * So every criterion here is now a BINARY, OBSERVABLE question answered yes/no/unclear,
 * and there are enough of them that no single flip dominates (one flip in a 15-criterion
 * category moves it 0.33 points instead of 0.83).
 *
 * Two tiers, declared per criterion by `source`:
 *   - source "code"  — answered deterministically by contentChecks.ts. Zero variance.
 *                      Never sent to the model.
 *   - everything else — answered by the model from the input named in `source`.
 *
 * The prompt schema, the code tier, and the report UI are all generated from this list,
 * so a criterion can never exist in one and not the others.
 */

/** Which input actually answers the question. Asserted at module load (see below). */
export type CriterionSource = "screenshot" | "markdown" | "both" | "code";

export interface CriterionDef {
  id: string;
  /** Section heading in the report, and a grouping hint in the prompt. */
  subgroup: string;
  source: CriterionSource;
  /**
   * Asked of the model verbatim (except for `code` criteria, where it documents what
   * contentChecks.ts implements). MUST be answerable yes/no from `source` alone.
   */
  question: string;
  technical: string;
  plain: string;
  /** Relative importance within its category. Defaults to 1; use 2 sparingly. */
  weight?: number;
}

// ---------------------------------------------------------------------------
// DESIGN — entirely visual, so entirely screenshot-answered.
// ---------------------------------------------------------------------------

export const DESIGN_CRITERIA: CriterionDef[] = [
  {
    id: "focalPoint",
    subgroup: "Layout & hierarchy",
    source: "screenshot",
    question:
      "In the first screenful, is a single headline or image visibly larger than everything else around it — not two or more of equal size?",
    technical: "Single focal point",
    plain: "One thing grabs your eye first",
    weight: 2,
  },
  {
    id: "alignment",
    subgroup: "Layout & hierarchy",
    source: "screenshot",
    question:
      "Do elements line up on a consistent grid, with edges and columns aligned rather than visibly ragged?",
    technical: "Grid alignment",
    plain: "Things line up neatly",
  },
  {
    id: "sectionBoundaries",
    subgroup: "Layout & hierarchy",
    source: "screenshot",
    question:
      "Are distinct sections visually separated by spacing, background changes or dividers, rather than running together?",
    technical: "Section separation",
    plain: "Sections are easy to tell apart",
  },
  {
    id: "breathingRoom",
    subgroup: "Spacing & rhythm",
    source: "screenshot",
    question:
      "Do text blocks and images have clear margins around them, rather than crowding the edges of the page or each other?",
    technical: "Breathing room",
    plain: "Nothing feels cramped",
  },
  {
    id: "spacingConsistency",
    subgroup: "Spacing & rhythm",
    source: "screenshot",
    question:
      "Are the gaps between comparable sections roughly equal, rather than varying at random down the page?",
    technical: "Spacing consistency",
    plain: "Even gaps throughout",
  },
  {
    id: "noDeadSpace",
    subgroup: "Spacing & rhythm",
    source: "screenshot",
    question:
      "Is the layout free of large empty regions that serve no apparent purpose?",
    technical: "No dead space",
    plain: "No awkward empty patches",
  },
  {
    id: "fontRestraint",
    subgroup: "Typography",
    source: "screenshot",
    question: "Are three or fewer distinct typefaces visible on the page?",
    technical: "Typeface restraint",
    plain: "Not too many different fonts",
  },
  {
    id: "headingContrast",
    subgroup: "Typography",
    source: "screenshot",
    question:
      "Are headings clearly larger or heavier than body text, so the hierarchy is obvious at a glance?",
    technical: "Heading contrast",
    plain: "Headings stand out from text",
  },
  {
    id: "lineLength",
    subgroup: "Typography",
    source: "screenshot",
    question:
      "Do paragraphs run at a comfortable reading width, rather than stretching the full width of the window?",
    technical: "Line length",
    plain: "Text lines aren't too wide",
  },
  {
    id: "paletteRestraint",
    subgroup: "Colour & contrast",
    source: "screenshot",
    question:
      "Does the page use a limited, deliberate palette — roughly four or fewer dominant colours — rather than many unrelated ones?",
    technical: "Palette restraint",
    plain: "Colours look chosen, not random",
  },
  {
    id: "textContrast",
    subgroup: "Colour & contrast",
    source: "screenshot",
    question:
      "Is body text clearly legible against its background everywhere it appears, with no light-grey-on-white or text-over-busy-image passages?",
    technical: "Text contrast",
    plain: "Text is easy to see against its background",
    weight: 2,
  },
  {
    id: "accentPurpose",
    subgroup: "Colour & contrast",
    source: "screenshot",
    question:
      "Is there an accent colour reserved for buttons and links, rather than applied decoratively at random?",
    technical: "Purposeful accent colour",
    plain: "Bright colours mean something",
  },
  {
    id: "imageQuality",
    subgroup: "Imagery & media",
    source: "screenshot",
    question:
      "Are the images sharp and correctly proportioned, rather than blurry, pixelated or stretched out of shape?",
    technical: "Image quality",
    plain: "Photos are sharp, not squashed",
  },
  {
    id: "imageConsistency",
    subgroup: "Imagery & media",
    source: "screenshot",
    question:
      "Do the images share a consistent treatment — similar crop, tone or style — rather than looking assembled from different sources?",
    technical: "Image consistency",
    plain: "Photos look like a set",
  },
  {
    id: "imageRelevance",
    subgroup: "Imagery & media",
    source: "screenshot",
    question:
      "Do the images show the actual product, work, people or premises, rather than generic stock photography?",
    technical: "Image relevance",
    plain: "Real photos, not generic stock",
  },
];

// ---------------------------------------------------------------------------
// TRUST — the most code-checkable category, because most credibility signals are
// links and text rather than looks.
// ---------------------------------------------------------------------------

export const TRUST_CRITERIA: CriterionDef[] = [
  // --- code tier ---
  {
    id: "contactEmail",
    subgroup: "Contact & location",
    source: "code",
    question: "Is an email address or mailto: link present on the page?",
    technical: "Email address",
    plain: "An email address to reach you",
  },
  {
    id: "contactPhone",
    subgroup: "Contact & location",
    source: "code",
    question: "Is a phone number or tel: link present on the page?",
    technical: "Phone number",
    plain: "A phone number to call",
  },
  {
    id: "contactRoute",
    subgroup: "Contact & location",
    source: "code",
    question: "Is there a link to a contact page or contact form?",
    technical: "Contact route",
    plain: "A way to get in touch",
    weight: 2,
  },
  {
    id: "physicalAddress",
    subgroup: "Contact & location",
    source: "code",
    question: "Is a physical or postal address present?",
    technical: "Physical address",
    plain: "A real-world address",
  },
  {
    id: "aboutPage",
    subgroup: "Identity & branding",
    source: "code",
    question: "Is there a link to an About, team, or company-story page?",
    technical: "About page",
    plain: "A page saying who you are",
  },
  {
    id: "privacyPolicy",
    subgroup: "Transparency",
    source: "code",
    question: "Is there a link to a privacy policy?",
    technical: "Privacy policy",
    plain: "A privacy policy link",
  },
  {
    id: "termsPage",
    subgroup: "Transparency",
    source: "code",
    question: "Is there a link to terms of service, terms and conditions, or similar?",
    technical: "Terms page",
    plain: "A terms and conditions link",
  },
  {
    id: "pricingSignals",
    subgroup: "Transparency",
    source: "code",
    question:
      "Are there pricing signals — currency amounts, or a link to a pricing or plans page?",
    technical: "Pricing signals",
    plain: "Some sign of what it costs",
  },
  {
    id: "socialPresence",
    subgroup: "Credibility signals",
    source: "code",
    question: "Is there at least one link to an established social media profile?",
    technical: "Social profiles",
    plain: "Links to your social media",
  },
  {
    id: "copyrightCurrent",
    subgroup: "Credibility signals",
    source: "code",
    question: "Is a copyright year present, and within one year of the current year?",
    technical: "Current copyright year",
    plain: "Footer year isn't out of date",
  },

  // --- AI tier ---
  {
    id: "customLogo",
    subgroup: "Identity & branding",
    source: "screenshot",
    question:
      "Is there a custom logo or designed wordmark, rather than a placeholder graphic or the business name in a default font?",
    technical: "Custom logo",
    plain: "A proper logo",
  },
  {
    id: "distinctBranding",
    subgroup: "Identity & branding",
    source: "screenshot",
    question:
      "Does the design look bespoke, rather than an unmodified off-the-shelf template with the demo content swapped out?",
    technical: "Distinct branding",
    plain: "Doesn't look like a default template",
  },
  {
    id: "testimonialsPresent",
    subgroup: "Social proof",
    source: "both",
    question:
      "Are there testimonials, reviews, ratings or customer quotes anywhere on the page?",
    technical: "Testimonials or reviews",
    plain: "What customers say about you",
    weight: 2,
  },
  {
    id: "namedAttribution",
    subgroup: "Social proof",
    source: "both",
    question:
      "Do the testimonials or quotes carry a real name, role or company, rather than being anonymous? If the page has no testimonials at all, answer \"unclear\".",
    technical: "Attributed social proof",
    plain: "Reviews have real names on them",
  },
  {
    id: "credibilityMarkers",
    subgroup: "Social proof",
    source: "screenshot",
    question:
      "Are there client logos, press mentions, certifications, awards or membership badges shown?",
    technical: "Credibility markers",
    plain: "Logos, badges or press mentions",
  },
  {
    id: "noPlaceholder",
    subgroup: "Production polish",
    source: "both",
    question:
      "Is the page free of placeholder content such as 'Lorem ipsum', 'Your text here', 'Coming soon', or an unedited template heading?",
    technical: "No placeholder content",
    plain: "No leftover dummy text",
    weight: 2,
  },
  {
    id: "noBrokenMedia",
    subgroup: "Production polish",
    source: "screenshot",
    question:
      "Is the page free of broken images, missing-image icons, and empty media frames?",
    technical: "No broken media",
    plain: "No broken pictures",
  },
  {
    id: "writingQuality",
    subgroup: "Production polish",
    source: "markdown",
    question: "Is the copy free of obvious spelling and grammar errors?",
    technical: "Writing quality",
    plain: "No spelling mistakes",
  },
  {
    id: "expectationsSet",
    subgroup: "Transparency",
    source: "markdown",
    question:
      "Does the page explain what happens after someone acts — delivery, response time, process, or next steps?",
    technical: "Expectations set",
    plain: "Explains what happens next",
  },
  {
    id: "offerSpecific",
    subgroup: "Transparency",
    source: "markdown",
    question:
      "Does the page make specific, checkable claims, rather than relying only on vague superlatives like 'best' and 'leading'?",
    technical: "Specific claims",
    plain: "Says real specifics, not just buzzwords",
  },
  {
    id: "noDarkPatterns",
    subgroup: "Transparency",
    source: "screenshot",
    question:
      "Is the page free of manipulative pressure tactics such as fake countdown timers, fabricated scarcity, or guilt-worded decline buttons?",
    technical: "No dark patterns",
    plain: "No pushy sales tricks",
  },
  {
    id: "realPhotography",
    subgroup: "Credibility signals",
    source: "screenshot",
    question:
      "Where people are shown, do they appear to be the actual team or real customers, rather than obvious stock models? If no people are shown anywhere, answer \"unclear\".",
    technical: "Authentic photography",
    plain: "Real people, not stock models",
  },
  {
    id: "contentFreshness",
    subgroup: "Credibility signals",
    source: "markdown",
    question:
      "Is there a sign the site is actively maintained — recent dates, current-year references, or evidently fresh content?",
    technical: "Content freshness",
    plain: "Looks recently updated",
  },
  {
    id: "professionalTone",
    subgroup: "Production polish",
    source: "markdown",
    question:
      "Does the copy read as deliberately written and edited, rather than hasty, inconsistent, or machine-generated?",
    technical: "Professional tone",
    plain: "Writing sounds professional",
  },
  {
    id: "consistentIdentity",
    subgroup: "Identity & branding",
    source: "both",
    question:
      "Is the business name presented consistently everywhere it appears, with no variant spellings or leftover alternate names?",
    technical: "Consistent identity",
    plain: "Business name used consistently",
  },
];

// ---------------------------------------------------------------------------
// UX
// ---------------------------------------------------------------------------

export const UX_CRITERIA: CriterionDef[] = [
  // --- code tier ---
  {
    id: "headingStructure",
    subgroup: "Readability",
    source: "code",
    question: "Does the page contain at least two headings?",
    technical: "Heading structure",
    plain: "Content is broken up by headings",
  },
  {
    id: "headingHierarchy",
    subgroup: "Readability",
    source: "code",
    question: "Does the page use more than one heading level, giving it a real hierarchy?",
    technical: "Heading hierarchy",
    plain: "Headings and sub-headings",
  },
  {
    id: "contentDepth",
    subgroup: "Value clarity",
    source: "code",
    question: "Does the page have enough content to be useful (at least 150 words)?",
    technical: "Content depth",
    plain: "Enough content to be useful",
  },
  {
    id: "ctaLinkPresent",
    subgroup: "Conversion path",
    source: "code",
    question:
      "Is there at least one link whose text reads as an action — get started, buy, book, sign up, contact, request a quote?",
    technical: "Action link present",
    plain: "A button that asks you to do something",
  },
  {
    id: "linkDensity",
    subgroup: "Friction & distraction",
    source: "code",
    question:
      "Is there enough prose relative to links — at least four words of content per link — rather than the page being mostly a link dump?",
    technical: "Link density",
    plain: "Not just a wall of links",
  },

  // --- AI tier ---
  {
    id: "navVisible",
    subgroup: "Navigation",
    source: "screenshot",
    question: "Is there a visible navigation menu in the top area of the page?",
    technical: "Visible navigation",
    plain: "A menu you can see",
    weight: 2,
  },
  {
    id: "navLabelsPlain",
    subgroup: "Navigation",
    source: "both",
    question:
      "Are the navigation labels plain and descriptive, rather than clever, abstract or ambiguous?",
    technical: "Plain navigation labels",
    plain: "Menu items say what they are",
  },
  {
    id: "navScannable",
    subgroup: "Navigation",
    source: "screenshot",
    question:
      "Does the top-level navigation hold a manageable number of items — roughly seven or fewer — rather than overwhelming the visitor?",
    technical: "Scannable navigation",
    plain: "Menu isn't overloaded",
  },
  {
    id: "ctaAboveFold",
    subgroup: "Conversion path",
    source: "screenshot",
    question:
      "Is there a clear call-to-action button visible in the first screenful, without scrolling?",
    technical: "CTA above the fold",
    plain: "A clear button without scrolling",
    weight: 2,
  },
  {
    id: "ctaDistinct",
    subgroup: "Conversion path",
    source: "screenshot",
    question:
      "Does the primary call-to-action stand out visually from the elements around it, through colour, size or placement?",
    technical: "CTA visual prominence",
    plain: "The main button stands out",
  },
  {
    id: "singleDominantAction",
    subgroup: "Conversion path",
    source: "screenshot",
    question:
      "In the first screenful, is exactly one button styled more prominently (filled or coloured) than every other button?",
    technical: "Single dominant action",
    plain: "One clear next step",
  },
  {
    id: "valueInFiveSeconds",
    subgroup: "Value clarity",
    source: "both",
    question:
      "Could a first-time visitor tell what this site offers within five seconds of looking at the top of the page?",
    technical: "Five-second value clarity",
    plain: "Obvious what you do, fast",
    weight: 2,
  },
  {
    id: "headlineStatesValue",
    subgroup: "Value clarity",
    source: "markdown",
    question:
      "Does the main headline describe what is actually offered, rather than being a slogan, tagline or abstract phrase?",
    technical: "Headline states the offer",
    plain: "Headline says what you sell",
  },
  {
    id: "audienceIdentifiable",
    subgroup: "Value clarity",
    source: "markdown",
    question: "Is it clear who this site is for?",
    technical: "Audience identifiable",
    plain: "Clear who it's for",
  },
  {
    id: "bodyTextSize",
    subgroup: "Readability",
    source: "screenshot",
    question:
      "Is body text large enough to read comfortably, rather than noticeably small relative to the rest of the page?",
    technical: "Body text size",
    plain: "Text is big enough to read",
  },
  {
    id: "textChunking",
    subgroup: "Readability",
    source: "both",
    question:
      "Is the content broken into short paragraphs and sections, rather than presented as long unbroken blocks of text?",
    technical: "Text chunking",
    plain: "Short paragraphs, not walls of text",
  },
  {
    id: "scanableStructure",
    subgroup: "Readability",
    source: "screenshot",
    question:
      "Are there enough headings, lists or visual breaks for someone to skim the page and find what they need?",
    technical: "Scannable structure",
    plain: "Easy to skim",
  },
  {
    id: "noIntrusiveOverlay",
    subgroup: "Friction & distraction",
    source: "screenshot",
    question:
      "Is the view free of popups, modals, cookie walls, newsletter prompts or chat widgets obscuring the content?",
    technical: "No intrusive overlays",
    plain: "No popups in the way",
    weight: 2,
  },
  {
    id: "noAutoplayMedia",
    subgroup: "Friction & distraction",
    source: "screenshot",
    question:
      "Is the page free of autoplaying video, animated banners or carousels that move on their own?",
    technical: "No autoplaying media",
    plain: "Nothing moves on its own",
  },
  {
    id: "notOverwhelming",
    subgroup: "Friction & distraction",
    source: "screenshot",
    question:
      "In the first screenful, are there three or fewer separate promotional blocks, banners or callout boxes?",
    technical: "Not overwhelming",
    plain: "Doesn't feel cluttered",
  },
];

export const CRITERIA_BY_CATEGORY = {
  design: DESIGN_CRITERIA,
  trust: TRUST_CRITERIA,
  ux: UX_CRITERIA,
} as const;

export type AssessedCategory = keyof typeof CRITERIA_BY_CATEGORY;

export const ASSESSED_CATEGORIES: AssessedCategory[] = ["design", "trust", "ux"];

const ALL_CRITERIA: CriterionDef[] = [
  ...DESIGN_CRITERIA,
  ...TRUST_CRITERIA,
  ...UX_CRITERIA,
];

/**
 * Criteria the MODEL is asked about — everything except the code tier. The prompt and
 * its response schema are both built from this, so a criterion moved to `code` stops
 * being asked about automatically rather than needing the prompt edited too.
 */
export function aiCriteria(category: AssessedCategory): CriterionDef[] {
  return CRITERIA_BY_CATEGORY[category].filter((c) => c.source !== "code");
}

/** Criteria answered deterministically by contentChecks.ts. */
export function codeCriteria(category: AssessedCategory): CriterionDef[] {
  return CRITERIA_BY_CATEGORY[category].filter((c) => c.source === "code");
}

export function criterionWeight(def: CriterionDef): number {
  return def.weight ?? 1;
}

/** Ordered sub-groups within a category, for report sectioning. */
export function subgroupsOf(category: AssessedCategory): string[] {
  const seen: string[] = [];
  for (const c of CRITERIA_BY_CATEGORY[category]) {
    if (!seen.includes(c.subgroup)) seen.push(c.subgroup);
  }
  return seen;
}

export interface SubgroupResults {
  subgroup: string;
  results: CriterionResult[];
  /** Counts exclude "unclear", matching how the score is computed. */
  met: number;
  answered: number;
  /** Drives whether the report opens this section by default. */
  hasFailure: boolean;
}

/**
 * Buckets a category's results into its sub-groups for display. Sixty criteria in one
 * flat list buries the findings that matter, so the report collapses each sub-group down
 * to an "n of m" summary and opens only the ones containing a failure.
 */
export function groupResultsBySubgroup(
  category: AssessedCategory,
  results: CriterionResult[]
): SubgroupResults[] {
  const byId = new Map(results.map((r) => [r.id, r]));

  return subgroupsOf(category)
    .map((subgroup) => {
      const defs = CRITERIA_BY_CATEGORY[category].filter((c) => c.subgroup === subgroup);
      const found = defs
        .map((d) => byId.get(d.id))
        .filter((r): r is CriterionResult => r !== undefined);

      const scored = found.filter((r) => r.rating !== "unclear");

      return {
        subgroup,
        results: found,
        met: scored.filter((r) => r.rating === "yes").length,
        answered: scored.length,
        hasFailure: found.some((r) => r.rating === "no"),
      };
    })
    .filter((g) => g.results.length > 0);
}

export function criterionLabel(id: string, mode: ReportMode): string {
  const def = ALL_CRITERIA.find((c) => c.id === id);
  if (!def) return id;
  return mode === "plain" ? def.plain : def.technical;
}

export function criterionDef(id: string): CriterionDef | undefined {
  return ALL_CRITERIA.find((c) => c.id === id);
}

export function isKnownCriterion(category: AssessedCategory, id: string): boolean {
  return CRITERIA_BY_CATEGORY[category].some((c) => c.id === id);
}

// Duplicate ids would silently collapse in the report (criterionLabel resolves by id)
// and in parsing, where one entry would overwrite the other. Fail loudly at import.
const duplicateIds = ALL_CRITERIA.map((c) => c.id).filter(
  (id, i, all) => all.indexOf(id) !== i
);
if (duplicateIds.length > 0) {
  throw new Error(`Duplicate criterion ids: ${[...new Set(duplicateIds)].join(", ")}`);
}
