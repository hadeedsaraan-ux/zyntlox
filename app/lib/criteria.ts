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
  // --- Layout & hierarchy ---
  { id: "focalPoint", subgroup: "Layout & hierarchy", source: "screenshot", weight: 2,
    question: "In the first screenful, is a single headline or image visibly larger than everything else around it — not two or more of equal size?",
    technical: "Single focal point", plain: "One thing grabs your eye first" },
  { id: "alignment", subgroup: "Layout & hierarchy", source: "screenshot",
    question: "Do elements line up on a consistent grid, with edges and columns aligned rather than visibly ragged?",
    technical: "Grid alignment", plain: "Things line up neatly" },
  { id: "sectionBoundaries", subgroup: "Layout & hierarchy", source: "screenshot",
    question: "Are distinct sections visually separated by spacing, background changes or dividers, rather than running together?",
    technical: "Section separation", plain: "Sections are easy to tell apart" },
  { id: "contentWidth", subgroup: "Layout & hierarchy", source: "screenshot",
    question: "Is the content held to a readable central column, rather than stretching edge to edge across the full width?",
    technical: "Content width", plain: "Content isn't stretched edge to edge" },
  { id: "aboveFoldPurpose", subgroup: "Layout & hierarchy", source: "screenshot",
    question: "Does the first screenful contain a headline, supporting text and an action, rather than only a logo or a bare image?",
    technical: "Above-the-fold purpose", plain: "The top of the page does a job" },

  // --- Spacing & rhythm ---
  { id: "breathingRoom", subgroup: "Spacing & rhythm", source: "screenshot",
    question: "Do text blocks and images have clear margins around them, rather than crowding the edges of the page or each other?",
    technical: "Breathing room", plain: "Nothing feels cramped" },
  { id: "spacingConsistency", subgroup: "Spacing & rhythm", source: "screenshot",
    question: "Are the gaps between comparable sections roughly equal, rather than varying at random down the page?",
    technical: "Spacing consistency", plain: "Even gaps throughout" },
  { id: "noDeadSpace", subgroup: "Spacing & rhythm", source: "screenshot",
    question: "Is the layout free of large empty regions that serve no apparent purpose?",
    technical: "No dead space", plain: "No awkward empty patches" },
  { id: "verticalRhythm", subgroup: "Spacing & rhythm", source: "screenshot",
    question: "Is the space above each heading larger than the space below it, so headings group with the text they introduce?",
    technical: "Vertical rhythm", plain: "Headings sit with their own text" },

  // --- Typography ---
  { id: "fontRestraint", subgroup: "Typography", source: "screenshot",
    question: "Are three or fewer distinct typefaces visible on the page?",
    technical: "Typeface restraint", plain: "Not too many different fonts" },
  { id: "headingContrast", subgroup: "Typography", source: "screenshot",
    question: "Are headings clearly larger or heavier than body text, so the hierarchy is obvious at a glance?",
    technical: "Heading contrast", plain: "Headings stand out from text" },
  { id: "lineLength", subgroup: "Typography", source: "screenshot",
    question: "Do paragraphs run at a comfortable reading width, rather than stretching the full width of the window?",
    technical: "Line length", plain: "Text lines aren't too wide" },
  { id: "textAlignment", subgroup: "Typography", source: "screenshot",
    question: "Is body text left-aligned rather than centred or justified in long passages?",
    technical: "Text alignment", plain: "Paragraphs aren't centred" },
  { id: "capsRestraint", subgroup: "Typography", source: "screenshot",
    question: "Is the page free of full sentences or paragraphs set in ALL CAPITALS?",
    technical: "Capitals restraint", plain: "Nothing is shouting in capitals" },
  { id: "fontSizeSteps", subgroup: "Typography", source: "screenshot",
    question: "Do the text sizes fall into a small number of clear steps, rather than many near-identical sizes?",
    technical: "Type scale", plain: "A few clear text sizes, not dozens" },

  // --- Colour & contrast ---
  { id: "paletteRestraint", subgroup: "Colour & contrast", source: "screenshot",
    question: "Does the page use a limited, deliberate palette — roughly four or fewer dominant colours — rather than many unrelated ones?",
    technical: "Palette restraint", plain: "Colours look chosen, not random" },
  { id: "textContrast", subgroup: "Colour & contrast", source: "screenshot", weight: 2,
    question: "Is body text clearly legible against its background everywhere it appears, with no light-grey-on-white or text-over-busy-image passages?",
    technical: "Text contrast", plain: "Text is easy to see against its background" },
  { id: "accentPurpose", subgroup: "Colour & contrast", source: "screenshot",
    question: "Is there an accent colour reserved for buttons and links, rather than applied decoratively at random?",
    technical: "Purposeful accent colour", plain: "Bright colours mean something" },
  { id: "backgroundRestraint", subgroup: "Colour & contrast", source: "screenshot",
    question: "Are backgrounds plain enough that text over them stays readable, with no busy patterns or photos behind paragraphs?",
    technical: "Background restraint", plain: "Backgrounds don't fight the text" },

  // --- Imagery & media ---
  { id: "imageQuality", subgroup: "Imagery & media", source: "screenshot",
    question: "Are the images sharp and correctly proportioned, rather than blurry, pixelated or stretched out of shape?",
    technical: "Image quality", plain: "Photos are sharp, not squashed" },
  { id: "imageConsistency", subgroup: "Imagery & media", source: "screenshot",
    question: "Do the images share a consistent treatment — similar crop, tone or style — rather than looking assembled from different sources?",
    technical: "Image consistency", plain: "Photos look like a set" },
  { id: "imageRelevance", subgroup: "Imagery & media", source: "screenshot",
    question: "Do the images show the actual product, work, people or premises, rather than generic stock photography?",
    technical: "Image relevance", plain: "Real photos, not generic stock" },
  { id: "imagePresence", subgroup: "Imagery & media", source: "screenshot",
    question: "Does the page contain at least one substantial image or graphic, rather than being an unbroken wall of text?",
    technical: "Visual content present", plain: "There's something to look at" },

  // --- Buttons & controls ---
  { id: "buttonStyling", subgroup: "Buttons & controls", source: "screenshot",
    question: "Do buttons look clickable — a filled or outlined shape with padding — rather than appearing as plain underlined text?",
    technical: "Button affordance", plain: "Buttons look like buttons" },
  { id: "buttonConsistency", subgroup: "Buttons & controls", source: "screenshot",
    question: "Do buttons of the same kind share one style, rather than varying in colour, shape or size across the page?",
    technical: "Button consistency", plain: "Buttons all match each other" },
  { id: "buttonHierarchy", subgroup: "Buttons & controls", source: "screenshot",
    question: "Is there a visible difference between the main button and secondary ones, rather than all being styled identically?",
    technical: "Button hierarchy", plain: "The main button looks different" },
  { id: "linkAffordance", subgroup: "Buttons & controls", source: "screenshot",
    question: "Are in-text links visually distinguishable from surrounding text by colour or underline?",
    technical: "Link affordance", plain: "Links look different from normal text" },

  // --- Navigation chrome ---
  { id: "navPlacement", subgroup: "Navigation chrome", source: "screenshot",
    question: "Is the navigation in a conventional position — across the top or down the side — rather than somewhere unexpected?",
    technical: "Navigation placement", plain: "The menu is where you'd expect" },
  { id: "navSeparation", subgroup: "Navigation chrome", source: "screenshot",
    question: "Is the navigation visually separated from the page content by a background, border or clear spacing?",
    technical: "Navigation separation", plain: "The menu is clearly its own bar" },
  { id: "logoPlacement", subgroup: "Navigation chrome", source: "screenshot",
    question: "Is the logo or business name in the top-left or top-centre, where visitors look for it?",
    technical: "Logo placement", plain: "The logo is where people look" },

  // --- Footer & page furniture ---
  { id: "footerPresent", subgroup: "Footer & page furniture", source: "screenshot",
    question: "Does the page end with a distinct footer area, rather than simply stopping after the last section? If the bottom of the page is not visible in the screenshot, answer \"unclear\".",
    technical: "Footer present", plain: "The page has a proper footer" },
  { id: "footerOrganised", subgroup: "Footer & page furniture", source: "screenshot",
    question: "Is the footer organised into labelled groups or columns, rather than being one undifferentiated run of links? If the bottom of the page is not visible in the screenshot, answer \"unclear\".",
    technical: "Footer organisation", plain: "The footer is tidy, not a link pile" },
  { id: "pageEndsCleanly", subgroup: "Footer & page furniture", source: "screenshot",
    question: "Is the bottom of the page free of cut-off content, overlapping elements or stray unstyled text? If the bottom of the page is not visible in the screenshot, answer \"unclear\".",
    technical: "Clean page end", plain: "Nothing broken at the bottom" },

  // --- Visual consistency ---
  { id: "componentConsistency", subgroup: "Visual consistency", source: "screenshot",
    question: "Do repeated components — cards, tiles, list items — share one layout and style throughout?",
    technical: "Component consistency", plain: "Repeated blocks look the same" },
  { id: "iconConsistency", subgroup: "Visual consistency", source: "screenshot",
    question: "Do the icons share one visual style — all outline or all filled, similar weight — rather than being mixed?",
    technical: "Icon consistency", plain: "Icons match each other" },
  { id: "cornerConsistency", subgroup: "Visual consistency", source: "screenshot",
    question: "Are corner roundings consistent across buttons, cards and images, rather than mixing sharp and rounded at random?",
    technical: "Corner consistency", plain: "Rounded edges are used consistently" },
];


