import { DomImage, DomLink, ProgressStage, SeoFacts } from "./types";

export interface ExtractedSiteData extends SeoFacts {
  canonicalUrl: string | null;
  detectedStack: string;
  /**
   * Where the HTML behind the SEO checks came from.
   * "scraper-html" = the scraper's rendered DOM (JS executed — preferred).
   * "raw-fetch"    = our own fetch of unrendered HTML (no JS; SPA content invisible).
   */
  dataSource: "scraper-html" | "raw-fetch";
  /**
   * Every `<a href>` on the rendered, hidden-content-stripped page, read live via
   * `page.evaluate()` in the scraper. `null` on the raw-fetch path or an older scraper
   * deployment — contentChecks.ts falls back to parsing the markdown's links when this
   * is absent. See `DomLink` for why an icon-only link's name can't come from markdown:
   * the scraper flattens inline SVGs to literal text before Turndown ever runs.
   */
  domLinks: DomLink[] | null;
  /**
   * A postal address found in structured data — a JSON-LD `PostalAddress` block or
   * `itemprop="address"` microdata — rather than guessed from prose. This is the
   * highest-confidence signal `physicalAddress` can have: it's the same markup search
   * engines already trust for exactly this purpose, and it's immune to the false
   * positives a text regex is prone to (a headline mentioning a number and a street-type
   * word is not structured data). `null` when no such markup is present.
   */
  structuredAddress: string | null;
}

/** Our own scraper service: headless Chromium, auto-scroll, cookie banners removed. */
const SCRAPER_ENDPOINT =
  process.env.SCRAPER_ENDPOINT ?? "https://zyntlox-scraper.vercel.app/api/scrape";

/** Chromium + auto-scroll takes ~16s on a heavy page; leave generous headroom. */
const SCRAPER_TIMEOUT_MS = 60000;

/** Caps prompt size and latency. Smashing Magazine's homepage is ~19.5k for reference. */
const MAX_MARKDOWN_CHARS = 24000;

/**
 * Screenshot budget, expressed in Gemini's own units.
 *
 * Gemini bills images by tiling them into 768x768 crops at 258 tokens each. A raw
 * full-page capture (1280 x 9198 on Smashing Magazine) is 2 x 12 = 24 tiles, ~6,192
 * tokens — by far the largest single item in the prompt.
 *
 * Downscaling to 768 wide makes it 1 tile across instead of 2, halving the cost while
 * keeping the ENTIRE page visible. Cropping to the same budget would instead discard
 * two-thirds of the page, which is the part of the input the design criteria actually
 * judge. Fine detail is the acceptable loss here: the model reads copy from the markdown,
 * and the screenshot is there for layout, spacing, colour and hierarchy.
 *
 * The height cap is the backstop for pathologically long pages (infinite-scroll feeds
 * capture at 40,000px+), where the tail is repetitive and the top carries the signal.
 */
const SCREENSHOT_TILE_PX = 768;
const SCREENSHOT_MAX_WIDTH = SCREENSHOT_TILE_PX; // 1 tile across
const SCREENSHOT_MAX_HEIGHT = SCREENSHOT_TILE_PX * 8; // 8 tiles down => <=2,064 tokens

/**
 * Brings a full-page capture inside the tile budget above. Returns the input unchanged if
 * it is already small enough, or if resizing fails for any reason — an oversized
 * screenshot is a cost problem, never a reason to fail the whole report.
 */
async function capScreenshot(
  base64: string
): Promise<{ data: string; resized: boolean; width: number | null; height: number | null }> {
  try {
    const { default: sharp } = await import("sharp");
    const input = Buffer.from(base64, "base64");
    const image = sharp(input);
    const { width, height } = await image.metadata();

    if (!width || !height) return { data: base64, resized: false, width: null, height: null };
    if (width <= SCREENSHOT_MAX_WIDTH && height <= SCREENSHOT_MAX_HEIGHT) {
      return { data: base64, resized: false, width, height };
    }

    const scale = Math.min(1, SCREENSHOT_MAX_WIDTH / width);
    const scaledHeight = Math.round(height * scale);

    let pipeline = image.resize({
      width: Math.round(width * scale),
      height: scaledHeight,
      fit: "fill",
    });

    // Only after scaling do we know whether the height cap still bites.
    if (scaledHeight > SCREENSHOT_MAX_HEIGHT) {
      pipeline = pipeline.extract({
        left: 0,
        top: 0,
        width: Math.round(width * scale),
        height: SCREENSHOT_MAX_HEIGHT,
      });
    }

    const output = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    const meta = await sharp(output).metadata();

    return {
      data: output.toString("base64"),
      resized: true,
      width: meta.width ?? null,
      height: meta.height ?? null,
    };
  } catch (err) {
    console.warn(
      `Screenshot resize failed (${err instanceof Error ? err.message : "unknown"}); sending the original`
    );
    return { data: base64, resized: false, width: null, height: null };
  }
}

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

