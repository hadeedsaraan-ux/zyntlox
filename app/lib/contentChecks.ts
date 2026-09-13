import { AssessedCategory, codeCriteria } from "./criteria";
import { CriterionConfidence, CriterionResult, DomLink } from "./types";

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

interface PageStats {
  md: string;
  prose: string;
  links: MarkdownLink[];
  words: number;
  sentences: string[];
  paragraphs: string[];
  headings: { level: number; text: string }[];
  /** True when the markdown carries `[Input: …]` markers at all — see capability probe. */
  hasInputMarkers: boolean;
}

/**
 * Markdown links, excluding pure image embeds (`![alt](src)`).
 */
function parseLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];

  const nestedImageLink = /\[!\[([^\]]*)\]\([^)]*\)\]\(([^)\s]*)[^)]*\)/g;
  let remaining = markdown;
  for (const match of markdown.matchAll(nestedImageLink)) {
    links.push({ text: match[1].trim(), href: match[2].trim() });
    remaining = remaining.replace(match[0], " ".repeat(match[0].length));
  }

  for (const match of remaining.matchAll(/(!?)\[([^\]]*)\]\(([^)\s]*)[^)]*\)/g)) {
    if (match[1] === "!") continue;
    links.push({ text: match[2].trim(), href: match[3].trim() });
  }
  return links;
}

/**
 * Extracts a comparable hostname from a URL, stripping "www."
 */