// ---------------------------------------------------------------------------
// TRUST — the most code-checkable category, because most credibility signals are
// links and text rather than looks.
// ---------------------------------------------------------------------------

export const TRUST_CRITERIA: CriterionDef[] = [
  // ===== CODE TIER — answered from the page markdown, never by the model =====

  // --- Contact & location ---
  { id: "contactEmail", subgroup: "Contact & location", source: "code",
    question: "Is an email address or mailto: link present on the page?",
    technical: "Email address", plain: "An email address to reach you" },
  { id: "contactPhone", subgroup: "Contact & location", source: "code",
    question: "Is a phone number or tel: link present on the page?",
    technical: "Phone number", plain: "A phone number to call" },
  { id: "contactRoute", subgroup: "Contact & location", source: "code", weight: 2,
    question: "Is there a link to a contact page or contact form?",
    technical: "Contact route", plain: "A way to get in touch" },
  { id: "physicalAddress", subgroup: "Contact & location", source: "code",
    question: "Is a physical or postal address present?",
    technical: "Physical address", plain: "A real-world address" },
  { id: "mapLink", subgroup: "Contact & location", source: "code",
    question: "Is there a link to a map or directions?",
    technical: "Map or directions", plain: "A map showing where you are" },
  { id: "businessHours", subgroup: "Contact & location", source: "code",
    question: "Are opening hours or availability stated on the page?",
    technical: "Business hours", plain: "When you're open" },
  { id: "multipleContactChannels", subgroup: "Contact & location", source: "code",
    question: "Are at least two different ways to make contact offered (email, phone, form, social)?",
    technical: "Multiple contact channels", plain: "More than one way to reach you" },

  // --- Legal & policies ---
  { id: "privacyPolicy", subgroup: "Legal & policies", source: "code",
    question: "Is there a link to a privacy policy?",
    technical: "Privacy policy", plain: "A privacy policy link" },
  { id: "termsPage", subgroup: "Legal & policies", source: "code",
    question: "Is there a link to terms of service, terms and conditions, or similar?",
    technical: "Terms page", plain: "A terms and conditions link" },
  { id: "cookiePolicy", subgroup: "Legal & policies", source: "code",
    question: "Is there a link to a cookie policy or cookie settings?",
    technical: "Cookie policy", plain: "A cookie policy link" },
  { id: "accessibilityStatement", subgroup: "Legal & policies", source: "code",
    question: "Is there a link to an accessibility statement?",
    technical: "Accessibility statement", plain: "An accessibility statement" },
  { id: "refundPolicy", subgroup: "Legal & policies", source: "code",
    question: "Is refund, returns or cancellation information linked or stated?",
    technical: "Refund or returns policy", plain: "What happens if someone wants a refund" },
  { id: "shippingInfo", subgroup: "Legal & policies", source: "code",
    question: "Is delivery, shipping or fulfilment information linked or stated?",
    technical: "Shipping information", plain: "Delivery information" },
  { id: "copyrightNotice", subgroup: "Legal & policies", source: "code",
    question: "Is a copyright notice present anywhere on the page?",
    technical: "Copyright notice", plain: "A copyright line" },

  // --- Commerce & guarantees ---
  { id: "pricingSignals", subgroup: "Commerce & guarantees", source: "code",
    question: "Are there pricing signals — currency amounts, or a link to a pricing or plans page?",
    technical: "Pricing signals", plain: "Some sign of what it costs" },
  { id: "currencyConsistent", subgroup: "Commerce & guarantees", source: "code",
    question: "Where prices appear, do they all use a single currency symbol rather than mixing several?",
    technical: "Currency consistency", plain: "Prices all in one currency" },
  { id: "guaranteeLanguage", subgroup: "Commerce & guarantees", source: "code",
    question: "Does the page mention a guarantee, warranty or money-back promise?",
    technical: "Guarantee offered", plain: "A guarantee or promise" },
  { id: "riskReversal", subgroup: "Commerce & guarantees", source: "code",
    question: "Does the page reduce the risk of acting — a free trial, free quote, demo, sample, or no-obligation offer?",
    technical: "Risk reversal", plain: "A low-risk way to try you out" },
  { id: "paymentMethods", subgroup: "Commerce & guarantees", source: "code",
    question: "Are accepted payment methods named anywhere on the page?",
    technical: "Payment methods", plain: "Which payments you accept" },
  { id: "securityAssurance", subgroup: "Commerce & guarantees", source: "code",
    question: "Does the page mention secure payment, encryption or data protection?",
    technical: "Security assurance", plain: "A note that payment is secure" },

  // --- Social & external presence ---
  { id: "socialPresence", subgroup: "Social & external presence", source: "code",
    question: "Is there at least one link to an established social media profile?",
    technical: "Social profiles", plain: "Links to your social media" },
  { id: "multiplePlatforms", subgroup: "Social & external presence", source: "code",
    question: "Are there links to at least two different social platforms?",
    technical: "Multiple platforms", plain: "More than one social account" },
  { id: "reviewPlatformLink", subgroup: "Social & external presence", source: "code",
    question: "Is there a link to an independent review platform such as Google, Trustpilot or Yelp?",
    technical: "Independent reviews", plain: "Reviews somewhere people can verify" },
  { id: "pressMentions", subgroup: "Social & external presence", source: "code",
    question: "Does the page reference press coverage, awards, certifications or memberships?",
    technical: "Press and accreditation", plain: "Press, awards or certifications" },
  { id: "externalLinkBalance", subgroup: "Social & external presence", source: "code",
    question: "Are fewer than half of the page's links pointing off-site?",
    technical: "External link balance", plain: "The page keeps visitors on your site" },

  // --- Freshness & maintenance ---
  { id: "copyrightCurrent", subgroup: "Freshness & maintenance", source: "code",
    question: "Is a copyright year present, and within one year of the current year?",
    technical: "Current copyright year", plain: "Footer year isn't out of date" },
  { id: "recentYearMentioned", subgroup: "Freshness & maintenance", source: "code",
    question: "Is the current or previous year mentioned anywhere in the page content?",
    technical: "Recent year referenced", plain: "The content mentions this year" },
  { id: "datedContent", subgroup: "Freshness & maintenance", source: "code",
    question: "Does any content carry a visible date?",
    technical: "Dated content", plain: "Something on the page is dated" },
  { id: "blogOrNewsLink", subgroup: "Freshness & maintenance", source: "code",
    question: "Is there a link to a blog, news or updates section?",
    technical: "Blog or news section", plain: "A blog or news page" },
  { id: "noComingSoon", subgroup: "Freshness & maintenance", source: "code",
    question: "Is the page free of 'coming soon', 'under construction' or 'page not found' text?",
    technical: "No unfinished sections", plain: "Nothing says 'coming soon'" },

  // --- Language & tone ---
  { id: "noPlaceholderText", subgroup: "Language & tone", source: "code", weight: 2,
    question: "Is the page free of placeholder text such as 'lorem ipsum', 'your text here' or 'insert text'?",
    technical: "No placeholder text", plain: "No leftover dummy text" },
  { id: "noAllCapsShouting", subgroup: "Language & tone", source: "code",
    question: "Are there five or fewer long ALL-CAPS words in the page text?",
    technical: "No shouting", plain: "Not written in capitals" },
  { id: "exclamationRestraint", subgroup: "Language & tone", source: "code",
    question: "Are there fewer than one exclamation mark per hundred words?",
    technical: "Exclamation restraint", plain: "Not over-excited punctuation" },
  { id: "noUrgencyPressure", subgroup: "Language & tone", source: "code",
    question: "Is the page free of artificial urgency language such as 'hurry', 'act now' or 'only N left'?",
    technical: "No pressure tactics", plain: "No fake urgency" },
  { id: "specificNumbers", subgroup: "Language & tone", source: "code",
    question: "Does the copy contain specific figures — years, quantities, percentages — rather than only adjectives?",
    technical: "Specific figures", plain: "Real numbers, not just adjectives" },
  { id: "jargonRestraint", subgroup: "Language & tone", source: "code",
    question: "Is the copy largely free of empty business jargon such as 'synergy', 'best-in-class' or 'world-class'?",
    technical: "Jargon restraint", plain: "Plain words, not buzzwords" },

  // ===== AI TIER =====

  // --- Identity & branding ---
  { id: "aboutPage", subgroup: "Identity & branding", source: "code",
    question: "Is there a link to an About, team, or company-story page?",
    technical: "About page", plain: "A page saying who you are" },
  { id: "customLogo", subgroup: "Identity & branding", source: "screenshot",
    question: "Is there a custom logo or designed wordmark, rather than a placeholder graphic or the business name in a default font?",
    technical: "Custom logo", plain: "A proper logo" },
  { id: "distinctBranding", subgroup: "Identity & branding", source: "screenshot",
    question: "Does the design look bespoke, rather than an unmodified off-the-shelf template with the demo content swapped out?",
    technical: "Distinct branding", plain: "Doesn't look like a default template" },
  { id: "consistentIdentity", subgroup: "Identity & branding", source: "both",
    question: "Is the business name presented consistently everywhere it appears, with no variant spellings or leftover alternate names?",
    technical: "Consistent identity", plain: "Business name used consistently" },

  // --- Social proof ---
  { id: "testimonialsPresent", subgroup: "Social proof", source: "both", weight: 2,
    question: "Are there testimonials, reviews, ratings or customer quotes anywhere on the page?",
    technical: "Testimonials or reviews", plain: "What customers say about you" },
  { id: "namedAttribution", subgroup: "Social proof", source: "both",
    question: "Do the testimonials or quotes carry a real name, role or company, rather than being anonymous? If the page has no testimonials at all, answer \"unclear\".",
    technical: "Attributed social proof", plain: "Reviews have real names on them" },
  { id: "testimonialSpecific", subgroup: "Social proof", source: "markdown",
    question: "Do the testimonials describe a specific result or experience, rather than only generic praise? If there are no testimonials, answer \"unclear\".",
    technical: "Specific testimonials", plain: "Reviews say something real" },
  { id: "testimonialPhoto", subgroup: "Social proof", source: "screenshot",
    question: "Do the testimonials show a photo or avatar of the person quoted? If there are no testimonials, answer \"unclear\".",
    technical: "Testimonial photos", plain: "Faces next to the reviews" },
  { id: "credibilityMarkers", subgroup: "Social proof", source: "screenshot",
    question: "Are there client logos, press mentions, certifications, awards or membership badges shown?",
    technical: "Credibility markers", plain: "Logos, badges or press mentions" },
  { id: "socialProofQuantity", subgroup: "Social proof", source: "both",
    question: "Is a concrete quantity of customers, users, projects or years in business stated?",
    technical: "Quantified track record", plain: "Numbers showing your track record" },

  // --- Production polish ---
  { id: "noPlaceholder", subgroup: "Production polish", source: "both", weight: 2,
    question: "Is the page free of visible placeholder content such as an unedited template heading or a 'coming soon' block?",
    technical: "No placeholder content", plain: "Nothing looks unfinished" },
  { id: "noBrokenMedia", subgroup: "Production polish", source: "screenshot",
    question: "Is the page free of broken images, missing-image icons, and empty media frames?",
    technical: "No broken media", plain: "No broken pictures" },
  { id: "writingQuality", subgroup: "Production polish", source: "markdown",
    question: "Is the copy free of obvious spelling and grammar errors?",
    technical: "Writing quality", plain: "No spelling mistakes" },
  { id: "professionalTone", subgroup: "Production polish", source: "markdown",
    question: "Does the copy read as deliberately written and edited, rather than hasty, inconsistent, or machine-generated?",
    technical: "Professional tone", plain: "Writing sounds professional" },
  { id: "noLayoutBreakage", subgroup: "Production polish", source: "screenshot",
    question: "Is the page free of overlapping text, elements spilling outside their containers, or obviously unstyled sections?",
    technical: "No layout breakage", plain: "Nothing looks broken on the page" },

  // --- Transparency & claims ---
  { id: "expectationsSet", subgroup: "Transparency & claims", source: "markdown",
    question: "Does the page explain what happens after someone acts — delivery, response time, process, or next steps?",
    technical: "Expectations set", plain: "Explains what happens next" },
  { id: "offerSpecific", subgroup: "Transparency & claims", source: "markdown",
    question: "Does the page make specific, checkable claims, rather than relying only on vague superlatives like 'best' and 'leading'?",
    technical: "Specific claims", plain: "Says real specifics, not just buzzwords" },
  { id: "noDarkPatterns", subgroup: "Transparency & claims", source: "screenshot",
    question: "Is the page free of manipulative pressure tactics such as fake countdown timers, fabricated scarcity, or guilt-worded decline buttons?",
    technical: "No dark patterns", plain: "No pushy sales tricks" },
  { id: "claimsSupported", subgroup: "Transparency & claims", source: "markdown",
    question: "Where the page makes a strong claim, is it backed by a figure, a named source, or evidence rather than left unsupported?",
    technical: "Supported claims", plain: "Big claims are backed up" },

  // --- Authenticity signals ---
  { id: "realPhotography", subgroup: "Authenticity signals", source: "screenshot",
    question: "Are the people shown in candid, location-specific settings rather than posed against plain or generic studio backdrops? If no people are shown anywhere, answer \"unclear\".",
    technical: "Authentic photography", plain: "Real people, not stock models" },
  { id: "contentFreshness", subgroup: "Authenticity signals", source: "markdown",
    question: "Is there a sign the site is actively maintained — recent dates, current-year references, or evidently fresh content?",
    technical: "Content freshness", plain: "Looks recently updated" },
  { id: "teamVisible", subgroup: "Authenticity signals", source: "both",
    question: "Are actual people behind the business shown or named anywhere on the page?",
    technical: "Team visible", plain: "You can see who's behind it" },
  { id: "premisesOrProcess", subgroup: "Authenticity signals", source: "screenshot",
    question: "Does the page show the real premises, workspace, or work being done, rather than only abstract or decorative imagery?",
    technical: "Real premises or process", plain: "Shows the actual place or work" },
];