/**
 * Open Graph tags are keyed by `property`, not `name` — but plenty of CMS templates emit
 * `name="og:image"` instead. Both are accepted here; rejecting the second form would
 * report a working link preview as missing.
 */
function findMetaProperty(html: string, property: string): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    const key = (attrs.property ?? attrs.name)?.toLowerCase();
    if (key === property) {
      return attrs.content?.trim() || null;
    }
  }
  return null;
}

/** Framework and CMS defaults nobody ever means to ship. Compared lowercased + trimmed. */
const GENERIC_TITLES = new Set([
  "home",
  "home page",
  "homepage",
  "index",
  "untitled",
  "untitled document",
  "document",
  "page",
  "new page",
  "welcome",
  "website",
  "my site",
  "my website",
  "react app",
  "create next app",
  "next.js app",
  "vite app",
  "vite + react",
  "vite + react + ts",
  "webflow site",
  "site",
  "test",
  "example domain",
]);

/**
 * Platform default meta descriptions nobody wrote on purpose — the description-tag
 * equivalent of `GENERIC_TITLES` above. officeflowai.io shipping the literal Next.js
 * default ("Generated by create next app") and passing the presence/length check is
 * what this catches: being present and the right length isn't the same as being real.
 */
const GENERIC_DESCRIPTIONS = new Set([
  "generated by create next app",
  "generated by create-next-app",
  "web site created using create-react-app",
  "welcome to your vite + react app",
  "a next.js app",
  "a new react app",
]);

/**
 * Pulls a postal address out of structured data — a JSON-LD block with
 * `"@type":"PostalAddress"`, or `itemprop="address"` microdata — rather than guessing
 * from prose. Deliberately simple regex extraction rather than a full JSON-LD parse:
 * this only needs to notice the block exists and grab a readable snippet from it, not
 * validate its shape.
 */
function findStructuredAddress(html: string): string | null {
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const block = match[1];
    if (!/"@type"\s*:\s*"PostalAddress"/i.test(block)) continue;

    const street = block.match(/"streetAddress"\s*:\s*"([^"]+)"/i)?.[1];
    const locality = block.match(/"addressLocality"\s*:\s*"([^"]+)"/i)?.[1];
    const region = block.match(/"addressRegion"\s*:\s*"([^"]+)"/i)?.[1];
    const postal = block.match(/"postalCode"\s*:\s*"([^"]+)"/i)?.[1];

    const assembled = [street, locality, region, postal].filter(Boolean).join(", ");
    if (assembled) return assembled;
  }

  // Microdata: itemprop="address" wraps a block of nested itemprop text nodes.
  const microdataMatch = html.match(
    /itemprop=["']address["'][^>]*>([\s\S]{0,400}?)<\/(?:div|address|span)>/i
  );
  if (microdataMatch) {
    const text = microdataMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) return text.slice(0, 200);
  }

  return null;
}

/** `user-scalable=no` and a capped `maximum-scale` both defeat pinch-zoom. */
function viewportBlocksZoom(viewportContent: string | null): boolean {
  if (!viewportContent) return false;
  const normalized = viewportContent.toLowerCase().replace(/\s+/g, "");
  if (/user-scalable=(no|0)/.test(normalized)) return true;

  const maxScale = normalized.match(/maximum-scale=([\d.]+)/);
  return maxScale ? Number(maxScale[1]) < 2 : false;
}

