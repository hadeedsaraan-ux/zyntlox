import { ExtractedSiteData, fetchSiteData } from "../../app/lib/siteData";
import { computeSeoAudit } from "../../app/lib/seoAudit";
import { SeoChecks } from "../../app/lib/types";
import { ageHours, loadFixture, saveResult } from "../fixtures";
import { table } from "../stats";
import { PathCompareReport, PathCompareRow } from "../types";

/**
 * Fields where the two extraction paths differ by construction. Without flagging these,
 * the diff reads as instability when it is actually designed-in behaviour.
 */
const BY_DESIGN: Record<string, string> = {
  hasHttps:
    "The rendered path reads the INPUT url; the raw fetch reads response.url (post-redirect). An http URL that 301s to https differs here for reasons unrelated to rendering.",
  dataSource: "Always differs — it is the label of which path produced the row.",
  isVerified: "Always differs — unrendered HTML is marked unverified by definition.",
};

const FIELDS: (keyof ExtractedSiteData)[] = [
  "title",
  "titleLength",
  "metaDescription",
  "metaDescriptionLength",
  "viewportPresent",
  "viewportContent",
  "canonicalPresent",
  "canonicalUrl",
  "hasHttps",
  "detectedStack",
  "dataSource",
  "isVerified",
];

function show(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return JSON.stringify(value);
  const text = String(value);
  return text.length > 44 ? text.slice(0, 41) + "..." : text;
}

export async function pathCompare(args: { fixture: string; fresh: boolean }): Promise<void> {
  const fixture = loadFixture(args.fixture);

  let microlinkData: ExtractedSiteData;
  let microlinkChecks: SeoChecks;
  let microlinkSource: "fixture" | "live";

  if (args.fresh) {
    console.log(`\n  Fetching a fresh rendered copy…`);
    const live = await fetchSiteData(fixture.url, undefined, undefined, { skipScraper: true });
    if (!live.ok) {
      console.error(`\n  Live fetch failed: ${live.error}\n`);
      process.exit(1);
    }
    microlinkData = live.extractedData;
    microlinkChecks = computeSeoAudit(live.extractedData);
    microlinkSource = "live";
  } else {
    microlinkData = fixture.extractedData;
    microlinkChecks = fixture.seoChecks;
    microlinkSource = "fixture";
    console.log(`\n  Using the stored fixture for the rendered side (no network call)`);
  }

  if (microlinkData.dataSource !== "scraper-html") {
    console.log(
      `\n  WARNING: the "microlink" side of this comparison has dataSource="${microlinkData.dataSource}".\n` +
        `  Both sides came from the fallback, so this comparison is meaningless. Re-capture.\n`
    );
  }

  // skipScreenshot keeps this side free too — the fallback path would otherwise make
  // its own separate Microlink screenshot call.
  const fallbackResult = await fetchSiteData(fixture.url, undefined, undefined, {
    forceRawFetch: true,
    skipScraper: true,
  });

  if (!fallbackResult.ok) {
    console.error(`\n  Fallback fetch failed: ${fallbackResult.error}\n`);
    process.exit(1);
  }

  const fallbackData = fallbackResult.extractedData;
  const fallbackChecks = computeSeoAudit(fallbackData);

  const rows: PathCompareRow[] = FIELDS.map((field) => {
    const a = microlinkData[field];
    const b = fallbackData[field];
    return {
      field,
      microlink: a,
      fallback: b,
      differs: JSON.stringify(a) !== JSON.stringify(b),
      expectedByDesign: field in BY_DESIGN,
      note: BY_DESIGN[field] ?? null,
    };
  });

  const checkDeltas = microlinkChecks.checks.map((mc) => {
    const fc = fallbackChecks.checks.find((c) => c.id === mc.id)!;
    return {
      id: mc.id,
      microlink: mc.status,
      fallback: fc.status,
      pointsDelta: Math.round((fc.pointsDeducted - mc.pointsDeducted) * 100) / 100,
    };
  });

  const seoScoreDelta =
    Math.round((fallbackChecks.seoScore - microlinkChecks.seoScore) * 100) / 100;

  const verdict =
    seoScoreDelta === 0
      ? `Both paths produce the same seoScore (${microlinkChecks.seoScore}/10) for this site.`
      : `The regex fallback would score this site ${Math.abs(seoScoreDelta)} points ${
          seoScoreDelta < 0 ? "LOWER" : "HIGHER"
        } (${fallbackChecks.seoScore} vs ${microlinkChecks.seoScore}).`;

  const report: PathCompareReport = {
    kind: "path-compare",
    url: fixture.url,
    fixtureSlug: fixture.slug,
    fixtureCapturedAt: fixture.capturedAt,
    fixtureAgeHours: Number(ageHours(fixture.capturedAt).toFixed(2)),
    microlinkSource,
    microlink: { extractedData: microlinkData, seoChecks: microlinkChecks },
    fallback: { extractedData: fallbackData, seoChecks: fallbackChecks },
    rows,
    seoScoreDelta,
    checkDeltas,
    verdict,
  };

  console.log(`\n  ${fixture.url}`);
  console.log(
    `  microlink side: ${microlinkSource}${
      microlinkSource === "fixture" ? ` (captured ${ageHours(fixture.capturedAt).toFixed(1)}h ago)` : ""
    }`
  );
  if (microlinkSource === "fixture") {
    console.log(
      `  NOTE: the fixture may predate the live fallback fetch, so a diff could reflect a\n` +
        `  site change rather than a path difference. Use --fresh (1 request) if it must be exact.`
    );
  }

  console.log("\n  Field-by-field:\n");
  console.log(
    table(
      ["field", "microlink", "fallback", ""],
      rows.map((r) => [
        r.field,
        show(r.microlink),
        show(r.fallback),
        !r.differs ? "" : r.expectedByDesign ? "differs (by design)" : "DIFFERS",
      ])
    )
      .split("\n")
      .map((l) => "    " + l)
      .join("\n")
  );

  const realDiffs = rows.filter((r) => r.differs && !r.expectedByDesign);
  const designDiffs = rows.filter((r) => r.differs && r.expectedByDesign);

  if (designDiffs.length) {
    console.log("\n  Differences that are BY DESIGN (not instability):\n");
    for (const r of designDiffs) {
      console.log(`    ${r.field}: ${r.note}`);
    }
  }

  console.log("\n  SEO check impact:\n");
  console.log(
    table(
      ["check", "microlink", "fallback", "points"],
      checkDeltas.map((d) => [
        d.id,
        d.microlink,
        d.fallback,
        d.pointsDelta === 0 ? "-" : (d.pointsDelta > 0 ? "+" : "") + d.pointsDelta,
      ])
    )
      .split("\n")
      .map((l) => "    " + l)
      .join("\n")
  );

  console.log(`\n  ${verdict}`);
  console.log(
    `  ${realDiffs.length} field(s) differ beyond the by-design cases${
      realDiffs.length ? ": " + realDiffs.map((r) => r.field).join(", ") : ""
    }.`
  );
  console.log(`\n  Saved: ${saveResult(`path-compare-${fixture.slug}`, report)}\n`);
}
