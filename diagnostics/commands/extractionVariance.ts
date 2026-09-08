import { ExtractedSiteData, fetchSiteData } from "../../app/lib/siteData";
import { computeSeoAudit } from "../../app/lib/seoAudit";
import { CheckStatus, SeoCheck } from "../../app/lib/types";
import { recordMicrolinkSpend, saveResult, spentToday } from "../fixtures";
import { table } from "../stats";
import { ExtractionVarianceReport, FieldDiff } from "../types";

const MAX_RUNS = 5;

const FIELDS: (keyof ExtractedSiteData)[] = [
  "title",
  "titleLength",
  "metaDescription",
  "metaDescriptionLength",
  "h1Count",
  "viewportPresent",
  "canonicalPresent",
  "canonicalUrl",
  "totalImages",
  "imagesWithAlt",
  "imagesWithoutAlt",
  "hasHttps",
  "detectedStack",
  "dataSource",
];

export async function extractionVariance(args: {
  url: string;
  runs: number;
  yes: boolean;
  delayMs: number;
}): Promise<void> {
  const n = Math.min(args.runs, MAX_RUNS);

  console.log(`\n  MICROLINK COST: ${n} request(s) of your ~25/day (${spentToday()} logged today)`);

  if (!args.yes) {
    console.error(
      `\n  This mode re-scrapes the same URL ${n} times and spends real quota.\n` +
        `  Re-run with --yes to confirm.\n`
    );
    process.exit(1);
  }

  console.log(`  Re-scraping ${args.url} ${n}×\n`);

  const report: ExtractionVarianceReport = {
    kind: "extraction-variance",
    url: args.url,
    n,
    startedAt: new Date().toISOString(),
    runs: [],
    fields: [],
    dataSourceCounts: {},
    seoScore: { values: [], min: 0, max: 0, range: 0 },
    perCheckStatusChanges: [],
    verdict: "",
  };

  for (let i = 1; i <= n; i++) {
    const t0 = Date.now();
    const result = await fetchSiteData(args.url);
    recordMicrolinkSpend(1, "extraction-variance");
    const latencyMs = Date.now() - t0;

    if (!result.ok) {
      report.runs.push({
        runIndex: i,
        ok: false,
        error: result.error,
        latencyMs,
        extractedData: null,
        seoChecks: null,
      });
      console.log(`    ${i}. FAILED ${result.error} (${latencyMs}ms)`);
    } else {
      const seoChecks = computeSeoAudit(result.extractedData);
      report.runs.push({
        runIndex: i,
        ok: true,
        error: null,
        latencyMs,
        extractedData: result.extractedData,
        seoChecks,
      });
      console.log(
        `    ${i}. ${result.extractedData.dataSource.padEnd(14)} seo ${seoChecks.seoScore}/10  (${latencyMs}ms)`
      );
    }

    if (i < n && args.delayMs > 0) await new Promise((r) => setTimeout(r, args.delayMs));
  }

  const ok = report.runs.filter((r) => r.ok && r.extractedData && r.seoChecks);

  if (ok.length === 0) {
    console.error("\n  Every run failed; nothing to compare.\n");
    process.exit(1);
  }

  for (const field of FIELDS) {
    const grouped = new Map<string, { value: unknown; runs: number[] }>();
    for (const run of ok) {
      const value = run.extractedData![field];
      const key = JSON.stringify(value ?? null);
      const entry = grouped.get(key) ?? { value: value ?? null, runs: [] };
      entry.runs.push(run.runIndex);
      grouped.set(key, entry);
    }
    const diff: FieldDiff = {
      field,
      stable: grouped.size === 1,
      values: [...grouped.values()].map((g) => ({
        value: g.value as string | number | boolean | null,
        runs: g.runs,
      })),
    };
    report.fields.push(diff);
  }

  for (const run of ok) {
    const src = run.extractedData!.dataSource;
    report.dataSourceCounts[src] = (report.dataSourceCounts[src] ?? 0) + 1;
  }

  const scores = ok.map((r) => r.seoChecks!.seoScore);
  report.seoScore = {
    values: scores,
    min: Math.min(...scores),
    max: Math.max(...scores),
    range: Math.round((Math.max(...scores) - Math.min(...scores)) * 100) / 100,
  };

  const checkIds = ok[0].seoChecks!.checks.map((c) => c.id);
  report.perCheckStatusChanges = checkIds.map((id) => {
    const statuses = ok.map(
      (r) => r.seoChecks!.checks.find((c) => c.id === id)!.status
    ) as CheckStatus[];
    return { id: id as SeoCheck["id"], statuses, changed: new Set(statuses).size > 1 };
  });

  const unstable = report.fields.filter((f) => !f.stable);
  report.verdict = unstable.length
    ? `UNSTABLE across ${ok.length} runs: ${unstable.map((f) => f.field).join(", ")}. seoScore range ${report.seoScore.range}.`
    : `SEO facts IDENTICAL across all ${ok.length} runs (seoScore ${scores[0]}/10 every time).`;

  console.log("\n  Field stability:\n");
  console.log(
    table(
      ["field", "stable", "values"],
      report.fields.map((f) => [
        f.field,
        f.stable ? "yes" : "NO",
        f.values
          .map((v) => `${JSON.stringify(v.value)}×${v.runs.length}`)
          .join(" | ")
          .slice(0, 60),
      ])
    )
      .split("\n")
      .map((l) => "    " + l)
      .join("\n")
  );

  const changedChecks = report.perCheckStatusChanges.filter((c) => c.changed);
  if (changedChecks.length) {
    console.log("\n  SEO checks that changed status between runs:");
    for (const c of changedChecks) console.log(`    ${c.id}: ${c.statuses.join(" -> ")}`);
  }

  console.log(`\n  dataSource: ${JSON.stringify(report.dataSourceCounts)}`);
  console.log(`  seoScore  : ${scores.join(", ")}  (range ${report.seoScore.range})`);
  console.log(`\n  ${report.verdict}`);
  console.log(`\n  Saved: ${saveResult("extraction-variance", report)}\n`);
}
