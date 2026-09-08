import { callGeminiWithRetry, GeminiApiResponse } from "../../app/lib/gemini";
import { buildRoastParts, buildRoastPrompt } from "../../app/lib/prompts";
import {
  computeOverallScore,
  OVERALL_SCORE_WEIGHTS,
  parseAssessments,
  scoreOf,
} from "../../app/lib/scoring";
import { CriterionRating, GeminiModel } from "../../app/lib/types";
import { CRITERIA_BY_CATEGORY } from "../../app/lib/criteria";
import { requireGeminiKey, describeKeyPresence } from "../env";
import { ageHours, loadFixture, loadScreenshotBase64, newResultPath, saveResultTo, sha256 } from "../fixtures";
import { describe, fmt, signed, table } from "../stats";
import { Cell, CellSummary, ReplayReport, ReplayRun } from "../types";

const MODEL_ALIASES: Record<string, GeminiModel> = {
  flash: "gemini-flash-latest",
  "flash-lite": "gemini-flash-lite-latest",
  "gemini-flash-latest": "gemini-flash-latest",
  "gemini-flash-lite-latest": "gemini-flash-lite-latest",
};

function parseModels(spec: string): GeminiModel[] {
  return spec.split(",").map((raw) => {
    const model = MODEL_ALIASES[raw.trim()];
    if (!model) {
      console.error(`\n  Unknown model "${raw.trim()}". Use: flash, flash-lite\n`);
      process.exit(1);
    }
    return model;
  });
}

/** "default" is a sentinel meaning "omit generationConfig entirely" — that cell IS production. */
function parseTemps(spec: string): (number | null)[] {
  return spec.split(",").map((raw) => {
    const t = raw.trim();
    if (t === "default") return null;
    const n = Number(t);
    if (!Number.isFinite(n)) {
      console.error(`\n  Invalid temperature "${t}". Use a number or "default".\n`);
      process.exit(1);
    }
    return n;
  });
}

function cellLabel(cell: Cell): string {
  const model = cell.model === "gemini-flash-latest" ? "flash" : "flash-lite";
  return `${model} @ ${cell.temperature === null ? "default" : `t=${cell.temperature}`}`;
}

function mockResponse(runIndex: number): GeminiApiResponse {
  // One deliberately malformed response so parse-failure handling is exercised.
  if (runIndex === 2) {
    return { candidates: [{ content: { parts: [{ text: "{ this is not json" }] } }] };
  }
  const RATINGS: CriterionRating[] = ["good", "adequate", "poor"];
  const block = (defs: { id: string }[], offset: number) =>
    Object.fromEntries(
      defs.map((d, i) => [
        d.id,
        { rating: RATINGS[(runIndex + offset + i) % 3], evidence: "mock observation" },
      ])
    );

  return {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                firstImpression: "Mock impression.",
                plainFirstImpression: "Mock plain impression.",
                design: block(CRITERIA_BY_CATEGORY.design, 0),
                trust: block(CRITERIA_BY_CATEGORY.trust, 1),
                ux: block(CRITERIA_BY_CATEGORY.ux, 2),
                biggestProblems: [{ issue: "x", plainIssue: "x", impact: "High", effort: "Easy" }],
                quickWins: [{ text: "y", plainText: "y", snippet: null }],
                suggestions: [{ text: "z", plainText: "z", snippet: { language: "css", code: "a{}" } }],
              }),
            },
          ],
        },
      },
    ],
  };
}

function inRange(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10;
}