/**
 * Extracts every fact the checks need. Scoped to `<head>` (plus `<html lang>` and the URL
 * scheme) — nothing here walks the document body.
 *
 * That scoping is what makes these numbers trustworthy. Head tags are server-rendered even
 * by client-side SPAs, because crawlers and social-card scrapers never run JavaScript; body
 * content on the raw-fetch path may not exist yet, which is why the old alt-text/H1/link
 * counts were the least reliable figures in the report.
 */
function extractSeoFactsFromHtml(
  html: string,
  hasHttps: boolean,
  dataSource: ExtractedSiteData["dataSource"],
  /** From the scraper's separate Cheerio/page.evaluate() passes — see the SeoFacts and DomImage/DomLink doc comments for why these two live outside the head-only scan. */
  domFacts: { h1Count: number | null; domImages: DomImage[] | null; domLinks: DomLink[] | null }
): ExtractedSiteData {
  // Confine tag scanning to <head>. A stray <meta> or <title> inside an inlined SVG or a
  // JSON blob in the body would otherwise be read as the page's own metadata.
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const head = headMatch ? headMatch[1] : html;

  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() || null : null;

  const metaDescription = findMetaContent(head, "description");
  const viewportContent = findMetaContent(head, "viewport");
  const canonicalUrl = findLinkHref(head, "canonical");

  // `googlebot` overrides `robots` for Google specifically; a noindex in either counts.
  const robotsMeta = findMetaContent(head, "robots");
  const googlebotMeta = findMetaContent(head, "googlebot");
  const robotsDirectives = [robotsMeta, googlebotMeta].filter(Boolean).join(", ") || null;

  // The one tag outside <head> we read — it lives on the root <html> element.
  const htmlTag = html.match(/<html\b[^>]*>/i);
  const langAttribute = htmlTag ? parseAttributes(htmlTag[0]).lang?.trim() || null : null;

  const faviconPresent = ["icon", "shortcut", "apple-touch-icon", "mask-icon"].some(
    (rel) => findLinkHref(head, rel) !== null
  );

  return {
    title,
    titleLength: title?.length ?? 0,
    titleIsGeneric: title !== null && GENERIC_TITLES.has(title.toLowerCase().trim()),
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    metaDescriptionIsGeneric:
      metaDescription !== null && GENERIC_DESCRIPTIONS.has(metaDescription.toLowerCase().trim()),
    viewportPresent: viewportContent !== null,
    viewportContent,
    viewportBlocksZoom: viewportBlocksZoom(viewportContent),
    canonicalPresent: canonicalUrl !== null,
    canonicalUrl,
    hasHttps,
    robotsDirectives,
    isNoindex: /\bnoindex\b/i.test(robotsDirectives ?? ""),
    ogTitle: findMetaProperty(head, "og:title"),
    ogDescription: findMetaProperty(head, "og:description"),
    ogImage: findMetaProperty(head, "og:image"),
    langAttribute,
    faviconPresent,
    h1Count: domFacts.h1Count,
    domImages: domFacts.domImages,
    domLinks: domFacts.domLinks,
    structuredAddress: findStructuredAddress(html),
    detectedStack: detectStackFromHtml(html),
    dataSource,
    // Head tags can still be set client-side (react-helmet and friends), so the rendered
    // DOM remains the more trustworthy source even though the gap is now much narrower.
    isVerified: dataSource === "scraper-html",
  };
}

interface ScraperResult {
  screenshotBase64: string | null;
  /** Non-fatal note from the scraper, e.g. a page that did not finish navigating. */
  warning: string | null;
  /** Capped copy, sized for the prompt. */
  markdown: string | null;
  /** Uncapped copy, for the deterministic content checks. See fullMarkdown below. */
  fullMarkdown: string | null;
  /** Present once the scraper returns the rendered DOM; preferred over a raw fetch. */
  html: string | null;
  /** From the scraper's Cheerio metadata pass (over the rendered, hidden-stripped page). */
  h1Count: number | null;
  /** From the scraper's page.evaluate() DOM read. `null` on an older scraper deployment. */
  domImages: DomImage[] | null;
  domLinks: DomLink[] | null;
}

function isDomImageLike(value: unknown): value is DomImage {
  return (
    typeof value === "object" &&
    value !== null &&
    "src" in value &&
    "naturalWidth" in value &&
    "hasAltAttribute" in value
  );
}