function hostnameOf(href: string): string | null {
  try {
    return new URL(href).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Strips query parameters (?cookie=...) and hashes (#top) from href
 * so path-based matching never gets confused by tracking or auth parameters.
 */
function cleanHrefPath(href: string): string {
  try {
    const u = new URL(href, "https://dummy.base");
    return u.pathname.toLowerCase();
  } catch {
    return href.split("?")[0].split("#")[0].toLowerCase();
  }
}

/** Strips markup so word counts and readability measure prose, not syntax. */
function proseOf(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)(\s*\(rel:[^)]*\))?/g, "$1")
    .replace(/\[(Form|Input):[^\]]*\]/g, " ")
    .replace(/^\s*[*\-+]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[=-]{3,}\s*$/gm, "")
    .replace(/[*_`>]/g, "");
}

function collectHeadings(md: string): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = [];
  const lines = md.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const atx = lines[i].match(/^(#{1,6})\s+(\S.*)$/);
    if (atx) {
      out.push({ level: atx[1].length, text: atx[2].trim() });
      continue;
    }
    // Setext: the underline follows the text it applies to.
    if (/^={3,}\s*$/.test(lines[i]) && i > 0 && lines[i - 1].trim()) {
      out.push({ level: 1, text: lines[i - 1].trim() });
    } else if (/^-{3,}\s*$/.test(lines[i]) && i > 0 && lines[i - 1].trim()) {
      out.push({ level: 2, text: lines[i - 1].trim() });
    }
  }
  return out;
}

/**
 * Prefers the scraper's DOM-computed link inventory (`domLinks`) over parsing markdown.
 */
function linksFor(markdown: string, domLinks: DomLink[] | null | undefined): MarkdownLink[] {
  if (domLinks && domLinks.length > 0) {
    return domLinks.map((l) => ({ text: l.accessibleName, href: l.href }));
  }
  return parseLinks(markdown);
}

function analyse(markdown: string | null, domLinks: DomLink[] | null | undefined): PageStats {
  const md = markdown ?? "";
  const prose = proseOf(md);
  const words = prose.split(/\s+/).filter(Boolean).length;

  return {
    md,
    prose,
    links: linksFor(md, domLinks),
    words,
    sentences: prose.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 1),
    paragraphs: prose.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.split(/\s+/).length > 3),
    headings: collectHeadings(md),
    hasInputMarkers: /\[Input:/i.test(md),
  };
}

/** Phrases suggesting a nearby fact is genuinely offered as a way to reach the business. */
const CONTACT_CONTEXT = /\bcontact\b|\bget in touch\b|\breach us\b|\bcall us\b|\bemail us\b|\bfind us\b|\bvisit us\b/i;

function paragraphContaining(paragraphs: string[], needle: string): string | null {
  return paragraphs.find((p) => p.includes(needle)) ?? null;
}

// --- shared patterns ---------------------------------------------------------

const SOCIAL_HOSTS =
  /(?:facebook|instagram|linkedin|youtube|tiktok|pinterest|threads|bsky|mastodon|github|dribbble|behance)\.(?:com|app|social)|(?:twitter|x)\.com/i;
const REVIEW_HOSTS = /trustpilot|yelp|g2\.com|capterra|glassdoor|google\.com\/maps|tripadvisor|productreview/i;
const MAP_HOSTS = /google\.[a-z.]+\/maps|maps\.app\.goo|openstreetmap|apple\.com\/maps|waze\.com|\bdirections\b/i;

const ACTION_WORDS =
  /\b(get started|start (?:now|free|today)|sign ?up|register|buy|shop|order|book|schedule|reserve|subscribe|join|try (?:it|free|now)|download|request|get (?:a )?(?:quote|demo|in touch)|contact us|apply|donate|enquire|inquire|add to (?:cart|bag)|see plans|view pricing)\b/i;
const VAGUE_LINK_TEXT = /^(click here|read more|more|learn more|here|link|this|details|info|continue|go|see more|>>?|→)$/i;

/**
 * Street address regex tightened: requires a real street name before street type,
 * preventing strings like "1 way" from falsely matching as a physical address.
 */
const ADDRESS_HINT =
  /\b\d{1,5}[a-zA-Z]?[,\s]+[A-Za-z.'-]+\s+(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|court|ct\.?|place|pl\.?|way|parade|terrace|highway|hwy\.?|suite|ste\.?|unit|floor|level)\b(?!\s+(?:to|for|in|of)\b)/i;
const POSTCODE_HINT = /\b(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|\d{5}(?:-\d{4})?|\d{4})\b/;

const PHONE_HINT =
  /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]\d{2,4}){2,3}\b|\(\d{2,4}\)[\s.-]?\d{3,4}[\s.-]?\d{2,4}\b|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/;

const CURRENCY_TOKEN = /[$£€¥₹]\s?\d|(?:\d+(?:[.,]\d+)?)\s?(?:USD|EUR|GBP|AUD|CAD|NZD)\b/gi;
const JARGON =
  /\b(synergy|synergies|best.in.class|world.class|cutting.edge|state.of.the.art|paradigm|leverage our|seamless(?:ly)?|holistic|robust solution|turnkey|next.generation|game.chang(?:er|ing)|disrupt(?:ive|ing)|innovat(?:ive|ion) solutions?|value.add(?:ed)?|mission.critical|bleeding.edge|thought leader)\b/gi;
const URGENCY =
  /\b(hurry|act now|limited time|don'?t miss out|while stocks last|only \d+ left|ends (?:today|soon|tonight)|last chance|final hours|selling fast)\b/i;
const PLACEHOLDER =
  /\b(lorem ipsum|dolor sit amet|your text here|insert (?:text|content|image)|sample text|placeholder|tbd|xxxx+)\b/i;
const COMING_SOON = /\b(coming soon|under construction|page not found|404 error|work in progress)\b/i;

// --- result helpers ----------------------------------------------------------

function result(id: string, met: boolean, yesText: string, noText: string): CriterionResult {
  return { id, rating: met ? "yes" : "no", evidence: met ? yesText : noText };
}

function tieredResult(
  id: string,
  confidence: CriterionConfidence | null,
  yesText: string,
  noText: string
): CriterionResult {
  if (confidence === null) return { id, rating: "no", evidence: noText };
  return { id, rating: "yes", evidence: yesText, confidence };
}

function unanswerable(id: string, why: string): CriterionResult {
  return { id, rating: "unclear", evidence: why };
}

function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}

function verb(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

/**
 * UNIVERSAL STRICT LINK MATCHER:
 * 1. Checks text length: Navigation/policy links are concise (<= 6 words, <= 45 chars).
 *    This completely stops long article titles (like news headlines) from matching.
 * 2. Checks clean URL path (without query params) so "?cookie=..." or "?return=..."
 *    never falsely matches buttons like "Log in" or social links.
 */
function strictLinkMatching(
  links: MarkdownLink[],
  textPattern: RegExp,
  pathPattern?: RegExp
): MarkdownLink | undefined {
  return links.find((l) => {
    const text = (l.text || "").trim();
    const words = text.split(/\s+/).filter(Boolean);
    // Navigation / Policy links are short. Long prose / article titles are discarded.
    if (words.length <= 6 && text.length <= 45) {
      if (textPattern.test(text)) return true;
    }
    // Path check without query parameters or hashes
    if (pathPattern && l.href) {
      const cleanPath = cleanHrefPath(l.href);
      if (pathPattern.test(cleanPath)) return true;
    }
    return false;
  });
}

function strictLinkCheck(
  id: string,
  links: MarkdownLink[],
  textPattern: RegExp,
  pathPattern: RegExp | undefined,
  label: string,
  missing: string
): CriterionResult {
  const hit = strictLinkMatching(links, textPattern, pathPattern);
  return hit
    ? result(id, true, `${label} found: "${(hit.text || hit.href).slice(0, 60)}"`, "")
    : result(id, false, "", missing);
}

function textCheck(
  id: string,
  md: string,
  pattern: RegExp,
  label: string,
  missing: string
): CriterionResult {
  const hit = md.match(pattern);
  return hit
    ? result(id, true, `${label}: "${hit[0].trim().slice(0, 60)}"`, "")
    : result(id, false, "", missing);
}

function absenceCheck(
  id: string,
  md: string,
  pattern: RegExp,
  clean: string,
  found: string
): CriterionResult {
  const hit = md.match(pattern);
  return hit
    ? result(id, false, "", `${found} "${hit[0].trim().slice(0, 50)}"`)
    : result(id, true, clean, "");
}

// --- the checks --------------------------------------------------------------

export interface ComputeContentChecksOptions {
  siteUrl?: string | null;
  domLinks?: DomLink[] | null;
  structuredAddress?: string | null;
  commerceSignals?: {
    hasProductSchema: boolean;
    hasNewsSchema: boolean;
    hasCommerceButtons: boolean;
  } | null;
}

export function computeContentChecks(
  markdown: string | null,
  options?: ComputeContentChecksOptions
): Map<string, CriterionResult> {
  const out = new Map<string, CriterionResult>();
  const s = analyse(markdown, options?.domLinks);
  const add = (r: CriterionResult) => out.set(r.id, r);
  const { md, links, words, headings } = s;
  const siteUrl = options?.siteUrl;
  const structuredAddress = options?.structuredAddress ?? null;
  const commerceSignals = options?.commerceSignals ?? null;
  const isLikelyCommerceSite = Boolean(
    commerceSignals?.hasProductSchema || commerceSignals?.hasCommerceButtons
  );
  const isLikelyContentSite = Boolean(commerceSignals?.hasNewsSchema && !isLikelyCommerceSite);

  // ===== Contact & location =====
  const mailto = links.find((l) => /^mailto:/i.test(l.href));
  const literalEmailMatch = mailto ? null : s.prose.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
  const emailParagraph = literalEmailMatch ? paragraphContaining(s.paragraphs, literalEmailMatch[0]) : null;
  const emailConfidence: CriterionConfidence | null = mailto
    ? "high"
    : literalEmailMatch
    ? emailParagraph && CONTACT_CONTEXT.test(emailParagraph)
      ? "medium"
      : "low"
    : null;
  add(tieredResult(
    "contactEmail",
    emailConfidence,
    mailto
      ? `Email link found: ${mailto.href.replace(/^mailto:/i, "")}`
      : `Email address found in the page text: ${literalEmailMatch?.[0]}${emailConfidence === "low" ? " (not a contact link — unverified)" : ""}`,
    "No email address or mailto: link found in the page text."
  ));

  const tel = links.find((l) => /^tel:/i.test(l.href));
  const literalPhoneMatch = tel ? null : s.prose.match(PHONE_HINT);
  const phoneParagraph = literalPhoneMatch ? paragraphContaining(s.paragraphs, literalPhoneMatch[0]) : null;
  const phoneConfidence: CriterionConfidence | null = tel
    ? "high"
    : literalPhoneMatch
    ? phoneParagraph && CONTACT_CONTEXT.test(phoneParagraph)
      ? "medium"
      : "low"
    : null;
  add(tieredResult(
    "contactPhone",
    phoneConfidence,
    tel
      ? `Phone link found: ${tel.href.replace(/^tel:/i, "")}`
      : `Phone number found in the page text: ${literalPhoneMatch?.[0].trim()}${phoneConfidence === "low" ? " (not a contact link — unverified)" : ""}`,
    "No phone number or tel: link found in the page text."
  ));

  add(strictLinkCheck("contactRoute", links,
    /^(contact(\s+us)?|get\s+in\s+touch|reach\s+us|contact\s+support)$/i,
    /\/(contact(-us)?|get-in-touch)\/?$/i,
    "Contact link", "No link to a contact page or form was found."));

  const addressMatch = md.match(ADDRESS_HINT);
  const addressContext = addressMatch
    ? md.slice(addressMatch.index ?? 0, (addressMatch.index ?? 0) + 80)
    : "";
  const addressConfirmed = Boolean(addressMatch) && POSTCODE_HINT.test(addressContext);
  const addressParagraph = addressConfirmed ? paragraphContaining(s.paragraphs, addressMatch![0]) : null;
  const addressConfidence: CriterionConfidence | null = structuredAddress
    ? "high"
    : addressConfirmed
    ? addressParagraph && CONTACT_CONTEXT.test(addressParagraph)
      ? "medium"
      : "low"
    : null;
  add(tieredResult(
    "physicalAddress",
    addressConfidence,
    structuredAddress
      ? `A structured (schema.org/JSON-LD) address was found: "${structuredAddress}"`
      : `A street address appears on the page: "${addressMatch?.[0].trim()}"${addressConfidence === "low" ? " (unverified — plain text, no supporting context)" : ""}`,
    "No physical or postal address was found."
  ));

  add(strictLinkCheck("mapLink", links,
    /^(map|directions|find\s+us|view\s+on\s+google\s+maps)$/i,
    MAP_HOSTS,
    "Map or directions link", "No map or directions link was found."));

  add(textCheck("businessHours", md,
    /\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*[-–—]\s*(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\b|\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\s*[-–—]\s*\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i,
    "Opening hours stated", "No opening hours or availability were found."));

  const channels = [
    Boolean(mailto || literalEmailMatch),
    Boolean(tel || literalPhoneMatch),
    Boolean(strictLinkMatching(links, /^(contact(\s+us)?|get\s+in\s+touch)$/i, /\/contact/i)),
    links.some((l) => SOCIAL_HOSTS.test(l.href)),
  ].filter(Boolean).length;
  add(result("multipleContactChannels", channels >= 2,
    `${plural(channels, "way")} to make contact are offered.`,
    `Only ${plural(channels, "way")} to make contact was found — visitors who dislike that one have no alternative.`));

  // ===== Legal & policies =====
  add(strictLinkCheck("privacyPolicy", links,
    /^(privacy(\s+policy)?|privacy\s+notice|your\s+privacy)$/i,
    /\/(privacy(-policy|-notice)?)\/?$/i,
    "Privacy link", "No privacy policy link was found."));

  add(strictLinkCheck("termsPage", links,
    /^(terms(\s+of\s+(service|use))?|terms\s*&\s*conditions|eula|conditions\s+of\s+use)$/i,
    /\/(terms|terms-of-service|terms-and-conditions|tos)\/?$/i,
    "Terms link", "No terms or conditions link was found."));

  add(strictLinkCheck("cookiePolicy", links,
    /^(cookies?(\s+policy)?|cookie\s+(settings|preferences))$/i,
    /\/(cookies?(-policy)?)\/?$/i,
    "Cookie policy link", "No cookie policy or cookie settings link was found."));

  add(strictLinkCheck("accessibilityStatement", links,
    /^(accessibility(\s+statement)?)$/i,
    /\/(accessibility(-statement)?)\/?$/i,
    "Accessibility link", "No accessibility statement link was found."));

  add(strictLinkCheck("refundPolicy", links,
    /^(refunds?(\s+policy)?|returns?\s+policy|cancellation\s+policy|refunds?\s*&\s*returns?|returns?\s*&\s*exchanges?)$/i,
    /\/(refunds?|returns?|cancellation)(-policy)?\/?$/i,
    "Refund or returns link", "No refund, returns or cancellation information was found."));

  add(strictLinkCheck("shippingInfo", links,
    /^(shipping(\s+policy|\s+info)?|delivery(\s+policy|\s+info)?|fulfillment)$/i,
    /\/(shipping|delivery)(-policy)?\/?$/i,
    "Shipping link", "No delivery or shipping information was found."));

  const copyrightBlock = md.match(/(?:©|&copy;|\(c\)|copyright)[^\n]{0,60}/i);
  add(result("copyrightNotice", Boolean(copyrightBlock),
    `Copyright notice present: "${copyrightBlock?.[0].trim()}"`,
    "No copyright notice was found anywhere on the page."));

  // ===== Commerce & guarantees =====
  if (isLikelyContentSite) {
    add(unanswerable("pricingSignals", "This appears to be a content/news site, not a storefront — pricing checks don't apply."));
    add(unanswerable("currencyConsistent", "This appears to be a content/news site, not a storefront — pricing checks don't apply."));
    add(unanswerable("guaranteeLanguage", "This appears to be a content/news site, not a storefront — commerce checks don't apply."));
    add(unanswerable("riskReversal", "This appears to be a content/news site, not a storefront — commerce checks don't apply."));
    add(unanswerable("paymentMethods", "This appears to be a content/news site, not a storefront — commerce checks don't apply."));
    add(unanswerable("securityAssurance", "This appears to be a content/news site, not a storefront — commerce checks don't apply."));
  } else {
    const priceMatches = [...md.matchAll(CURRENCY_TOKEN)].map((m) => m[0]);
    const pricingLink = strictLinkMatching(links, /^(pricing|plans|view\s+plans|see\s+pricing|price)$/i, /\/(pricing|plans)/i);
    add(result("pricingSignals", priceMatches.length > 0 || Boolean(pricingLink),
      priceMatches.length ? `Prices shown on the page (e.g. "${priceMatches[0].trim()}").` : `A pricing link was found: "${pricingLink?.text}"`,
      "No prices and no pricing page link were found."));

    const symbols = new Set(priceMatches.map((p) => (p.match(/[$£€¥₹]/) ?? [""])[0]).filter(Boolean));
    add(priceMatches.length === 0
      ? unanswerable("currencyConsistent", "No prices appear on the page, so currency consistency does not apply.")
      : result("currencyConsistent", symbols.size <= 1,
          `All prices use a single currency.`,
          `Prices mix ${symbols.size} currency symbols (${[...symbols].join(" ")}), which is easy to misread.`));

    add(textCheck("guaranteeLanguage", md, /\b(money.back|satisfaction guarantee|guarantee[ds]?|warranty|warranties)\b/i,
      "Guarantee mentioned", "No guarantee, warranty or money-back promise was mentioned."));
    add(textCheck("riskReversal", md, /\b(free trial|free quote|free consultation|no obligation|free demo|free sample|cancel anytime|no credit card)\b/i,
      "Low-risk offer", "Nothing on the page lowers the risk of getting in touch — no free trial, quote or consultation."));
    add(textCheck("paymentMethods", md, /\b(visa|mastercard|amex|american express|paypal|apple pay|google pay|stripe|klarna|afterpay|credit card)\b/i,
      "Payment methods named", "No accepted payment methods were named."));
    add(textCheck("securityAssurance", md, /\b(secure (?:payment|checkout|ordering)|ssl|encrypt(?:ed|ion)|pci|data protection|gdpr)\b/i,
      "Security assurance", "Nothing reassures visitors that payment or data handling is secure."));
  }

  // ===== Social & external presence =====
  const socialLinks = links.filter((l) => SOCIAL_HOSTS.test(l.href));
  const socialHosts = [...new Set(socialLinks.map((l) => (l.href.match(SOCIAL_HOSTS) ?? [""])[0].toLowerCase()))];
  add(result("socialPresence", socialLinks.length > 0,
    `Links to ${socialHosts.slice(0, 3).join(", ")} were found.`,
    "No links to social media profiles were found."));
  add(result("multiplePlatforms", socialHosts.length >= 2,
    `Profiles on ${plural(socialHosts.length, "platform")} are linked.`,
    socialHosts.length === 1 ? `Only one social platform (${socialHosts[0]}) is linked.` : "No social platforms are linked."));
  add(strictLinkCheck("reviewPlatformLink", links,
    /^(reviews?|testimonials?|customer\s+reviews)$/i,
    REVIEW_HOSTS,
    "Independent review link", "No link to an independent review platform (Google, Trustpilot, Yelp) was found."));
  add(textCheck("pressMentions", md, /\b(as (?:seen|featured) in|featured in|press|award[- ]winning|winner of|certified|accredited|member of|ISO \d)/i,
    "Credibility reference", "No press coverage, awards, certifications or memberships were mentioned."));

  const siteHost = siteUrl ? hostnameOf(siteUrl) : null;
  const external = siteHost
    ? links.filter((l) => {
        const h = hostnameOf(l.href);
        return h !== null && h !== siteHost && !h.endsWith(`.${siteHost}`);
      }).length
    : links.filter((l) => /^https?:\/\//i.test(l.href)).length;
  add(links.length === 0
    ? unanswerable("externalLinkBalance", "No links on the page.")
    : result("externalLinkBalance", external / links.length < 0.5,
        `${external} of ${links.length} links point off-site — the page keeps visitors in place.`,
        `${external} of ${links.length} links point off-site, sending visitors away more often than not.`));

  // ===== Freshness & maintenance =====
  const currentYear = new Date().getFullYear();
  const copyYears = copyrightBlock
    ? [...copyrightBlock[0].matchAll(/(19|20)\d{2}/g)].map((m) => Number(m[0]))
    : [];
  const newest = copyYears.length ? Math.max(...copyYears) : null;
  add(result("copyrightCurrent", newest !== null && currentYear - newest <= 1,
    `The copyright notice reads ${newest}, which is current.`,
    newest === null ? "No copyright year was found on the page."
      : `The copyright notice still reads ${newest} — ${currentYear - newest} years out of date.`));

  const anyRecentYear = new RegExp(`\\b(${currentYear}|${currentYear - 1})\\b`).test(md);
  add(result("recentYearMentioned", anyRecentYear,
    `The content references ${currentYear} or ${currentYear - 1}.`,
    `Nothing on the page mentions ${currentYear} or ${currentYear - 1}, so it reads as untouched for a while.`));

  add(textCheck("datedContent", md,
    /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+(?:19|20)\d{2}|\b(?:19|20)\d{2}-\d{2}-\d{2}\b/i,
    "Dated content", "No content on the page carries a visible date."));
  add(strictLinkCheck("blogOrNewsLink", links,
    /^(blog|news|articles|latest\s+news|updates|insights)$/i,
    /\/(blog|news|articles|insights)\/?$/i,
    "Blog or news link", "No blog, news or updates section was linked."));
  add(absenceCheck("noComingSoon", md, COMING_SOON,
    "No unfinished or placeholder sections.", "The page still says"));

  // ===== Language & tone =====
  add(absenceCheck("noPlaceholderText", md, PLACEHOLDER,
    "No placeholder or dummy text found.", "Placeholder text is still on the page:"));

  const caps = (s.prose.match(/\b[A-Z]{4,}\b/g) ?? []).filter((w) => !/^(FAQ|HTML|CSS|SEO|API|PDF|USA|GDPR|ISO|VAT|ABN|LLC)$/.test(w));
  add(result("noAllCapsShouting", caps.length <= 5,
    `Only ${plural(caps.length, "word")} in full capitals.`,
    `${plural(caps.length, "word")} are set in full capitals, which reads as shouting.`));

  const bangs = (s.prose.match(/!/g) ?? []).length;
  const bangRate = words === 0 ? 0 : (bangs / words) * 100;
  add(result("exclamationRestraint", bangRate < 1,
    `${plural(bangs, "exclamation mark")} across ${words} words.`,
    `${plural(bangs, "exclamation mark")} across only ${words} words — the copy reads as over-excited.`));

  add(absenceCheck("noUrgencyPressure", md, URGENCY,
    "No artificial urgency language.", "The page uses pressure language:"));

  const figures = (s.prose.match(/\b\d[\d,.]*\s?(?:%|years?|customers?|clients?|projects?|countries|people|members?)\b/gi) ?? []).length;
  add(result("specificNumbers", figures > 0,
    `${plural(figures, "concrete figure")} in the copy.`,
    "The copy contains no concrete figures — only adjectives and claims."));

  const jargonHits = [...s.prose.matchAll(JARGON)].map((m) => m[0]);
  add(result("jargonRestraint", jargonHits.length <= 2,
    jargonHits.length === 0 ? "No empty business jargon found." : `Only ${plural(jargonHits.length, "jargon phrase")}.`,
    `${plural(jargonHits.length, "jargon phrase")} such as "${jargonHits[0]}" — these say nothing to a reader.`));

  // ===== Identity =====
  add(strictLinkCheck("aboutPage", links,
    /^(about(\s+us)?|our\s+story|who\s+we\s+are|meet\s+the\s+team|the\s+team)$/i,
    /\/(about(-us)?|our-story|who-we-are|team)\/?$/i,
    "About link", "No About, team, or company-story link was found."));

  // ===== Content structure =====
  add(result("headingStructure", headings.length >= 2,
    `The page is broken up by ${plural(headings.length, "heading")}.`,
    `Only ${plural(headings.length, "heading")} found — the content has almost no structure.`));

  const levels = new Set(headings.map((h) => h.level));
  add(result("headingHierarchy", levels.size >= 2,
    `${plural(levels.size, "heading level")} in use, giving the page a real hierarchy.`,
    "All headings are at the same level, so the page has no hierarchy."));

  let skipped: string | null = null;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level - headings[i - 1].level > 1) {
      skipped = `h${headings[i - 1].level} straight to h${headings[i].level}`;
      break;
    }
  }
  add(headings.length < 2
    ? unanswerable("noSkippedHeadingLevels", "Too few headings to have an order.")
    : result("noSkippedHeadingLevels", skipped === null,
        "Heading levels descend in order.",
        `Heading levels jump (${skipped}), which confuses screen readers and search engines.`));

  add(words === 0
    ? unanswerable("subheadingDensity", "No page text to measure.")
    : result("subheadingDensity", headings.length >= Math.max(1, Math.floor(words / 300)),
        `${plural(headings.length, "heading")} across ${words} words.`,
        `Only ${plural(headings.length, "heading")} across ${words} words — long stretches run without a break.`));

  const bullets = (md.match(/^\s*[*\-+]\s+\S/gm) ?? []).length;
  add(result("listUsage", bullets >= 3,
    `${plural(bullets, "list item")} break up the content.`,
    "The page uses no bulleted or numbered lists."));

  const longParas = s.paragraphs.filter((p) => p.split(/\s+/).length > 80).length;
  add(s.paragraphs.length === 0
    ? unanswerable("paragraphLength", "No paragraphs to measure.")
    : result("paragraphLength", longParas / s.paragraphs.length < 0.25,
        `${longParas} of ${s.paragraphs.length} paragraphs run long.`,
        `${longParas} of ${s.paragraphs.length} paragraphs are over 80 words — dense to read on screen.`));

  add(result("contentDepth", words >= 150,
    `The page carries roughly ${words} words of content.`,
    `Only about ${words} words of content — too thin to tell a visitor much.`));

  const linkWords = links.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
  add(words === 0
    ? unanswerable("contentToNavRatio", "No page text to measure.")
    : result("contentToNavRatio", linkWords / Math.max(words, 1) < 0.5,
        `Most of the page is content rather than link text.`,
        `Link text makes up most of the page's words — it reads as a menu rather than a page.`));

  // ===== Findability =====
  add(strictLinkCheck("searchLink", links,
    /^(search|find)$/i,
    /\/(search|find)\/?$/i,
    "Search link", "No search box or search link was found."));

  add(result("homeLink", links.some((l) => /^\/?$|^https?:\/\/[^/]+\/?$/.test(l.href) || /^home$/i.test(l.text.trim())),
    "A link back to the home page is present.",
    "No link back to the home page was found."));

  add(strictLinkCheck("faqOrHelpLink", links,
    /^(faq|faqs|help|support|help\s+center|customer\s+support|frequently\s+asked\s+questions)$/i,
    /\/(faq|faqs|help|support|help-center)\/?$/i,
    "Help or FAQ link", "No FAQ, help or support link was found."));

  add(strictLinkCheck("sitemapLink", links,
    /^(sitemap|site\s+map)$/i,
    /\/(sitemap(\.xml)?)\/?$/i,
    "Sitemap link", "No sitemap link was found."));

  add(textCheck("breadcrumbPresent", md, /\bbreadcrumb|\bhome\s*[»>\/›]\s*\w/i,
    "Breadcrumbs present", "No breadcrumb trail was found."));

  add(strictLinkCheck("resourcesLink", links,
    /^(resources|guides|docs|documentation|case\s+studies|whitepapers)$/i,
    /\/(resources|guides|docs|documentation|case-studies|whitepapers)\/?$/i,
    "Resources link", "No guides, resources, documentation or case studies were linked."));

  // ===== Reading ease =====
  const avgSentence = s.sentences.length ? words / s.sentences.length : 0;
  add(s.sentences.length === 0
    ? unanswerable("avgSentenceLength", "No sentences to measure.")
    : result("avgSentenceLength", avgSentence <= 25,
        `Sentences average ${avgSentence.toFixed(0)} words.`,
        `Sentences average ${avgSentence.toFixed(0)} words — long enough to lose a reader.`));

  const letters = s.prose.replace(/[^A-Za-z]/g, "").length;
  const avgWord = words ? letters / words : 0;
  add(words === 0
    ? unanswerable("avgWordLength", "No page text to measure.")
    : result("avgWordLength", avgWord < 6,
        `Words average ${avgWord.toFixed(1)} characters — plain vocabulary.`,
        `Words average ${avgWord.toFixed(1)} characters, which reads as dense or technical.`));

  const longish = s.paragraphs.filter((p) => p.split(/\s+/).length > 60).length;
  add(s.paragraphs.length === 0
    ? unanswerable("longParagraphRatio", "No paragraphs to measure.")
    : result("longParagraphRatio", longish / s.paragraphs.length < 0.34,
        `${longish} of ${s.paragraphs.length} paragraphs exceed 60 words.`,
        `${longish} of ${s.paragraphs.length} paragraphs exceed 60 words — the page reads as heavy.`));

  const minutes = words / 220;
  add(result("readingTime", minutes <= 10,
    `About ${Math.max(1, Math.round(minutes))} minute(s) to read.`,
    `About ${Math.round(minutes)} minutes to read — a lot to ask of a first-time visitor.`));

  const qHeading = headings.find((h) => h.text.includes("?"));
  add(result("questionHeadings", Boolean(qHeading),
    `A heading poses a question: "${qHeading?.text.slice(0, 50)}"`,
    "No heading is phrased as a question a visitor might be asking."));

  const youCount = (s.prose.match(/\b(you|your|you're|yours)\b/gi) ?? []).length;
  add(result("benefitLanguage", youCount >= 3,
    `The copy addresses the reader directly ${plural(youCount, "time")}.`,
    `The copy barely addresses the reader — "you" appears ${plural(youCount, "time")}.`));

  const anyNumber = (s.prose.match(/\b\d+\b/g) ?? []).length;
  add(result("numbersInCopy", anyNumber >= 3,
    `${plural(anyNumber, "number")} appear in the copy.`,
    "The copy contains almost no numbers, so nothing is concrete."));

  const longest = s.paragraphs.reduce((m, p) => Math.max(m, p.split(/\s+/).length), 0);
  add(s.paragraphs.length === 0
    ? unanswerable("noWallOfText", "No paragraphs to measure.")
    : result("noWallOfText", longest < 150,
        `The longest paragraph is ${longest} words.`,
        `The longest paragraph runs ${longest} words — a wall of text.`));

  // ===== Link quality =====
  const ctaLink = links.find((l) => ACTION_WORDS.test(l.text));
  add(result("ctaLinkPresent", Boolean(ctaLink),
    `An action link was found: "${ctaLink?.text}"`,
    "No link or button text asks the visitor to take an action."));

  const perLink = links.length === 0 ? Infinity : words / links.length;
  add(links.length === 0
    ? unanswerable("linkDensity", "No links found on the page.")
    : result("linkDensity", perLink >= 4,
        `About ${Math.round(perLink)} words of content per link — a reasonable balance.`,
        `Only about ${Math.round(perLink)} words per link across ${plural(links.length, "link")} — the page reads as a list of links rather than content.`));

  const vague = links.filter((l) => VAGUE_LINK_TEXT.test(l.text));
  add(result("noClickHere", vague.length === 0,
    "No uninformative link text.",
    `${plural(vague.length, "link")} ${verb(vague.length, "uses", "use")} uninformative text such as "${vague[0]?.text}" — meaningless out of context.`));

  const named = links.filter((l) => l.text.split(/\s+/).filter(Boolean).length >= 2).length;
  add(links.length === 0
    ? unanswerable("descriptiveLinkText", "No links found on the page.")
    : result("descriptiveLinkText", named / links.length >= 0.5,
        `${named} of ${links.length} links carry two or more words.`,
        `Only ${named} of ${links.length} links carry more than one word of text.`));

  const bareUrls = links.filter((l) => /^https?:\/\//i.test(l.text));
  add(result("noBareUrls", bareUrls.length === 0,
    "No raw URLs used as link text.",
    `${plural(bareUrls.length, "link")} ${verb(bareUrls.length, "shows", "show")} a raw web address instead of readable text.`));

  const byText = new Map<string, Set<string>>();
  for (const l of links) {
    if (!l.text) continue;
    const key = l.text.toLowerCase();
    byText.set(key, (byText.get(key) ?? new Set()).add(l.href));
  }
  const ambiguous = [...byText.entries()].filter(([, hrefs]) => hrefs.size > 1);
  add(result("noDuplicateLinkText", ambiguous.length < 3,
    `${ambiguous.length} link labels point to more than one place.`,
    `${plural(ambiguous.length, "link label")} (e.g. "${ambiguous[0]?.[0]}") ${verb(ambiguous.length, "points", "point")} to different destinations, which is ambiguous.`));

  const mailtos = links.filter((l) => /^mailto:/i.test(l.href));
  const badMailto = mailtos.filter((l) => !/^mailto:[\w.+-]+@[\w-]+\.[\w.]{2,}/i.test(l.href));
  add(result("mailtoValid", badMailto.length === 0,
    mailtos.length ? `All ${plural(mailtos.length, "email link")} ${verb(mailtos.length, "is", "are")} well formed.` : "No email links to validate.",
    `${plural(badMailto.length, "email link")} ${verb(badMailto.length, "is", "are")} malformed and will not open a mail client.`));

  const deadLinks = links.filter((l) => /^javascript:|^#$/i.test(l.href));
  add(result("noJavascriptLinks", deadLinks.length === 0,
    "No dead or placeholder link targets.",
    `${plural(deadLinks.length, "link")} ${verb(deadLinks.length, "points", "point")} nowhere (javascript: or a bare #).`));

  // ===== Forms & interaction =====
  const formMarkers = (md.match(/\[Form:/gi) ?? []).length;
  const inputMarkers = [...md.matchAll(/\[Input: type=([a-z]+)([^\]]*)\]/gi)];

  add(result("formPresent", formMarkers > 0,
    `${plural(formMarkers, "form")} on the page.`,
    "No form was found — there is no way to submit anything from this page."));
  add(textCheck("newsletterSignup", md, /\b(newsletter|mailing list|subscribe|sign up for (?:updates|emails))\b/i,
    "Newsletter signup", "No newsletter or mailing-list signup was found."));

  if (!s.hasInputMarkers) {
    add(unanswerable("formFieldCount", "Form fields are not reported by the current scraper build."));
    add(unanswerable("labelledInputs", "Form fields are not reported by the current scraper build."));
  } else {
    const visible = inputMarkers.filter((m) => !/hidden|submit|button/i.test(m[1]));
    add(result("formFieldCount", visible.length <= 7,
      `Forms ask for ${plural(visible.length, "field")}.`,
      `Forms ask for ${plural(visible.length, "field")} — long forms deter people from starting.`));

    const unlabelled = visible.filter((m) => !/label=/i.test(m[2]));
    add(result("labelledInputs", unlabelled.length === 0,
      `All ${plural(visible.length, "form field")} ${verb(visible.length, "carries", "carry")} a label.`,
      `${unlabelled.length} of ${visible.length} form fields have no label.`));
  }

  return out;
}

export function codeResultsFor(
  category: AssessedCategory,
  checks: Map<string, CriterionResult>
): CriterionResult[] {
  return codeCriteria(category).map(
    (def) => checks.get(def.id) ?? unanswerable(def.id, "This check could not be run.")
  );
}
