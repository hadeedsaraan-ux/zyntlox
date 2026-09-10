import { Report, ReportMode, SeoCheck } from "./types";

export const LABELS: Record<
  ReportMode,
  {
    firstImpression: string;
    design: string;
    trust: string;
    ux: string;
    seo: string;
    biggestProblems: string;
    quickWins: string;
    suggestions: string;
    technicalSeoChecks: string;
    seoUnverifiedNotice: string;
    backupModelNotice: string;
    scoreBreakdown: string;
  }
> = {
  technical: {
    firstImpression: "First Impression",
    design: "Design",
    trust: "Trust",
    ux: "UX",
    seo: "SEO",
    biggestProblems: "Biggest Problems",
    quickWins: "Quick Wins",
    suggestions: "AI Suggestions",
    technicalSeoChecks: "Technical SEO Checks",
    seoUnverifiedNotice:
      "These checks are best-effort estimates from unrendered HTML (our screenshot/analysis service was unavailable) — some values may be inaccurate for JavaScript-heavy sites.",
    backupModelNotice: "Backup AI model used — subjective scores below may be less consistent than usual.",
    scoreBreakdown: "Score Breakdown",
  },
  plain: {
    firstImpression: "What Visitors See",
    design: "Looks",
    trust: "Trustworthiness",
    ux: "Ease of Use",
    seo: "Found on Google?",
    biggestProblems: "What's Hurting You",
    quickWins: "Easy Fixes",
    suggestions: "What To Do Next",
    technicalSeoChecks: "Search Engine Checklist",
    seoUnverifiedNotice:
      "We couldn't fully load this page to double check these numbers, so a few of them below might be a little off.",
    backupModelNotice: "We used our backup AI for this one — a few of the opinions above might be a little less sharp than usual.",
    scoreBreakdown: "How We Scored It",
  },
};

export const SEO_CHECK_LABELS: Record<ReportMode, Record<SeoCheck["id"], string>> = {
  technical: {
    https: "HTTPS",
    noindex: "Indexability",
    metaDescription: "Meta Description",
    title: "Title Tag",
    viewport: "Viewport Tag",
    zoomBlocked: "Pinch-to-Zoom",
    canonical: "Canonical Tag",
    socialPreview: "Open Graph Tags",
    favicon: "Favicon",
    langAttribute: "Lang Attribute",
  },
  plain: {
    https: "Secure Connection",
    noindex: "Visible on Google",
    metaDescription: "Search Result Snippet",
    title: "Page Title",
    viewport: "Mobile-Friendly Tag",
    zoomBlocked: "Zooming on Phones",
    canonical: "Duplicate-Page Marker",
    socialPreview: "Link Sharing Preview",
    favicon: "Browser Tab Icon",
    langAttribute: "Page Language",
  },
};

export type SeoCheckGroup = "discoverability" | "sharing" | "device";

/** Which section of the checklist each check is rendered under. */
export const SEO_CHECK_GROUP: Record<SeoCheck["id"], SeoCheckGroup> = {
  noindex: "discoverability",
  title: "discoverability",
  metaDescription: "discoverability",
  canonical: "discoverability",
  socialPreview: "sharing",
  favicon: "sharing",
  https: "device",
  viewport: "device",
  zoomBlocked: "device",
  langAttribute: "device",
};

export const SEO_GROUP_ORDER: SeoCheckGroup[] = ["discoverability", "sharing", "device"];

export const SEO_GROUP_LABELS: Record<ReportMode, Record<SeoCheckGroup, string>> = {
  technical: {
    discoverability: "Search & Discoverability",
    sharing: "Sharing & Branding",
    device: "Mobile, Security & Accessibility",
  },
  plain: {
    discoverability: "Getting Found Online",
    sharing: "How Your Links Look",
    device: "Phones, Safety & Access",
  },
};

/**
 * Groups checks for display while preserving the audit's own ordering within each
 * group. Shared by the web report and the PDF so the two can't drift apart.
 */
export function groupSeoChecks(
  checks: SeoCheck[]
): Array<{ group: SeoCheckGroup; checks: SeoCheck[] }> {
  return SEO_GROUP_ORDER.map((group) => ({
    group,
    checks: checks.filter((check) => SEO_CHECK_GROUP[check.id] === group),
  })).filter((section) => section.checks.length > 0);
}

