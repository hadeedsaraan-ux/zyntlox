import { SeoCheck, SeoChecks, SeoFacts } from "./types";

// Ideal ranges, in characters.
const TITLE_MIN = 30;
const TITLE_MAX = 60;
const META_DESC_MIN = 50;
const META_DESC_MAX = 160;

// Per-check max point deductions. These MUST sum to exactly 10 (asserted below), so that
// a site failing everything scores 0 and a site passing everything scores 10.
//
// Weighting follows consequence to the visitor or the business, not SEO folklore:
//   noindex/https  — catastrophic and binary. `noindex` makes the page invisible to search
//                    outright; missing HTTPS makes the browser label the site "Not Secure".
//   title/viewport — the search listing's headline, and whether the page works on a phone.
//   canonical      — deliberately near-zero. Duplicate-content risk is real for large
//                    catalogues and close to irrelevant for the small marketing sites this
//                    tool audits; weighting it like a title tag would be dishonest.
const WEIGHTS = {
  https: 2.0,
  noindex: 2.0,
  title: 1.5,
  viewport: 1.25,
  metaDescription: 1.0,
  socialPreview: 0.85,
  langAttribute: 0.6,
  zoomBlocked: 0.4,
  canonical: 0.2,
  favicon: 0.2,
} as const;

const WEIGHT_TOTAL = Object.values(WEIGHTS).reduce((sum, w) => sum + w, 0);
if (Math.abs(WEIGHT_TOTAL - 10) > 1e-9) {
  throw new Error(
    `SEO check weights must sum to 10 for the 0-10 scale to hold; got ${WEIGHT_TOTAL}.`
  );
}

export function computeSeoAudit(facts: SeoFacts): SeoChecks {
  const checks: SeoCheck[] = [
    // Search & discoverability
    computeNoindexCheck(facts),
    computeTitleCheck(facts),
    computeMetaDescriptionCheck(facts),
    computeCanonicalCheck(facts),
    // Sharing & branding
    computeSocialPreviewCheck(facts),
    computeFaviconCheck(facts),
    // Mobile, security & accessibility
    computeHttpsCheck(facts),
    computeViewportCheck(facts),
    computeZoomBlockedCheck(facts),
    computeLangAttributeCheck(facts),
  ];

  const totalDeductions = checks.reduce((sum, c) => sum + c.pointsDeducted, 0);
  const seoScore = Math.max(0, Math.round((10 - totalDeductions) * 10) / 10);

  return { checks, seoScore, isVerified: facts.isVerified };
}

function computeHttpsCheck(facts: SeoFacts): SeoCheck {
  const pass = facts.hasHttps;
  return {
    id: "https",
    status: pass ? "pass" : "fail",
    pointsDeducted: pass ? 0 : WEIGHTS.https,
    values: { hasHttps: facts.hasHttps },
  };
}

function computeMetaDescriptionCheck(facts: SeoFacts): SeoCheck {
  const present = facts.metaDescription !== null && facts.metaDescriptionLength > 0;
  const inRange =
    present &&
    facts.metaDescriptionLength >= META_DESC_MIN &&
    facts.metaDescriptionLength <= META_DESC_MAX;

  return {
    id: "metaDescription",
    status: !present ? "fail" : inRange ? "pass" : "warn",
    pointsDeducted: !present
      ? WEIGHTS.metaDescription
      : inRange
      ? 0
      : WEIGHTS.metaDescription * 0.4,
    values: { present, length: facts.metaDescriptionLength },
  };
}

function computeTitleCheck(facts: SeoFacts): SeoCheck {
  const present = facts.title !== null && facts.titleLength > 0;
  const inRange = present && facts.titleLength >= TITLE_MIN && facts.titleLength <= TITLE_MAX;
  const generic = facts.titleIsGeneric;

  // A framework default like "Create Next App" is worse than a badly-sized real title:
  // it's the right length and says nothing, so it costs the same as having no title.
  const status: SeoCheck["status"] = !present || generic ? "fail" : inRange ? "pass" : "warn";
  const pointsDeducted = !present || generic ? WEIGHTS.title : inRange ? 0 : WEIGHTS.title * 0.4;

  return {
    id: "title",
    status,
    pointsDeducted,
    values: { present, length: facts.titleLength, generic, title: facts.title },
  };
}

