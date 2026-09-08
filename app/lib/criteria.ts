import { ReportMode } from "./types";

/**
 * Canonical definition of every subjective criterion, in ONE place.
 *
 * The old prompt asked for `"designScore": <number 0-10>` with no definition, leaving
 * the model to improvise an 11-way choice each run. Measured spread on a frozen input
 * was 21 points of overallScore, and temperature had no effect on it.
 *
 * So the model no longer emits numbers. It reports six concrete observations per
 * category, each rated good/adequate/poor with the evidence behind it, and code turns
 * those into the score — the same move that made the SEO checks deterministic.
 *
 * The prompt schema and the report UI are both generated from this list, so a criterion
 * can never exist in one and not the other.
 */

export interface CriterionDef {
  id: string;
  /** Asked of the model. Must be answerable from a screenshot alone. */
  question: string;
  technical: string;
  plain: string;
}

export const DESIGN_CRITERIA: CriterionDef[] = [
  {
    id: "hierarchy",
    question: "Is there one clear focal point drawing the eye, or does everything compete for attention?",
    technical: "Visual hierarchy",
    plain: "Where your eye lands first",
  },
  {
    id: "spacing",
    question: "Does the layout have breathing room, or is it cramped (or full of dead space)?",
    technical: "Spacing & density",
    plain: "Breathing room",
  },
  {
    id: "typography",
    question: "Is the type consistent and readable in size, or are there many clashing fonts and sizes?",
    technical: "Typography",
    plain: "Text and fonts",
  },
  {
    id: "color",
    question: "Is the palette deliberate and limited, or clashing/unmodified default colors?",
    technical: "Color palette",
    plain: "Color choices",
  },
  {
    id: "imagery",
    question: "Are images crisp, relevant and well-cropped, or stretched, generic stock, or absent?",
    technical: "Imagery quality",
    plain: "Photos and graphics",
  },
  {
    id: "consistency",
    question: "Do buttons, cards and spacing follow one consistent system, or vary at random?",
    technical: "Visual consistency",
    plain: "Consistent styling",
  },
];

export const TRUST_CRITERIA: CriterionDef[] = [
  {
    id: "contactInfo",
    question: "Is contact information visible — phone, email, address, or a contact link?",
    technical: "Contact information",
    plain: "Ways to reach you",
  },
  {
    id: "socialProof",
    question: "Is there social proof — testimonials, reviews, ratings, client logos, or case studies?",
    technical: "Social proof",
    plain: "Reviews and testimonials",
  },
  {
    id: "identity",
    question: "Is there a visible company identity — About section, team, or story?",
    technical: "Company identity",
    plain: "Who you are",
  },
  {
    id: "polish",
    question: "Is it free of placeholder text, broken images, and obvious typos?",
    technical: "Production polish",
    plain: "Finished and error-free",
  },
  {
    id: "transparency",
    question: "Are pricing, terms, or policy links clearly available?",
    technical: "Transparency",
    plain: "Clear pricing and terms",
  },
  {
    id: "legitimacy",
    question: "Does it look like real custom branding, or an unmodified off-the-shelf template?",
    technical: "Brand legitimacy",
    plain: "Looks like a real business",
  },
];

export const UX_CRITERIA: CriterionDef[] = [
  {
    id: "navClarity",
    question: "Is there a discernible navigation with meaningful, plain-language labels?",
    technical: "Navigation clarity",
    plain: "Easy-to-follow menu",
  },
  {
    id: "primaryAction",
    question: "Is there one obvious next step visible without scrolling?",
    technical: "Primary call-to-action",
    plain: "Obvious next step",
  },
  {
    id: "valueClarity",
    question: "Can a first-time visitor tell what this site offers within five seconds?",
    technical: "Value proposition clarity",
    plain: "Clear what you offer",
  },
  {
    id: "readability",
    question: "Is text readable — sufficient contrast against its background, sensible line lengths?",
    technical: "Readability",
    plain: "Easy to read",
  },
  {
    id: "scannability",
    question: "Is content broken into headings and chunks, or presented as undifferentiated walls of text?",
    technical: "Scannability",
    plain: "Easy to skim",
  },
  {
    id: "focus",
    question: "Is there one clear path forward, or many competing demands for attention?",
    technical: "Focus",
    plain: "Not overwhelming",
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

export function criterionLabel(id: string, mode: ReportMode): string {
  const def = ALL_CRITERIA.find((c) => c.id === id);
  if (!def) return id;
  return mode === "plain" ? def.plain : def.technical;
}

export function isKnownCriterion(category: AssessedCategory, id: string): boolean {
  return CRITERIA_BY_CATEGORY[category].some((c) => c.id === id);
}
