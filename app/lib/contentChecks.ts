import { AssessedCategory, codeCriteria } from "./criteria";
import { CriterionResult } from "./types";

/**
 * The code tier: criteria answered deterministically from the page's markdown, never by
 * the model. Same move that made the SEO checks trustworthy — anything countable is
 * counted, so it cannot drift between runs or be hallucinated.
 *
 * IMPORTANT: run these against the UNTRUNCATED markdown. siteData caps what it sends to
 * Gemini at MAX_MARKDOWN_CHARS, and footer links — privacy, terms, contact, copyright —
 * are exactly what falls off the end of a long page. Checking the truncated copy would
 * report them missing on precisely the sites that have the most content.
 */

interface MarkdownLink {
  text: string;
  href: string;
}

/** Markdown links, excluding image embeds (`![alt](src)`). */
function parseLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  for (const match of markdown.matchAll(/(!?)\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) {
    if (match[1] === "!") continue; // an image, not a link
    links.push({ text: match[2].trim(), href: match[3].trim() });
  }
  return links;
}

/** Strips link syntax and list markers so word counts measure prose, not markup. */
function proseOf(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[*\-+]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[=-]{3,}\s*$/gm, "")
    .replace(/\(rel:[^)]*\)/g, "");
}

function wordCount(markdown: string): number {
  return proseOf(markdown).split(/\s+/).filter(Boolean).length;
}

