import { ProgressStage, SeoFacts } from "./types";

export interface ExtractedSiteData extends SeoFacts {
  h1Tags: string[];
  viewportContent: string | null;
  canonicalUrl: string | null;
  detectedStack: string;
  /**
   * Where the HTML behind the SEO checks came from.
   * "scraper-html" = the scraper's rendered DOM (JS executed — preferred).
   * "raw-fetch"    = our own fetch of unrendered HTML (no JS; SPA content invisible).
   */
  dataSource: "scraper-html" | "raw-fetch";
}

/** Our own scraper service: headless Chromium, auto-scroll, cookie banners removed. */
const SCRAPER_ENDPOINT =
  process.env.SCRAPER_ENDPOINT ?? "https://zyntlox-scraper.vercel.app/api/scrape";

/** Chromium + auto-scroll takes ~16s on a heavy page; leave generous headroom. */
const SCRAPER_TIMEOUT_MS = 60000;

/** Caps prompt size and latency. Smashing Magazine's homepage is ~19.5k for reference. */
const MAX_MARKDOWN_CHARS = 24000;

const STACK_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /next\.?js/i, label: "Next.js/React (JSX)" },
  { pattern: /react/i, label: "React (JSX)" },
  { pattern: /wordpress/i, label: "WordPress (PHP/HTML)" },
  { pattern: /vue\.?js/i, label: "Vue (HTML templates)" },
  { pattern: /angular/i, label: "Angular (HTML templates)" },
  { pattern: /shopify/i, label: "Shopify (Liquid/HTML)" },
  { pattern: /wix/i, label: "Wix (HTML)" },
];

function detectStackFromHtml(html: string): string {
  if (/id=["']?__next|_next\/static/i.test(html)) return "Next.js/React (JSX)";
  if (/data-reactroot|id=["']?root["']?[^>]*>[\s\S]*react/i.test(html)) return "React (JSX)";
  if (/wp-content|wp-includes/i.test(html)) return "WordPress (PHP/HTML)";
  if (/data-v-app|__vue/i.test(html)) return "Vue (HTML templates)";
  if (/ng-version/i.test(html)) return "Angular (HTML templates)";
  if (/cdn\.shopify\.com/i.test(html)) return "Shopify (Liquid/HTML)";
  if (/wixstatic\.com/i.test(html)) return "Wix (HTML)";
  return "plain HTML/CSS";
}

/**
 * Parses an HTML start tag's attributes, handling double-quoted, single-quoted, and
 * UNQUOTED values (`name=description`), which are valid HTML5 and common in minified
 * output. Quote-requiring regexes reported such tags as missing entirely — that was the
 * real cause of Smashing Magazine's "missing meta description".
 */
function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag)) !== null) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function findMetaContent(html: string, name: string): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    if (attrs.name?.toLowerCase() === name) {
      return attrs.content?.trim() || null;
    }
  }
  return null;
}

function findLinkHref(html: string, rel: string): string | null {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    if (attrs.rel?.toLowerCase().split(/\s+/).includes(rel)) {
      return attrs.href?.trim() || null;
    }
  }
  return null;
}