function computeViewportCheck(facts: SeoFacts): SeoCheck {
  const pass = facts.viewportPresent;
  return {
    id: "viewport",
    status: pass ? "pass" : "fail",
    pointsDeducted: pass ? 0 : WEIGHTS.viewport,
    values: { present: facts.viewportPresent },
  };
}

function computeCanonicalCheck(facts: SeoFacts): SeoCheck {
  const pass = facts.canonicalPresent;
  return {
    id: "canonical",
    status: pass ? "pass" : "fail",
    pointsDeducted: pass ? 0 : WEIGHTS.canonical,
    values: { present: facts.canonicalPresent },
  };
}

function computeNoindexCheck(facts: SeoFacts): SeoCheck {
  return {
    id: "noindex",
    status: facts.isNoindex ? "fail" : "pass",
    pointsDeducted: facts.isNoindex ? WEIGHTS.noindex : 0,
    values: { isNoindex: facts.isNoindex, directives: facts.robotsDirectives },
  };
}

/**
 * Open Graph tags decide what a shared link looks like. Scored as one check because
 * they only work together — an og:image with no og:title still renders a broken card.
 */
function computeSocialPreviewCheck(facts: SeoFacts): SeoCheck {
  const { ogTitle, ogDescription, ogImage } = facts;
  const present = [ogTitle, ogDescription, ogImage].filter(Boolean).length;

  // The image is what makes a shared link look deliberate rather than broken, so a set
  // missing only the image still counts as incomplete rather than a pass.
  const complete = Boolean(ogTitle && ogImage);
  const status: SeoCheck["status"] = present === 0 ? "fail" : complete ? "pass" : "warn";
  const pointsDeducted =
    present === 0 ? WEIGHTS.socialPreview : complete ? 0 : WEIGHTS.socialPreview * 0.5;

  return {
    id: "socialPreview",
    status,
    pointsDeducted,
    values: {
      hasTitle: Boolean(ogTitle),
      hasDescription: Boolean(ogDescription),
      hasImage: Boolean(ogImage),
      present,
    },
  };
}

function computeFaviconCheck(facts: SeoFacts): SeoCheck {
  return {
    id: "favicon",
    status: facts.faviconPresent ? "pass" : "fail",
    pointsDeducted: facts.faviconPresent ? 0 : WEIGHTS.favicon,
    values: { present: facts.faviconPresent },
  };
}

function computeZoomBlockedCheck(facts: SeoFacts): SeoCheck {
  // Nothing to block if there's no viewport tag at all — that failure is already
  // charged to the viewport check, and charging it twice would double-penalise.
  if (!facts.viewportPresent) {
    return {
      id: "zoomBlocked",
      status: "pass",
      pointsDeducted: 0,
      values: { applicable: false, blocked: false, viewport: null },
    };
  }

  return {
    id: "zoomBlocked",
    status: facts.viewportBlocksZoom ? "fail" : "pass",
    pointsDeducted: facts.viewportBlocksZoom ? WEIGHTS.zoomBlocked : 0,
    values: {
      applicable: true,
      blocked: facts.viewportBlocksZoom,
      viewport: facts.viewportContent ?? null,
    },
  };
}

function computeLangAttributeCheck(facts: SeoFacts): SeoCheck {
  const present = Boolean(facts.langAttribute);
  return {
    id: "langAttribute",
    status: present ? "pass" : "fail",
    pointsDeducted: present ? 0 : WEIGHTS.langAttribute,
    values: { present, lang: facts.langAttribute },
  };
}