export function formatSeoCheckDetail(check: SeoCheck, mode: ReportMode): string {
  const plain = mode === "plain";

  switch (check.id) {
    case "https":
      return check.values.hasHttps
        ? plain
          ? "This site uses a secure (HTTPS) connection."
          : "Site is served over HTTPS."
        : plain
        ? "This site is not using a secure connection — browsers may warn visitors."
        : "Site is not served over HTTPS.";

    case "metaDescription":
      if (!check.values.present) {
        return plain
          ? "No search result snippet was found."
          : "No meta description tag was found.";
      }
      return plain
        ? `Search result snippet is present (${check.values.length} characters).`
        : `Meta description is present (${check.values.length} characters).`;

    case "title": {
      if (!check.values.present) {
        return plain ? "No page title was found." : "No title tag was found.";
      }
      if (check.values.generic) {
        return plain
          ? `The page title is still the default "${check.values.title}" — it tells visitors and Google nothing about your business.`
          : `Title tag is a framework/CMS default ("${check.values.title}") — it carries no keywords or brand.`;
      }
      return plain
        ? `Page title is present (${check.values.length} characters).`
        : `Title tag is present (${check.values.length} characters).`;
    }

    case "viewport":
      return check.values.present
        ? plain
          ? "This page is set up to work well on mobile devices."
          : "Viewport meta tag is present."
        : plain
        ? "This page isn't set up to work well on mobile devices."
        : "Viewport meta tag is missing.";

    case "canonical":
      return check.values.present
        ? plain
          ? "This page marks itself as the main version to avoid duplicate-content confusion."
          : "Canonical tag is present."
        : plain
        ? "This page doesn't mark itself as the main version, which can confuse search engines."
        : "Canonical tag is missing.";

    case "noindex":
      if (!check.values.isNoindex) {
        return plain
          ? "Nothing on this page is telling Google to hide it from search results."
          : "No noindex directive found — the page is crawlable.";
      }
      return plain
        ? "This page tells Google not to show it in search results at all. If that wasn't deliberate, it's the single most damaging thing on this list."
        : `Page carries a noindex directive ("${check.values.directives}") — it is excluded from search results entirely.`;

    case "socialPreview": {
      const { hasTitle, hasDescription, hasImage } = check.values as {
        hasTitle: boolean;
        hasDescription: boolean;
        hasImage: boolean;
      };
      if (hasTitle && hasDescription && hasImage) {
        return plain
          ? "Sharing a link to this page shows a proper preview with a picture."
          : "Open Graph title, description and image are all present.";
      }
      if (!hasTitle && !hasDescription && !hasImage) {
        return plain
          ? "No sharing preview is set up — links to this page will look bare on social media and in messages."
          : "No Open Graph tags found — shared links render without a preview card.";
      }
      const missing = [
        !hasTitle ? (plain ? "a title" : "og:title") : null,
        !hasDescription ? (plain ? "a description" : "og:description") : null,
        !hasImage ? (plain ? "a picture" : "og:image") : null,
      ].filter(Boolean);
      return plain
        ? `The sharing preview is missing ${missing.join(" and ")}, so shared links will look half-finished.`
        : `Open Graph tags are incomplete — missing ${missing.join(", ")}.`;
    }

    case "favicon":
      return check.values.present
        ? plain
          ? "This page has an icon for the browser tab."
          : "A favicon link tag is present."
        : plain
        ? "No browser-tab icon is set, so this page shows a blank placeholder in tabs and bookmarks."
        : "No favicon link tag found — browsers fall back to a default icon.";

    case "zoomBlocked":
      if (!check.values.applicable) {
        return plain
          ? "No mobile settings were found to check for zoom blocking."
          : "No viewport tag present, so zoom settings could not be evaluated.";
      }
      return check.values.blocked
        ? plain
          ? "This page stops people from pinching to zoom in on their phone — a real problem for anyone with less-than-perfect eyesight."
          : `Viewport blocks pinch-zoom ("${check.values.viewport}") — a WCAG 1.4.4 failure.`
        : plain
        ? "Visitors can pinch to zoom in on their phone."
        : "Viewport permits pinch-zoom.";

    case "langAttribute":
      return check.values.present
        ? plain
          ? `The page declares its language (${check.values.lang}), which helps screen readers read it correctly.`
          : `<html lang="${check.values.lang}"> is set.`
        : plain
        ? "The page doesn't say what language it's in, so screen readers may read it with the wrong accent or pronunciation."
        : "The <html> element has no lang attribute.";

      }
}

export const IMPACT_LABELS: Record<
  ReportMode,
  Record<Report["biggestProblems"][number]["impact"], string>
> = {
  technical: { High: "High", Medium: "Medium", Low: "Low" },
  plain: { High: "Big Deal", Medium: "Worth Fixing", Low: "Minor" },
};

export const EFFORT_LABELS: Record<
  ReportMode,
  Record<Report["biggestProblems"][number]["effort"], string>
> = {
  technical: { Easy: "Easy", Medium: "Medium", Hard: "Hard" },
  plain: { Easy: "Quick Fix", Medium: "Some Work", Hard: "Bigger Project" },
};