/** Everything the SEO checks need, derived from HTML — never from markdown. */
function extractSeoFactsFromHtml(
  html: string,
  hasHttps: boolean,
  dataSource: ExtractedSiteData["dataSource"]
): ExtractedSiteData {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  // `[\s\S]` rather than `.` so multi-line H1 content still matches.
  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1ElementCount = h1Matches.length;
  const h1Tags = h1Matches
    .map((m) => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Attribute PRESENCE: an explicit alt="" is correct markup for a decorative image,
  // not a missing description.
  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const totalImages = imgTags.length;
  const imagesWithAlt = imgTags.filter((tag) => "alt" in parseAttributes(tag)).length;
  const imagesWithoutAlt = Math.max(0, totalImages - imagesWithAlt);

  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() || null : null;
  const metaDescription = findMetaContent(html, "description");
  const viewportContent = findMetaContent(html, "viewport");
  const canonicalUrl = findLinkHref(html, "canonical");

  return {
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    h1Tags,
    h1Count: h1Tags.length,
    h1ElementCount,
    viewportPresent: viewportContent !== null,
    viewportContent,
    canonicalPresent: canonicalUrl !== null,
    canonicalUrl,
    totalImages,
    imagesWithAlt,
    imagesWithoutAlt,
    hasHttps,
    detectedStack: detectStackFromHtml(html),
    dataSource,
    // Only rendered HTML is trustworthy for JS-heavy sites.
    isVerified: dataSource === "scraper-html",
  };
}

interface ScraperResult {
  screenshotBase64: string | null;
  markdown: string | null;
  /** Present once the scraper returns the rendered DOM; preferred over a raw fetch. */
  html: string | null;
}

/**
 * Calls our scraper service: one headless-Chromium page load produces the screenshot,
 * the markdown, and (once exposed) the rendered HTML — so all three describe the same
 * page state. Scraping twice could let the screenshot and the SEO facts disagree.
 */
async function fetchFromScraper(
  url: string
): Promise<{ ok: true; data: ScraperResult } | { ok: false; reason: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS);

  try {
    const res = await fetch(`${SCRAPER_ENDPOINT}?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, reason: `Scraper returned HTTP ${res.status}` };
    }

    const json = await res.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return { ok: false, reason: "Scraper returned a non-JSON body" };
    }

    // The screenshot arrives as a data URI; Gemini's inline_data wants bare base64.
    const rawScreenshot = typeof json.screenshot === "string" ? json.screenshot : null;
    const screenshotBase64 = rawScreenshot
      ? rawScreenshot.replace(/^data:image\/\w+;base64,/, "")
      : null;

    const rawMarkdown = typeof json.markdown === "string" ? json.markdown.trim() : "";
    const markdown = rawMarkdown
      ? rawMarkdown.slice(0, MAX_MARKDOWN_CHARS)
      : null;

    return {
      ok: true,
      data: {
        screenshotBase64,
        markdown,
        html: typeof json.html === "string" && json.html.length > 0 ? json.html : null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Unknown scraper error",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface SiteDataTimings {
  totalMs: number;
  scraperMs: number | null;
  htmlFetchMs: number | null;
}

export type SiteDataResult =
  | {
      ok: true;
      extractedData: ExtractedSiteData;
      screenshotBase64: string | null;
      /** Clean page text for the AI's content-dependent judgments. */
      markdown: string | null;
      timings: SiteDataTimings;
    }
  | { ok: false; error: string };

export interface FetchSiteDataOptions {
  /** DEV/DIAGNOSTICS ONLY. Skip the scraper and use a raw HTML fetch only. */
  forceRawFetch?: boolean;
  /** DEV/DIAGNOSTICS ONLY. Skip the screenshot/markdown call entirely. */
  skipScraper?: boolean;
}

export async function fetchSiteData(
  url: string,
  onStage?: (stage: ProgressStage) => void,
  siteLabel?: string,
  options?: FetchSiteDataOptions
): Promise<SiteDataResult> {
  const startedAt = Date.now();
  let scraperMs: number | null = null;
  let htmlFetchMs: number | null = null;

  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();
  const prefix = siteLabel ? `${siteLabel}: ` : "";
  const hasHttps = url.toLowerCase().startsWith("https://");

  const useScraper =
    !options?.skipScraper &&
    !(process.env.NODE_ENV !== "production" && options?.forceRawFetch === true);

  let screenshotBase64: string | null = null;
  let markdown: string | null = null;
  let renderedHtml: string | null = null;

  if (useScraper) {
    onStage?.({ id: "scraper", label: `${prefix}Rendering ${hostname}` });
    const scraperStartedAt = Date.now();
    const result = await fetchFromScraper(url);
    scraperMs = Date.now() - scraperStartedAt;

    if (result.ok) {
      screenshotBase64 = result.data.screenshotBase64;
      markdown = result.data.markdown;
      renderedHtml = result.data.html;
    } else {
      console.warn(`Scraper failed for ${hostname} (${result.reason}); continuing without it`);
    }
  }

  // Preferred path: the scraper's rendered DOM, which has JS-loaded content.
  if (renderedHtml) {
    return {
      ok: true,
      extractedData: extractSeoFactsFromHtml(renderedHtml, hasHttps, "scraper-html"),
      screenshotBase64,
      markdown,
      timings: { totalMs: Date.now() - startedAt, scraperMs, htmlFetchMs },
    };
  }

  // Interim path until the scraper exposes `html`: fetch the markup ourselves. Markdown
  // cannot substitute here — it strips meta tags, alt attributes and heading structure,
  // which is exactly what the SEO checks measure.
  onStage?.({ id: "fetch_html", label: `${prefix}Reading page markup` });
  const htmlStartedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
  } catch {
    return { ok: false, error: "Could not fetch this website. Please check the URL." };
  }

  if (!response.ok) {
    return { ok: false, error: "Could not fetch this website. Please check the URL." };
  }

  const html = await response.text();
  htmlFetchMs = Date.now() - htmlStartedAt;

  return {
    ok: true,
    extractedData: extractSeoFactsFromHtml(
      html,
      response.url.startsWith("https://"),
      "raw-fetch"
    ),
    screenshotBase64,
    markdown,
    timings: { totalMs: Date.now() - startedAt, scraperMs, htmlFetchMs },
  };
}