/** Both markdown heading styles: `# Heading` and the setext `===` / `---` underlines. */
function headingCounts(markdown: string): { total: number; levels: number } {
  const atx = [...markdown.matchAll(/^(#{1,6})\s+\S/gm)].map((m) => m[1].length);
  const setextH1 = (markdown.match(/^={3,}\s*$/gm) ?? []).length;
  const setextH2 = (markdown.match(/^-{3,}\s*$/gm) ?? []).length;

  const levels = new Set<number>(atx);
  if (setextH1 > 0) levels.add(1);
  if (setextH2 > 0) levels.add(2);

  return { total: atx.length + setextH1 + setextH2, levels: levels.size };
}

const SOCIAL_HOSTS =
  /(?:facebook|instagram|linkedin|youtube|tiktok|pinterest|threads|bsky|mastodon|github|dribbble|behance)\.(?:com|app|social)|(?:twitter|x)\.com/i;

const ACTION_WORDS =
  /\b(get started|start (?:now|free|today)|sign ?up|register|buy|shop|order|book|schedule|reserve|subscribe|join|try (?:it|free|now)|download|request|get (?:a )?(?:quote|demo|in touch)|contact us|apply|donate|enquire|inquire|add to (?:cart|bag)|learn more|see plans|view pricing)\b/i;

/** Street-type or unit words next to a number, plus a postcode-ish token. */
const ADDRESS_HINT =
  /\b\d{1,5}[a-z]?[,\s]+(?:[A-Za-z.'-]+\s+){0,4}(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|court|ct\.?|place|pl\.?|way|parade|terrace|highway|hwy\.?|suite|ste\.?|unit|floor|level)\b/i;
const POSTCODE_HINT =
  /\b(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|\d{5}(?:-\d{4})?|\d{4})\b/;

const PRICE_TOKEN = /(?:[$£€¥₹]\s?\d|(?:\d+(?:[.,]\d+)?)\s?(?:USD|EUR|GBP|AUD|CAD|NZD)\b)/i;

function linkMatching(links: MarkdownLink[], pattern: RegExp): MarkdownLink | undefined {
  return links.find((l) => pattern.test(l.text) || pattern.test(l.href));
}

function result(id: string, met: boolean, evidence: string): CriterionResult {
  return { id, rating: met ? "yes" : "no", evidence };
}

function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Evaluates every `source: "code"` criterion. Returns results keyed by criterion id so
 * the caller can merge them into the model's assessments.
 *
 * Every branch produces a rating — the code tier never returns "unclear", because a
 * deterministic check either found the thing or it did not.
 */
export function computeContentChecks(markdown: string | null): Map<string, CriterionResult> {
  const results = new Map<string, CriterionResult>();
  const md = markdown ?? "";
  const links = parseLinks(md);
  const headings = headingCounts(md);
  const words = wordCount(md);

  const add = (r: CriterionResult) => results.set(r.id, r);

  // --- Trust: contact & location ---
  const mailto = links.find((l) => /^mailto:/i.test(l.href));
  const literalEmail = md.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
  add(
    result(
      "contactEmail",
      Boolean(mailto || literalEmail),
      mailto
        ? `Email link found: ${mailto.href.replace(/^mailto:/i, "")}`
        : literalEmail
        ? `Email address found in the page text: ${literalEmail[0]}`
        : "No email address or mailto: link found in the page text."
    )
  );

  const tel = links.find((l) => /^tel:/i.test(l.href));
  // Requires 8+ digits with separators — avoids matching prices, dates and IDs.
  const literalPhone = md.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,4}[\s.-]\d{3,4}(?:[\s.-]\d{3,4})?/);
  add(
    result(
      "contactPhone",
      Boolean(tel || literalPhone),
      tel
        ? `Phone link found: ${tel.href.replace(/^tel:/i, "")}`
        : literalPhone
        ? `Phone number found in the page text: ${literalPhone[0].trim()}`
        : "No phone number or tel: link found in the page text."
    )
  );

  const contactLink = linkMatching(links, /\bcontact|get in touch|reach us\b/i);
  add(
    result(
      "contactRoute",
      Boolean(contactLink),
      contactLink
        ? `Contact link found: "${contactLink.text || contactLink.href}"`
        : "No link to a contact page or form was found."
    )
  );

  const addressMatch = md.match(ADDRESS_HINT);
  const hasAddress = Boolean(addressMatch && POSTCODE_HINT.test(md));
  add(
    result(
      "physicalAddress",
      hasAddress,
      hasAddress
        ? `A street address appears on the page: "${addressMatch![0].trim()}"`
        : "No physical or postal address was found."
    )
  );

  // --- Trust: identity ---
  const aboutLink = linkMatching(links, /\babout|our story|who we are|meet the team|\bteam\b|company\b/i);
  add(
    result(
      "aboutPage",
      Boolean(aboutLink),
      aboutLink
        ? `About link found: "${aboutLink.text || aboutLink.href}"`
        : "No About, team, or company-story link was found."
    )
  );

  // --- Trust: transparency ---
  const privacyLink = linkMatching(links, /\bprivacy\b/i);
  add(
    result(
      "privacyPolicy",
      Boolean(privacyLink),
      privacyLink
        ? `Privacy link found: "${privacyLink.text || privacyLink.href}"`
        : "No privacy policy link was found."
    )
  );

  const termsLink = linkMatching(links, /\bterms\b|conditions\b|\beula\b|legal\b/i);
  add(
    result(
      "termsPage",
      Boolean(termsLink),
      termsLink
        ? `Terms link found: "${termsLink.text || termsLink.href}"`
        : "No terms or conditions link was found."
    )
  );

  const priceMatch = md.match(PRICE_TOKEN);
  const pricingLink = linkMatching(links, /\bpricing\b|\bplans\b|\bprice\b/i);
  add(
    result(
      "pricingSignals",
      Boolean(priceMatch || pricingLink),
      priceMatch
        ? `Prices are shown on the page (e.g. "${priceMatch[0].trim()}").`
        : pricingLink
        ? `A pricing link was found: "${pricingLink.text || pricingLink.href}"`
        : "No prices and no pricing page link were found."
    )
  );

  // --- Trust: credibility ---
  const socialLinks = links.filter((l) => SOCIAL_HOSTS.test(l.href));
  const socialHosts = [
    ...new Set(
      socialLinks.map((l) => {
        try {
          return new URL(l.href, "https://example.com").hostname.replace(/^www\./, "");
        } catch {
          return l.href;
        }
      })
    ),
  ];
  add(
    result(
      "socialPresence",
      socialLinks.length > 0,
      socialLinks.length > 0
        ? `Links to ${socialHosts.slice(0, 3).join(", ")} were found.`
        : "No links to social media profiles were found."
    )
  );

  const currentYear = new Date().getFullYear();
  const years = [...md.matchAll(/(?:©|&copy;|\(c\)|copyright)[^0-9]{0,15}((?:19|20)\d{2})/gi)].map(
    (m) => Number(m[1])
  );
  const newestYear = years.length ? Math.max(...years) : null;
  const yearCurrent = newestYear !== null && currentYear - newestYear <= 1;
  add(
    result(
      "copyrightCurrent",
      yearCurrent,
      newestYear === null
        ? "No copyright year was found on the page."
        : yearCurrent
        ? `The copyright notice reads ${newestYear}, which is current.`
        : `The copyright notice still reads ${newestYear} — ${currentYear - newestYear} years out of date.`
    )
  );

  // --- UX: readability structure ---
  add(
    result(
      "headingStructure",
      headings.total >= 2,
      headings.total >= 2
        ? `The page is broken up by ${plural(headings.total, "heading")}.`
        : `Only ${plural(headings.total, "heading")} found — the content has almost no structure.`
    )
  );

  add(
    result(
      "headingHierarchy",
      headings.levels >= 2,
      headings.levels >= 2
        ? `${plural(headings.levels, "heading level")} in use, giving the page a real hierarchy.`
        : "All headings are at the same level, so the page has no hierarchy."
    )
  );

  // --- UX: content ---
  add(
    result(
      "contentDepth",
      words >= 150,
      words >= 150
        ? `The page carries roughly ${words} words of content.`
        : `Only about ${words} words of content — too thin to tell a visitor much.`
    )
  );

  const ctaLink = links.find((l) => ACTION_WORDS.test(l.text));
  add(
    result(
      "ctaLinkPresent",
      Boolean(ctaLink),
      ctaLink
        ? `An action link was found: "${ctaLink.text}"`
        : "No link or button text asks the visitor to take an action."
    )
  );

  // Ratio, not raw counts: a 200-link page with 1,400 words of prose is a magazine;
  // a 200-link page with 80 words is a link dump.
  const perLink = links.length === 0 ? Infinity : words / links.length;
  add(
    result(
      "linkDensity",
      perLink >= 4,
      links.length === 0
        ? "No links found on the page."
        : perLink >= 4
        ? `About ${Math.round(perLink)} words of content per link — a reasonable balance.`
        : `Only about ${Math.round(perLink)} words per link across ${plural(links.length, "link")} — the page reads as a list of links rather than content.`
    )
  );

  return results;
}

/**
 * The code-tier results for one category, in the order the criteria are declared.
 * Missing entries are impossible by construction (computeContentChecks covers every
 * `source: "code"` criterion), but a defensive "unclear" beats a crash if one is added
 * here without an implementation.
 */
export function codeResultsFor(
  category: AssessedCategory,
  checks: Map<string, CriterionResult>
): CriterionResult[] {
  return codeCriteria(category).map(
    (def) =>
      checks.get(def.id) ?? {
        id: def.id,
        rating: "unclear" as const,
        evidence: "This check could not be run.",
      }
  );
}