// ---------------------------------------------------------------------------
// UX
// ---------------------------------------------------------------------------

export const UX_CRITERIA: CriterionDef[] = [
  // ===== CODE TIER =====

  // --- Content structure ---
  { id: "headingStructure", subgroup: "Content structure", source: "code",
    question: "Does the page contain at least two headings?",
    technical: "Heading structure", plain: "Content is broken up by headings" },
  { id: "headingHierarchy", subgroup: "Content structure", source: "code",
    question: "Does the page use more than one heading level, giving it a real hierarchy?",
    technical: "Heading hierarchy", plain: "Headings and sub-headings" },
  { id: "noSkippedHeadingLevels", subgroup: "Content structure", source: "code",
    question: "Does the heading hierarchy descend without skipping a level (no h2 straight to h4)?",
    technical: "No skipped heading levels", plain: "Headings go in order" },
  { id: "subheadingDensity", subgroup: "Content structure", source: "code",
    question: "Is there at least one heading per 300 words, so long runs of text are broken up?",
    technical: "Subheading density", plain: "Headings often enough to break up text" },
  { id: "listUsage", subgroup: "Content structure", source: "code",
    question: "Does the page use bulleted or numbered lists to break up information?",
    technical: "List usage", plain: "Uses bullet points" },
  { id: "paragraphLength", subgroup: "Content structure", source: "code",
    question: "Are fewer than a quarter of paragraphs longer than 80 words?",
    technical: "Paragraph length", plain: "Paragraphs stay short" },
  { id: "contentDepth", subgroup: "Content structure", source: "code",
    question: "Does the page have enough content to be useful (at least 150 words)?",
    technical: "Content depth", plain: "Enough content to be useful" },
  { id: "contentToNavRatio", subgroup: "Content structure", source: "code",
    question: "Is most of the page actual content rather than navigation — at least half the words outside link text?",
    technical: "Content to navigation ratio", plain: "Mostly content, not menus" },

  // --- Findability ---
  { id: "searchLink", subgroup: "Findability", source: "code",
    question: "Is there a search box or a link to search?",
    technical: "Search available", plain: "A way to search the site" },
  { id: "homeLink", subgroup: "Findability", source: "code",
    question: "Is there a link back to the home page?",
    technical: "Home link", plain: "A way back to the homepage" },
  { id: "faqOrHelpLink", subgroup: "Findability", source: "code",
    question: "Is there a link to an FAQ, help or support section?",
    technical: "Help or FAQ", plain: "A help or FAQ page" },
  { id: "sitemapLink", subgroup: "Findability", source: "code",
    question: "Is there a link to a sitemap?",
    technical: "Sitemap link", plain: "A sitemap link" },
  { id: "breadcrumbPresent", subgroup: "Findability", source: "code",
    question: "Are breadcrumbs present, showing where this page sits in the site?",
    technical: "Breadcrumbs", plain: "A trail showing where you are" },
  { id: "resourcesLink", subgroup: "Findability", source: "code",
    question: "Is there a link to guides, resources, documentation or case studies?",
    technical: "Resources section", plain: "Guides or resources to read" },

  // --- Reading ease ---
  { id: "avgSentenceLength", subgroup: "Reading ease", source: "code",
    question: "Do sentences average 25 words or fewer?",
    technical: "Average sentence length", plain: "Sentences aren't too long" },
  { id: "avgWordLength", subgroup: "Reading ease", source: "code",
    question: "Do words average under 6 characters, suggesting plain rather than dense vocabulary?",
    technical: "Average word length", plain: "Uses short, plain words" },
  { id: "longParagraphRatio", subgroup: "Reading ease", source: "code",
    question: "Are fewer than a third of paragraphs longer than 60 words?",
    technical: "Long paragraph ratio", plain: "Few big blocks of text" },
  { id: "readingTime", subgroup: "Reading ease", source: "code",
    question: "Can the page be read in under 10 minutes at average reading speed?",
    technical: "Reading time", plain: "Not an exhausting amount to read" },
  { id: "questionHeadings", subgroup: "Reading ease", source: "code",
    question: "Does at least one heading pose a question the visitor might actually be asking?",
    technical: "Question headings", plain: "Headings answer real questions" },
  { id: "benefitLanguage", subgroup: "Reading ease", source: "code",
    question: "Does the copy address the reader directly using 'you' or 'your'?",
    technical: "Reader-directed language", plain: "Talks to the reader, not about itself" },
  { id: "numbersInCopy", subgroup: "Reading ease", source: "code",
    question: "Does the copy include concrete numbers rather than being entirely qualitative?",
    technical: "Numbers in copy", plain: "Includes real figures" },
  { id: "noWallOfText", subgroup: "Reading ease", source: "code",
    question: "Is the longest single paragraph under 150 words?",
    technical: "No wall of text", plain: "No enormous single paragraph" },

  // --- Link quality ---
  { id: "ctaLinkPresent", subgroup: "Link quality", source: "code", weight: 2,
    question: "Is there at least one link whose text reads as an action — get started, buy, book, sign up, contact, request a quote?",
    technical: "Action link present", plain: "A button that asks you to do something" },
  { id: "linkDensity", subgroup: "Link quality", source: "code",
    question: "Is there enough prose relative to links — at least four words of content per link — rather than the page being mostly a link dump?",
    technical: "Link density", plain: "Not just a wall of links" },
  { id: "noClickHere", subgroup: "Link quality", source: "code",
    question: "Is the page free of uninformative link text such as 'click here', 'read more' or 'link'?",
    technical: "No vague link text", plain: "No 'click here' links" },
  { id: "descriptiveLinkText", subgroup: "Link quality", source: "code",
    question: "Do most links have at least two words of text, rather than being single words or bare symbols?",
    technical: "Descriptive link text", plain: "Links say where they go" },
  { id: "noBareUrls", subgroup: "Link quality", source: "code",
    question: "Is the page free of raw URLs used as link text?",
    technical: "No bare URLs", plain: "No raw web addresses shown as links" },
  { id: "noDuplicateLinkText", subgroup: "Link quality", source: "code",
    question: "Is the same link text used for two different destinations fewer than three times?",
    technical: "No ambiguous duplicate links", plain: "Same wording doesn't go to different places" },
  { id: "mailtoValid", subgroup: "Link quality", source: "code",
    question: "Do all mailto: links contain a well-formed email address? If there are none, answer yes.",
    technical: "Valid mailto links", plain: "Email links actually work" },
  { id: "noJavascriptLinks", subgroup: "Link quality", source: "code",
    question: "Is the page free of links whose destination is 'javascript:void(0)' or an empty '#'?",
    technical: "No dead links", plain: "No links that go nowhere" },

  // --- Forms & interaction ---
  { id: "formPresent", subgroup: "Forms & interaction", source: "code",
    question: "Is there a form on the page — contact, signup, search or enquiry?",
    technical: "Form present", plain: "A form to fill in" },
  { id: "newsletterSignup", subgroup: "Forms & interaction", source: "code",
    question: "Is there a newsletter or mailing-list signup?",
    technical: "Newsletter signup", plain: "A mailing list to join" },
  { id: "formFieldCount", subgroup: "Forms & interaction", source: "code",
    question: "Do forms ask for seven or fewer fields, rather than demanding a long list up front?",
    technical: "Form length", plain: "Forms don't ask for too much" },
  { id: "labelledInputs", subgroup: "Forms & interaction", source: "code",
    question: "Does every form field carry a label rather than relying on placeholder text alone?",
    technical: "Labelled form fields", plain: "Form boxes say what they want" },

  // ===== AI TIER =====

  // --- Navigation ---
  { id: "navVisible", subgroup: "Navigation", source: "screenshot", weight: 2,
    question: "Is there a visible navigation menu in the top area of the page?",
    technical: "Visible navigation", plain: "A menu you can see" },
  { id: "navLabelsPlain", subgroup: "Navigation", source: "both",
    question: "Are the navigation labels plain and descriptive, rather than clever, abstract or ambiguous?",
    technical: "Plain navigation labels", plain: "Menu items say what they are" },
  { id: "navScannable", subgroup: "Navigation", source: "screenshot",
    question: "Does the top-level navigation hold a manageable number of items — roughly seven or fewer — rather than overwhelming the visitor?",
    technical: "Scannable navigation", plain: "Menu isn't overloaded" },
  { id: "searchVisible", subgroup: "Navigation", source: "screenshot",
    question: "Is a search box visible in the first screenful? If the site is small enough not to need one, answer \"unclear\".",
    technical: "Search visible", plain: "A search box you can see" },
  { id: "currentLocationClear", subgroup: "Navigation", source: "screenshot",
    question: "Does the navigation indicate which section the visitor is currently in, by highlight, underline or colour? If this is a home page with no section to mark, answer \"unclear\".",
    technical: "Current location shown", plain: "The menu shows where you are" },

  // --- Conversion path ---
  { id: "ctaAboveFold", subgroup: "Conversion path", source: "screenshot", weight: 2,
    question: "Is there a clear call-to-action button visible in the first screenful, without scrolling?",
    technical: "CTA above the fold", plain: "A clear button without scrolling" },
  { id: "ctaDistinct", subgroup: "Conversion path", source: "screenshot",
    question: "Does the primary call-to-action stand out visually from the elements around it, through colour, size or placement?",
    technical: "CTA visual prominence", plain: "The main button stands out" },
  { id: "singleDominantAction", subgroup: "Conversion path", source: "screenshot",
    question: "In the first screenful, is exactly one button styled more prominently (filled or coloured) than every other button?",
    technical: "Single dominant action", plain: "One clear next step" },
  { id: "ctaRepeated", subgroup: "Conversion path", source: "screenshot",
    question: "Does the primary action appear more than once down the page, so a reader who scrolls does not have to go back up?",
    technical: "CTA repeated", plain: "The main button appears again further down" },
  { id: "ctaCopySpecific", subgroup: "Conversion path", source: "both",
    question: "Does the main button say what will happen — 'Book a call', 'Start free trial' — rather than a generic 'Submit' or 'Click here'?",
    technical: "Specific CTA copy", plain: "The button says what it does" },

  // --- Value clarity ---
  { id: "valueInFiveSeconds", subgroup: "Value clarity", source: "both", weight: 2,
    question: "Could a first-time visitor tell what this site offers within five seconds of looking at the top of the page?",
    technical: "Five-second value clarity", plain: "Obvious what you do, fast" },
  { id: "headlineStatesValue", subgroup: "Value clarity", source: "markdown",
    question: "Does the main headline describe what is actually offered, rather than being a slogan, tagline or abstract phrase?",
    technical: "Headline states the offer", plain: "Headline says what you sell" },
  { id: "audienceIdentifiable", subgroup: "Value clarity", source: "markdown",
    question: "Is it clear who this site is for?",
    technical: "Audience identifiable", plain: "Clear who it's for" },
  { id: "differentiationClear", subgroup: "Value clarity", source: "markdown",
    question: "Does the page say what makes this different from alternatives, rather than describing only what it does?",
    technical: "Differentiation clear", plain: "Says why you, not someone else" },

  // --- Readability ---
  { id: "bodyTextSize", subgroup: "Readability", source: "screenshot",
    question: "Is body text large enough to read comfortably, rather than noticeably small relative to the rest of the page?",
    technical: "Body text size", plain: "Text is big enough to read" },
  { id: "textChunking", subgroup: "Readability", source: "both",
    question: "Is the content broken into short paragraphs and sections, rather than presented as long unbroken blocks of text?",
    technical: "Text chunking", plain: "Short paragraphs, not walls of text" },
  { id: "scanableStructure", subgroup: "Readability", source: "screenshot",
    question: "Are there enough headings, lists or visual breaks for someone to skim the page and find what they need?",
    technical: "Scannable structure", plain: "Easy to skim" },

  // --- Friction & distraction ---
  { id: "noIntrusiveOverlay", subgroup: "Friction & distraction", source: "screenshot", weight: 2,
    question: "Is the view free of popups, modals, cookie walls, newsletter prompts or chat widgets obscuring the content?",
    technical: "No intrusive overlays", plain: "No popups in the way" },
  { id: "noAutoplayMedia", subgroup: "Friction & distraction", source: "screenshot",
    question: "Is the page free of autoplaying video, animated banners or carousels that move on their own?",
    technical: "No autoplaying media", plain: "Nothing moves on its own" },
  { id: "notOverwhelming", subgroup: "Friction & distraction", source: "screenshot",
    question: "In the first screenful, are there three or fewer separate promotional blocks, banners or callout boxes?",
    technical: "Not overwhelming", plain: "Doesn't feel cluttered" },
  { id: "noAdClutter", subgroup: "Friction & distraction", source: "screenshot",
    question: "Is the page free of advertising blocks competing with the site's own content?",
    technical: "No ad clutter", plain: "No adverts getting in the way" },

  // --- Mobile readiness ---
  { id: "touchTargetSize", subgroup: "Mobile readiness", source: "screenshot",
    question: "Do buttons and navigation items look large enough to tap accurately on a phone, rather than small text links packed closely together?",
    technical: "Touch target size", plain: "Buttons big enough to tap" },
  { id: "contentFitsWidth", subgroup: "Mobile readiness", source: "screenshot",
    question: "Does all content sit within the page width, with nothing cut off or requiring sideways scrolling?",
    technical: "Content fits the width", plain: "Nothing runs off the side" },
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
  /** Failures in this group. Shown as a badge so a CLOSED group still signals content. */
  issues: number;
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

      const issues = found.filter((r) => r.rating === "no").length;

      return {
        subgroup,
        results: found,
        met: scored.filter((r) => r.rating === "yes").length,
        answered: scored.length,
        issues,
        hasFailure: issues > 0,
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