export async function replay(args: {
  fixture: string;
  runs: number;
  models: string;
  temps: string;
  delayMs: number;
  dryRun: boolean;
  mock: boolean;
  printPrompt: boolean;
}): Promise<void> {
  const fixture = loadFixture(args.fixture);
  const screenshotBase64 = loadScreenshotBase64(fixture);

  const parts = buildRoastParts({
    extractedData: fixture.extractedData,
    seoChecks: fixture.seoChecks,
    screenshotBase64,
    markdown: fixture.markdown,
  });
  const promptText = buildRoastPrompt({
    extractedData: fixture.extractedData,
    seoChecks: fixture.seoChecks,
    hasScreenshot: Boolean(screenshotBase64),
    markdown: fixture.markdown,
  });

  if (args.printPrompt) {
    console.log(promptText);
    return;
  }

  const currentSha = sha256(promptText);
  const promptDrift = currentSha !== fixture.promptSha256;

  const models = parseModels(args.models);
  const temps = parseTemps(args.temps);
  const cells: Cell[] = models.flatMap((model) => temps.map((temperature) => ({ model, temperature })));

  console.log(`\n  Fixture   : ${fixture.slug} (${fixture.url})`);
  console.log(`  Captured  : ${ageHours(fixture.capturedAt).toFixed(1)}h ago · ${fixture.capturedWith.dataSource}`);
  console.log(`  Frozen SEO: ${fixture.seoChecks.seoScore}/10 (held constant across every run)`);
  console.log(`  Prompt    : ${promptText.length} chars, ${parts.length} part(s)${screenshotBase64 ? " incl. screenshot" : ""}`);
  console.log(`  API key   : ${describeKeyPresence()}`);
  console.log(`  Cells     : ${cells.length} × ${args.runs} runs = ${cells.length * args.runs} Gemini calls`);
  console.log(`  Microlink : 0 requests (replaying a frozen fixture)`);

  if (promptDrift) {
    console.log(
      `\n  WARNING: prompt has changed since capture.\n` +
        `    fixture: ${fixture.promptSha256}\n` +
        `    current: ${currentSha}\n` +
        `  Comparing runs across a prompt edit is not valid. Re-capture the fixture.`
    );
  }

  if (ageHours(fixture.capturedAt) > 24 * 7) {
    console.log(`\n  NOTE: fixture is over a week old; the live site may have changed.`);
  }

  if (args.dryRun) {
    console.log("\n  DRY RUN — no calls made. Planned cells:\n");
    for (const cell of cells) {
      const body: Record<string, unknown> = { contents: [{ parts }] };
      if (cell.temperature !== null) body.generationConfig = { temperature: cell.temperature };
      const serialized = JSON.stringify(body);
      const hasConfig = serialized.includes("generationConfig");
      const expected = cell.temperature !== null;
      console.log(
        `    ${cellLabel(cell).padEnd(24)} payload ${(serialized.length / 1_048_576).toFixed(2)} MB` +
          `  generationConfig: ${hasConfig ? "present" : "omitted"}` +
          `  ${hasConfig === expected ? "OK" : "*** MISMATCH ***"}`
      );
    }
    console.log(
      `\n  The "default" cell must show generationConfig: omitted — that is production's exact body.\n`
    );
    return;
  }

  if (!args.mock) requireGeminiKey();

  const startedAt = new Date().toISOString();
  const report: ReplayReport = {
    kind: "replay",
    fixtureSlug: fixture.slug,
    url: fixture.url,
    fixtureCapturedAt: fixture.capturedAt,
    fixtureAgeHours: Number(ageHours(fixture.capturedAt).toFixed(2)),
    promptDrift,
    startedAt,
    finishedAt: null,
    seoScore: fixture.seoChecks.seoScore,
    runs: [],
    summaries: [],
    decomposition: {
      samplingRange: null,
      samplingStddev: null,
      modelIdentityDelta: null,
      temperatureDelta: null,
      temperatureRangeCollapse: null,
    },
  };

  const resultPath = newResultPath(`replay-${fixture.slug}`);
  let consecutiveFailures = 0;
  let runIndex = 0;

  console.log(args.mock ? "\n  MOCK MODE — no network calls\n" : "\n  Running…\n");

  for (const cell of cells) {
    for (let i = 0; i < args.runs; i++) {
      runIndex++;
      const runStartedAt = new Date().toISOString();
      const t0 = Date.now();

      let data: GeminiApiResponse | null = null;
      let modelUsed: GeminiModel | null = null;
      let attempts = 0;
      let latencyMs = 0;
      let error: string | null = null;

      if (args.mock) {
        data = mockResponse(runIndex);
        modelUsed = cell.model;
        attempts = 1;
        latencyMs = Date.now() - t0;
      } else {
        try {
          // Single-element models array: with the default chain, a 503 on flash would
          // silently turn a "flash" datapoint into a "flash-lite" one and contaminate
          // the exact comparison being measured.
          const res = await callGeminiWithRetry(parts, undefined, {
            models: [cell.model],
            ...(cell.temperature !== null ? { temperature: cell.temperature } : {}),
          });
          data = res.data;
          modelUsed = res.modelUsed;
          attempts = res.attempts;
          latencyMs = res.latencyMs;
        } catch (err) {
          error = err instanceof Error ? err.message : JSON.stringify(err);
          latencyMs = Date.now() - t0;
        }
      }

      let rawText = "";
      let parseOk = false;
      let parseError: string | null = null;
      let parsed: Record<string, unknown> = {};

      if (data) {
        rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
        try {
          parsed = JSON.parse(cleaned || "{}");
          parseOk = true;
        } catch (err) {
          parseError = err instanceof Error ? err.message : String(err);
        }
      }

      // Scores come from the per-criterion ratings via the SAME production code path,
      // so the harness can never measure a different scoring rule than the app uses.
      const assessments = parseAssessments(parsed);
      const design = assessments ? scoreOf(assessments, "design") : null;
      const trust = assessments ? scoreOf(assessments, "trust") : null;
      const ux = assessments ? scoreOf(assessments, "ux") : null;
      const scoresInRange =
        assessments !== null && inRange(design) && inRange(trust) && inRange(ux);

      // Uses the real production scoring function — never a reimplementation, or a
      // future weight change would make the harness quietly lie.
      const overallScore = scoresInRange
        ? computeOverallScore(design, trust, ux, fixture.seoChecks.seoScore)
        : null;
      // Unrounded: computeOverallScore rounds to an integer, quantizing small effects away.
      const overallScoreRaw = scoresInRange
        ? (design * OVERALL_SCORE_WEIGHTS.design +
            trust * OVERALL_SCORE_WEIGHTS.trust +
            ux * OVERALL_SCORE_WEIGHTS.ux +
            fixture.seoChecks.seoScore * OVERALL_SCORE_WEIGHTS.seo) *
          10
        : null;

      const items = (key: string) => (Array.isArray(parsed[key]) ? (parsed[key] as unknown[]) : []);
      const run: ReplayRun = {
        runIndex,
        cell,
        modelUsed,
        fellBack: modelUsed !== null && modelUsed !== cell.model,
        attempts,
        latencyMs,
        startedAt: runStartedAt,
        httpOk: data !== null,
        parseOk,
        parseError,
        error,
        rawTextLength: rawText.length,
        rawTextSha256: rawText ? sha256(rawText) : "",
        designScore: design,
        trustScore: trust,
        uxScore: ux,
        assessments,
        scoresInRange,
        seoScore: fixture.seoChecks.seoScore,
        overallScore,
        overallScoreRaw: overallScoreRaw === null ? null : Math.round(overallScoreRaw * 100) / 100,
        counts: {
          biggestProblems: items("biggestProblems").length,
          quickWins: items("quickWins").length,
          suggestions: items("suggestions").length,
          snippetsPresent: [...items("quickWins"), ...items("suggestions")].filter(
            (it) => it && typeof it === "object" && (it as { snippet?: unknown }).snippet
          ).length,
        },
      };

      report.runs.push(run);
      saveResultTo(resultPath, report); // persist after every run

      const status = error
        ? `ERROR ${error.slice(0, 40)}`
        : !parseOk
        ? "PARSE FAIL"
        : !scoresInRange
        ? "SCORES INVALID"
        : `d${design} t${trust} u${ux} -> ${overallScore}`;
      console.log(
        `    ${String(runIndex).padStart(3)}. ${cellLabel(cell).padEnd(24)} ${String(latencyMs).padStart(6)}ms  ${
          attempts > 1 ? `[${attempts} attempts] ` : ""
        }${status}${run.fellBack ? "  *** FELL BACK ***" : ""}`
      );

      if (error) {
        if (++consecutiveFailures >= 3) {
          console.error(`\n  Aborting: 3 consecutive failures.\n`);
          break;
        }
      } else {
        consecutiveFailures = 0;
      }

      if (!args.mock && args.delayMs > 0) {
        await new Promise((r) => setTimeout(r, args.delayMs));
      }
    }
    if (consecutiveFailures >= 3) break;
  }

  // --- summaries -----------------------------------------------------------
  for (const cell of cells) {
    const runs = report.runs.filter(
      (r) => r.cell.model === cell.model && r.cell.temperature === cell.temperature
    );
    const valid = runs.filter((r) => r.scoresInRange);
    const latencies = runs.map((r) => r.latencyMs);
    report.summaries.push({
      cell,
      runs: runs.length,
      ok: valid.length,
      parseFailures: runs.filter((r) => r.httpOk && !r.parseOk).length,
      fallbacks: runs.filter((r) => r.fellBack).length,
      design: describe(valid.map((r) => r.designScore as number)),
      trust: describe(valid.map((r) => r.trustScore as number)),
      ux: describe(valid.map((r) => r.uxScore as number)),
      overall: describe(valid.map((r) => r.overallScore as number)),
      overallRaw: describe(valid.map((r) => r.overallScoreRaw as number)),
      latencyMs: latencies.length
        ? {
            min: Math.min(...latencies),
            max: Math.max(...latencies),
            mean: Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length),
          }
        : null,
    });
  }

  const find = (model: GeminiModel, temperature: number | null): CellSummary | undefined =>
    report.summaries.find((s) => s.cell.model === model && s.cell.temperature === temperature);

  const production = find("gemini-flash-latest", null);
  const lite = find("gemini-flash-lite-latest", null);
  const zeroTemp = find("gemini-flash-latest", 0);

  report.decomposition.samplingRange = production?.overall?.range ?? null;
  report.decomposition.samplingStddev = production?.overall?.stddev ?? null;
  report.decomposition.modelIdentityDelta =
    production?.overallRaw && lite?.overallRaw
      ? Math.round((lite.overallRaw.mean - production.overallRaw.mean) * 100) / 100
      : null;
  report.decomposition.temperatureDelta =
    production?.overallRaw && zeroTemp?.overallRaw
      ? Math.round((zeroTemp.overallRaw.mean - production.overallRaw.mean) * 100) / 100
      : null;
  report.decomposition.temperatureRangeCollapse =
    production?.overall && zeroTemp?.overall
      ? { omitted: production.overall.range, zero: zeroTemp.overall.range }
      : null;

  report.finishedAt = new Date().toISOString();
  saveResultTo(resultPath, report);

  // --- output --------------------------------------------------------------
  console.log("\n  Per-cell overallScore (0-100), seoScore held constant:\n");
  console.log(
    table(
      ["cell", "n", "ok", "parseFail", "min", "max", "range", "mean", "stddev"],
      report.summaries.map((s) => [
        cellLabel(s.cell),
        String(s.runs),
        String(s.ok),
        String(s.parseFailures),
        fmt(s.overall?.min ?? null, 0),
        fmt(s.overall?.max ?? null, 0),
        fmt(s.overall?.range ?? null, 0),
        fmt(s.overall?.mean ?? null),
        fmt(s.overall?.stddev ?? null),
      ])
    )
      .split("\n")
      .map((l) => "    " + l)
      .join("\n")
  );

  console.log("\n  Sub-scores (mean ± stddev):\n");
  console.log(
    table(
      ["cell", "design", "trust", "ux"],
      report.summaries.map((s) => [
        cellLabel(s.cell),
        `${fmt(s.design?.mean ?? null)} ± ${fmt(s.design?.stddev ?? null)}`,
        `${fmt(s.trust?.mean ?? null)} ± ${fmt(s.trust?.stddev ?? null)}`,
        `${fmt(s.ux?.mean ?? null)} ± ${fmt(s.ux?.stddev ?? null)}`,
      ])
    )
      .split("\n")
      .map((l) => "    " + l)
      .join("\n")
  );

  const d = report.decomposition;
  console.log("\n  VARIANCE DECOMPOSITION\n");
  if (d.samplingRange !== null) {
    console.log(
      `    Sampling      : same model, same prompt, same frozen facts —\n` +
        `                    overallScore spanned ${fmt(d.samplingRange, 0)} points (stddev ${fmt(d.samplingStddev)}).`
    );
  } else {
    console.log(`    Sampling      : not measured (needs the flash @ default cell).`);
  }
  console.log(
    d.modelIdentityDelta !== null
      ? `    Model identity: falling back to flash-lite shifts mean overallScore by ${signed(d.modelIdentityDelta)} points.`
      : `    Model identity: not measured (needs both models at default temperature).`
  );
  if (d.temperatureDelta !== null && d.temperatureRangeCollapse) {
    console.log(
      `    Temperature   : pinning t=0 shifts the mean by ${signed(d.temperatureDelta)} points and\n` +
        `                    changes the spread from ${fmt(d.temperatureRangeCollapse.omitted, 0)} to ${fmt(d.temperatureRangeCollapse.zero, 0)} points.`
    );
  } else {
    console.log(`    Temperature   : not measured (needs --temps default,0).`);
  }

  const anyFallback = report.runs.some((r) => r.fellBack);
  if (anyFallback) {
    console.log(`\n    *** A run fell back to a different model — that cell is contaminated. ***`);
  }
  const retried = report.runs.filter((r) => r.attempts > 1).length;
  if (retried > 0) {
    console.log(`\n    ${retried} run(s) needed retries — consider a larger --delay-ms.`);
  }

  console.log(`\n  Full results: ${resultPath}\n`);
}
