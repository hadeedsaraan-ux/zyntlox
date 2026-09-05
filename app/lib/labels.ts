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
  },
};

export const SEO_CHECK_LABELS: Record<ReportMode, Record<SeoCheck["id"], string>> = {
  technical: {
    https: "HTTPS",
    metaDescription: "Meta Description",
    title: "Title Tag",
    h1: "H1 Heading",
    viewport: "Viewport Tag",
    canonical: "Canonical Tag",
    altText: "Image Alt Text",
  },
  plain: {
    https: "Secure Connection",
    metaDescription: "Search Result Snippet",
    title: "Page Title",
    h1: "Main Heading",
    viewport: "Mobile-Friendly Tag",
    canonical: "Duplicate-Page Marker",
    altText: "Picture Descriptions",
  },
};

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

    case "title":
      if (!check.values.present) {
        return plain ? "No page title was found." : "No title tag was found.";
      }
      return plain
        ? `Page title is present (${check.values.length} characters).`
        : `Title tag is present (${check.values.length} characters).`;

    case "h1": {
      const count = check.values.count as number;
      if (count === 0) {
        return plain ? "No main heading was found on the page." : "No H1 heading found.";
      }
      if (count > 1) {
        return plain
          ? `${count} main headings were found — usually there should only be one.`
          : `${count} H1 tags found — typically a page should have exactly one.`;
      }
      return plain ? "One main heading found — as expected." : "Exactly one H1 tag found.";
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

    case "altText": {
      const { totalImages, imagesWithoutAlt } = check.values as {
        totalImages: number;
        imagesWithAlt: number;
        imagesWithoutAlt: number;
      };
      if (totalImages === 0) {
        return plain ? "No pictures found on this page." : "No images found on this page.";
      }
      if (imagesWithoutAlt === 0) {
        return plain
          ? `All ${totalImages} pictures have descriptions for screen readers.`
          : `All ${totalImages} images have alt text.`;
      }
      return plain
        ? `${imagesWithoutAlt} out of ${totalImages} pictures don't have descriptions for people using screen readers.`
        : `${imagesWithoutAlt} of ${totalImages} images are missing alt text.`;
    }
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
