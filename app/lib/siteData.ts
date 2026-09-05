import { ProgressStage, SeoFacts } from "./types";

export interface ExtractedSiteData extends SeoFacts {
  h1Tags: string[];
  viewportContent: string | null;
  canonicalUrl: string | null;
  detectedStack: string;
  dataSource: "microlink" | "fallback-regex";
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
  if (/id=["']__next["']|_next\/static/i.test(html)) return "Next.js/React (JSX)";
  if (/data-reactroot|id=["']root["'][^>]*>[\s\S]*react/i.test(html)) return "React (JSX)";
  if (/wp-content|wp-includes/i.test(html)) return "WordPress (PHP/HTML)";
  if (/data-v-app|__vue/i.test(html)) return "Vue (HTML templates)";
  if (/ng-version/i.test(html)) return "Angular (HTML templates)";
  if (/cdn\.shopify\.com/i.test(html)) return "Shopify (Liquid/HTML)";
  if (/wixstatic\.com/i.test(html)) return "Wix (HTML)";
  return "plain HTML/CSS";
}

function detectStackFromInsights(technologies: unknown): string | null {
  const list = Array.isArray(technologies) ? technologies : [];
  for (const tech of list) {
    const name =
      typeof tech === "object" && tech !== null && "name" in tech
        ? String((tech as { name: unknown }).name)
        : null;
    if (!name) continue;
    const match = STACK_PATTERNS.find((p) => p.pattern.test(name));
    if (match) return match.label;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

interface MicrolinkExtractedData {
  title: string | null;
  metaDescription: string | null;
  viewportContent: string | null;
  canonicalUrl: string | null;
  h1Tags: string[];
  totalImages: number;
  imagesWithAlt: number;
  detectedStack: string;
  screenshotBase64: string | null;
}

// Single combined Microlink request: real headless-browser render (prerender=true, so
// JS-heavy/SPA sites are actually rendered before we read their DOM) + CSS-selector data
// extraction (so meta/H1/viewport/canonical/alt-text counts are code-verified facts, not
// AI guesses) + a full-page screenshot + Wappalyzer-based tech detection, all in one call.
async function fetchFromMicrolink(
  url: string
): Promise<{ ok: true; data: MicrolinkExtractedData } | { ok: false; reason: string }> {
  const params = new URLSearchParams({
    url,
    screenshot: "true",
    meta: "false",
    waitFor: "6000",
    fullPage: "true",
    prerender: "true",
    insights: "true",
    "data.title.selector": "title",
    "data.title.attr": "text",
    "data.metaDescription.selector": 'meta[name="description"]',
    "data.metaDescription.attr": "content",
    "data.viewport.selector": 'meta[name="viewport"]',
    "data.viewport.attr": "content",
    "data.canonical.selector": 'link[rel="canonical"]',
    "data.canonical.attr": "href",
    "data.h1Tags.selectorAll": "h1",
    "data.h1Tags.attr": "text",
    "data.totalImages.selectorAll": "img",
    "data.totalImages.attr": "src",
    // Attribute-presence selector: counts any <img alt="..."> (including alt="") as
    // having alt text, rather than trying to distinguish null vs "" in the extracted
    // attr values — sidesteps ambiguity in how a missing attribute is represented.
    "data.imagesWithAlt.selectorAll": "img[alt]",
    "data.imagesWithAlt.attr": "src",
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(`https://api.microlink.io/?${params.toString()}`, {
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json || json.status !== "success") {
      if (res.status === 429) {
        console.warn("Microlink rate limit hit (429) — falling back to raw fetch+regex");
      }
      return { ok: false, reason: `Microlink request failed (status ${res.status})` };
    }

    const d = json.data ?? {};

    let screenshotBase64: string | null = null;
    const screenshotUrl = d?.screenshot?.url;
    if (screenshotUrl) {
      try {
        const imageRes = await fetch(screenshotUrl);
        const imageBuffer = await imageRes.arrayBuffer();
        screenshotBase64 = Buffer.from(imageBuffer).toString("base64");
      } catch (err) {
        console.error("Failed to download Microlink screenshot:", err);
      }
    }

    const h1Tags = asArray(d?.h1Tags)
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);

    const totalImages = asArray(d?.totalImages).length;
    const imagesWithAlt = asArray(d?.imagesWithAlt).length;

    const detectedStack = detectStackFromInsights(d?.insights?.technologies) ?? "plain HTML/CSS";

    return {
      ok: true,
      data: {
        title: asString(d?.title),
        metaDescription: asString(d?.metaDescription),
        viewportContent: asString(d?.viewport),
        canonicalUrl: asString(d?.canonical),
        h1Tags,
        totalImages,
        imagesWithAlt,
        detectedStack,
        screenshotBase64,
      },
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Unknown Microlink error" };
  } finally {
    clearTimeout(timeoutId);
  }
}

export type SiteDataResult =
  | { ok: true; extractedData: ExtractedSiteData; screenshotBase64: string | null }
  | { ok: false; error: string };

export async function fetchSiteData(
  url: string,
  onStage?: (stage: ProgressStage) => void,
  siteLabel?: string
): Promise<SiteDataResult> {
  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();
  const prefix = siteLabel ? `${siteLabel}: ` : "";

  onStage?.({ id: "microlink", label: `${prefix}Analyzing ${hostname} (Microlink)` });
  const microlinkResult = await fetchFromMicrolink(url);

  if (microlinkResult.ok) {
    const m = microlinkResult.data;
    const titleLength = m.title?.length ?? 0;
    const metaDescriptionLength = m.metaDescription?.length ?? 0;
    const imagesWithoutAlt = Math.max(0, m.totalImages - m.imagesWithAlt);

    const extractedData: ExtractedSiteData = {
      title: m.title,
      titleLength,
      metaDescription: m.metaDescription,
      metaDescriptionLength,
      h1Tags: m.h1Tags,
      h1Count: m.h1Tags.length,
      viewportPresent: m.viewportContent !== null,
      viewportContent: m.viewportContent,
      canonicalPresent: m.canonicalUrl !== null,
      canonicalUrl: m.canonicalUrl,
      totalImages: m.totalImages,
      imagesWithAlt: m.imagesWithAlt,
      imagesWithoutAlt,
      // Microlink doesn't return the final resolved URL when meta=false, so we can't see
      // through redirects here the way the raw-fetch fallback can. Good enough for the
      // common case (site already requested over https, or Gemini's screenshot came from
      // https): a rare http-only site that upgrades to https only after redirect could be
      // scored slightly optimistically here.
      hasHttps: url.toLowerCase().startsWith("https://"),
      detectedStack: m.detectedStack,
      dataSource: "microlink",
      isVerified: true,
    };

    return { ok: true, extractedData, screenshotBase64: m.screenshotBase64 };
  }

  console.warn(
    `Microlink primary fetch failed for ${hostname} (${microlinkResult.reason}); falling back to raw fetch+regex`
  );

  // Fallback: plain fetch of raw (unrendered) HTML + regex extraction. Less accurate on
  // JS-heavy sites since it never executes JavaScript, so results are marked unverified.
  onStage?.({ id: "fetch_html", label: `${prefix}Fetching ${hostname}` });
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

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const metaDescMatch =
    html.match(/<meta\s+name=["']description["']\s+content="([^"]*)"/i) ||
    html.match(/<meta\s+name=["']description["']\s+content='([^']*)'/i);
  const viewportMatch =
    html.match(/<meta\s+name=["']viewport["']\s+content=["']([^"']*)["']/i);
  const canonicalMatch =
    html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
  const h1Tags = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
  const imgMatches = [...html.matchAll(/<img[^>]*>/gi)];
  const imagesWithoutAlt = imgMatches.filter((img) => !/alt=["'][^"']+["']/i.test(img[0])).length;
  const totalImages = imgMatches.length;

  const title = titleMatch ? titleMatch[1].trim() || null : null;
  const metaDescription = metaDescMatch ? metaDescMatch[1].trim() || null : null;
  const viewportContent = viewportMatch ? viewportMatch[1].trim() || null : null;
  const canonicalUrl = canonicalMatch ? canonicalMatch[1].trim() || null : null;

  const extractedData: ExtractedSiteData = {
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaDescriptionLength: metaDescription?.length ?? 0,
    h1Tags,
    h1Count: h1Tags.length,
    viewportPresent: viewportContent !== null,
    viewportContent,
    canonicalPresent: canonicalUrl !== null,
    canonicalUrl,
    totalImages,
    imagesWithAlt: Math.max(0, totalImages - imagesWithoutAlt),
    imagesWithoutAlt,
    hasHttps: response.url.startsWith("https://"),
    detectedStack: detectStackFromHtml(html),
    dataSource: "fallback-regex",
    isVerified: false,
  };

  // Still attempt a screenshot-only Microlink call independently — a failure/timeout in
  // the combined data-extraction call above shouldn't also cost us the screenshot.
  onStage?.({ id: "microlink_screenshot", label: `${prefix}Capturing screenshot (Microlink)` });
  let screenshotBase64: string | null = null;
  try {
    const screenshotRes = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&waitFor=6000&fullPage=true`
    );
    const screenshotData = await screenshotRes.json();
    const screenshotImageUrl = screenshotData?.data?.screenshot?.url;

    if (screenshotImageUrl) {
      const imageRes = await fetch(screenshotImageUrl);
      const imageBuffer = await imageRes.arrayBuffer();
      screenshotBase64 = Buffer.from(imageBuffer).toString("base64");
    }
  } catch (screenshotError) {
    console.error("Screenshot failed, continuing without it:", screenshotError);
  }

  return { ok: true, extractedData, screenshotBase64 };
}
