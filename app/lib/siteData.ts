import { ProgressStage } from "./types";

export interface ExtractedSiteData {
  title: string;
  metaDescription: string;
  h1Tags: string[];
  totalImages: number;
  imagesWithoutAlt: number;
  hasHttps: boolean;
  detectedStack: string;
}

function detectStack(html: string): string {
  if (/id=["']__next["']|_next\/static/i.test(html)) return "Next.js/React (JSX)";
  if (/data-reactroot|id=["']root["'][^>]*>[\s\S]*react/i.test(html)) return "React (JSX)";
  if (/wp-content|wp-includes/i.test(html)) return "WordPress (PHP/HTML)";
  if (/data-v-app|__vue/i.test(html)) return "Vue (HTML templates)";
  if (/ng-version/i.test(html)) return "Angular (HTML templates)";
  if (/cdn\.shopify\.com/i.test(html)) return "Shopify (Liquid/HTML)";
  if (/wixstatic\.com/i.test(html)) return "Wix (HTML)";
  return "plain HTML/CSS";
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

  // Step 1: Fetch the website HTML
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

  // Step 2: Extract basic data
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const metaDescMatch = html.match(
    /<meta\s+name=["']description["']\s+content="([^"]*)"/i
  ) || html.match(
    /<meta\s+name=["']description["']\s+content='([^']*)'/i
  );
  const h1Matches = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim()
  );
  const imgMatches = [...html.matchAll(/<img[^>]*>/gi)];
  const imagesWithoutAlt = imgMatches.filter(
    (img) => !/alt=["'][^"']+["']/i.test(img[0])
  ).length;
  const hasHttps = response.url.startsWith("https://");

  const extractedData: ExtractedSiteData = {
    title: titleMatch ? titleMatch[1].trim() : "No title found",
    metaDescription: metaDescMatch ? metaDescMatch[1].trim() : "No meta description found",
    h1Tags: h1Matches,
    totalImages: imgMatches.length,
    imagesWithoutAlt,
    hasHttps,
    detectedStack: detectStack(html),
  };

  // Step 3: Get a screenshot via Microlink (free, no API key needed)
  onStage?.({ id: "microlink", label: `${prefix}Capturing screenshot (Microlink)` });
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
