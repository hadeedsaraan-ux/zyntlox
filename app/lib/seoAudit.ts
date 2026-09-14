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
//   h1/altText     — reinstated now that the scraper computes them from the rendered,
//                    hidden-stripped page (h1 via Cheerio, altText via a live DOM read
//                    that also confirms each image actually loaded) — see the SeoCheck
//                    doc comment. Moderate weight: real structural/accessibility signals,
//                    but not in the same tier as being invisible to search entirely.
//   canonical/favicon — deliberately near-zero. Duplicate-content risk is real for large
//                    catalogues and close to irrelevant for the small marketing sites this
//                    tool audits; weighting it like a title tag would be dishonest.
const WEIGHTS = {
  https: 2.0,
  noindex: 2.0,
  title: 1.3,
  viewport: 1.0,
  metaDescription: 0.85,
  h1: 0.6,
  altText: 0.6,
  socialPreview: 0.6,
  langAttribute: 0.45,
  zoomBlocked: 0.35,
  canonical: 0.15,
  favicon: 0.1,
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
    computeH1Check(facts),
    computeAltTextCheck(facts),
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
  const generic = facts.metaDescriptionIsGeneric;

  // A platform default is worse than a badly-sized real description — it's plausible
  // length but says nothing about the site, so it costs the same as having none.
  const status: SeoCheck["status"] = !present || generic ? "fail" : inRange ? "pass" : "warn";
  const pointsDeducted =
    !present || generic ? WEIGHTS.metaDescription : inRange ? 0 : WEIGHTS.metaDescription * 0.4;

  return {
    id: "metaDescription",
    status,
    pointsDeducted,
    values: { present, length: facts.metaDescriptionLength, generic, description: facts.metaDescription },
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

/**
 * Only scored when `h1Count` is present — `null` means either the raw-fetch path (no
 * rendered DOM to count at all) or an older scraper deployment.
 */
function computeH1Check(facts: SeoFacts): SeoCheck {
  if (facts.h1Count === null) {
    return { id: "h1", status: "pass", pointsDeducted: 0, values: { applicable: false, count: null } };
  }

  const count = facts.h1Count;
  const status: SeoCheck["status"] = count === 1 ? "pass" : count === 0 ? "fail" : "warn";
  const pointsDeducted = count === 0 ? WEIGHTS.h1 : count === 1 ? 0 : WEIGHTS.h1 * 0.5;

  return { id: "h1", status, pointsDeducted, values: { applicable: true, count } };
}

/**
 * Denominator excludes broken images (`naturalWidth === 0` — never actually loaded, so
 * whether it has alt text is moot) and anything CSS-hidden (never reaches `domImages` at
 * all, since the scraper's DOM read runs after hidden-element stripping).
 *
 * ACCURACY UPDATE:
 * Previously, `alt=""` was counted as handled (assumed decorative). However, in real-world
 * audits, crucial assets like company logos or hero illustrations frequently carry empty `alt=""`
 * attributes due to careless theme defaults. In accordance with standard SEO audit rules
 * (Lighthouse/Ahrefs), both completely missing alt attributes AND empty/whitespace alt text
 * (`alt=""`) on rendered images are now flagged as missing.
 */
function computeAltTextCheck(facts: SeoFacts): SeoCheck {
  if (facts.domImages === null) {
    return { id: "altText", status: "pass", pointsDeducted: 0, values: { applicable: false, total: null } };
  }

  // Only consider images that actually rendered/loaded in the browser
  const countable = facts.domImages.filter((img) => img.naturalWidth > 0);

  // Missing if attribute is absent OR text is empty/whitespace
  const missing = countable.filter(
    (img) => !img.hasAltAttribute || !img.alt || img.alt.trim() === ""
  );

  const filenameLike = countable.filter(
    (img) =>
      img.hasAltAttribute &&
      img.alt &&
      /\.(jpe?g|png|gif|svg|webp|bmp)$/i.test(img.alt.trim())
  );

  if (countable.length === 0) {
    return {
      id: "altText",
      status: "pass",
      pointsDeducted: 0,
      values: { applicable: true, total: 0, missing: 0, filenameLike: 0 },
    };
  }

  const missingRatio = missing.length / countable.length;
  const status: SeoCheck["status"] =
    missing.length === 0 ? "pass" : missing.length === countable.length ? "fail" : "warn";

  return {
    id: "altText",
    status,
    pointsDeducted: missingRatio * WEIGHTS.altText,
    values: {
      applicable: true,
      total: countable.length,
      missing: missing.length,
      filenameLike: filenameLike.length,
    },
  };
}