function isDomLinkLike(value: unknown): value is DomLink {
  return typeof value === "object" && value !== null && "href" in value && "accessibleName" in value;
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
    // The scraper caps the capture at this height, which saves the capture time and the
    // response bytes as well as the tokens. capScreenshot() below still runs: it is the
    // backstop for a scraper deployment that predates maxHeight support, and it also
    // downscales to the tile width, which the cap alone does not do.
    const params = new URLSearchParams({
      url,
      maxHeight: String(SCREENSHOT_MAX_HEIGHT),
    });
    const res = await fetch(`${SCRAPER_ENDPOINT}?${params}`, {
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
    let screenshotBase64 = rawScreenshot
      ? rawScreenshot.replace(/^data:image\/\w+;base64,/, "")
      : null;

    if (screenshotBase64) {
      const capped = await capScreenshot(screenshotBase64);
      if (capped.resized) {
        console.log(
          `Screenshot downscaled to ${capped.width}x${capped.height} ` +
            `(${Math.round(screenshotBase64.length / 1024)}KB -> ${Math.round(capped.data.length / 1024)}KB base64)`
        );
      }
      screenshotBase64 = capped.data;
    }

    const rawMarkdown = typeof json.markdown === "string" ? json.markdown.trim() : "";
    const fullMarkdown = rawMarkdown || null;
    const markdown = rawMarkdown ? rawMarkdown.slice(0, MAX_MARKDOWN_CHARS) : null;

    const h1Count =
      json.metadata && typeof json.metadata === "object" && typeof json.metadata.h1_count === "number"
        ? json.metadata.h1_count
        : null;
    const domImages = Array.isArray(json.images) ? json.images.filter(isDomImageLike) : null;
    const domLinks = Array.isArray(json.links) ? json.links.filter(isDomLinkLike) : null;

    return {
      ok: true,
      data: {
        screenshotBase64,
        warning: typeof json.warning === "string" && json.warning ? json.warning : null,
        markdown,
        fullMarkdown,
        html: typeof json.html === "string" && json.html.length > 0 ? json.html : null,
        h1Count,
        domImages,
        domLinks,
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
      /** Clean page text for the AI's content-dependent judgments, capped for the prompt. */
      markdown: string | null;
      /**
       * The SAME text, uncapped. The deterministic content checks must run against this,
       * never the capped copy: footer links — privacy, terms, contact, copyright — are
       * exactly what falls off the end, so checking the truncated text would report them
       * missing on precisely the sites with the most content.
       */
      fullMarkdown: string | null;
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
  let fullMarkdown: string | null = null;
  let renderedHtml: string | null = null;
  let h1Count: number | null = null;
  let domImages: DomImage[] | null = null;
  let domLinks: DomLink[] | null = null;

  if (useScraper) {
    onStage?.({ id: "scraper", label: `${prefix}Rendering ${hostname}` });
    const scraperStartedAt = Date.now();
    const result = await fetchFromScraper(url);
    scraperMs = Date.now() - scraperStartedAt;

    if (result.ok) {
      screenshotBase64 = result.data.screenshotBase64;
      markdown = result.data.markdown;
      fullMarkdown = result.data.fullMarkdown;
      renderedHtml = result.data.html;
      h1Count = result.data.h1Count;
      domImages = result.data.domImages;
      domLinks = result.data.domLinks;
      if (result.data.warning) {
        console.warn(`Scraper warning for ${hostname}: ${result.data.warning}`);
      }
    } else {
      console.warn(`Scraper failed for ${hostname} (${result.reason}); continuing without it`);
    }
  }

  // Preferred path: the scraper's rendered DOM, which has JS-loaded content.
  if (renderedHtml) {
    return {
      ok: true,
      extractedData: extractSeoFactsFromHtml(renderedHtml, hasHttps, "scraper-html", {
        h1Count,
        domImages,
        domLinks,
      }),
      screenshotBase64,
      markdown,
      fullMarkdown,
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
    extractedData: extractSeoFactsFromHtml(html, response.url.startsWith("https://"), "raw-fetch", {
      // No live browser on this path — nothing here can be known at all.
      h1Count: null,
      domImages: null,
      domLinks: null,
    }),
    screenshotBase64,
    markdown,
    fullMarkdown,
    timings: { totalMs: Date.now() - startedAt, scraperMs, htmlFetchMs },
  };
}
