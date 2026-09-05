import { SeoCheck, SeoChecks, SeoFacts } from "./types";

// Ideal ranges, in characters.
const TITLE_MIN = 30;
const TITLE_MAX = 60;
const META_DESC_MIN = 50;
const META_DESC_MAX = 160;

// Per-check max point deductions. These sum to exactly 10, matching the 0-10 scale.
// HTTPS is weighted heaviest: it's a binary, zero-ambiguity signal with outsized
// user-visible impact (browser "Not Secure" warnings). Canonical is weighted lightest:
// duplicate-content issues are a comparatively minor, situational risk for most of the
// small/marketing sites this tool audits.
const WEIGHTS = {
  https: 3.0,
  metaDescription: 1.5,
  title: 1.5,
  h1: 1.5,
  viewport: 1.0,
  canonical: 0.5,
  altText: 1.0,
} as const;

export function computeSeoAudit(facts: SeoFacts): SeoChecks {
  const checks: SeoCheck[] = [
    computeHttpsCheck(facts),
    computeMetaDescriptionCheck(facts),
    computeTitleCheck(facts),
    computeH1Check(facts),
    computeViewportCheck(facts),
    computeCanonicalCheck(facts),
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

  return {
    id: "metaDescription",
    status: !present ? "fail" : inRange ? "pass" : "warn",
    pointsDeducted: !present ? WEIGHTS.metaDescription : inRange ? 0 : 0.5,
    values: { present, length: facts.metaDescriptionLength },
  };
}

function computeTitleCheck(facts: SeoFacts): SeoCheck {
  const present = facts.title !== null && facts.titleLength > 0;
  const inRange = present && facts.titleLength >= TITLE_MIN && facts.titleLength <= TITLE_MAX;

  return {
    id: "title",
    status: !present ? "fail" : inRange ? "pass" : "warn",
    pointsDeducted: !present ? WEIGHTS.title : inRange ? 0 : 0.5,
    values: { present, length: facts.titleLength },
  };
}

function computeH1Check(facts: SeoFacts): SeoCheck {
  const { h1Count } = facts;
  const status: SeoCheck["status"] = h1Count === 0 ? "fail" : h1Count > 1 ? "warn" : "pass";
  const pointsDeducted = h1Count === 0 ? WEIGHTS.h1 : h1Count > 1 ? WEIGHTS.h1 * 0.5 : 0;

  return {
    id: "h1",
    status,
    pointsDeducted,
    values: { count: h1Count },
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

function computeAltTextCheck(facts: SeoFacts): SeoCheck {
  const { totalImages, imagesWithAlt, imagesWithoutAlt } = facts;

  if (totalImages === 0) {
    return {
      id: "altText",
      status: "pass",
      pointsDeducted: 0,
      values: { totalImages, imagesWithAlt, imagesWithoutAlt },
    };
  }

  const missingRatio = imagesWithoutAlt / totalImages;
  const pointsDeducted = missingRatio * WEIGHTS.altText;
  const status: SeoCheck["status"] =
    imagesWithoutAlt === 0 ? "pass" : imagesWithoutAlt === totalImages ? "fail" : "warn";

  return {
    id: "altText",
    status,
    pointsDeducted,
    values: { totalImages, imagesWithAlt, imagesWithoutAlt },
  };
}
