import { ExtractedSiteData } from "../app/lib/siteData";
import { CategoryAssessment, CheckStatus, GeminiModel, SeoCheck, SeoChecks } from "../app/lib/types";

/**
 * A frozen snapshot of one site's scraped facts. Capturing costs 1 Microlink request;
 * replaying against it costs none. Freezing the input is what makes AI variance
 * measurable in isolation.
 */
export interface Fixture {
  version: 1;
  slug: string;
  url: string;
  capturedAt: string;
  capturedWith: {
    nodeVersion: string;
    gitCommit: string | null;
    dataSource: ExtractedSiteData["dataSource"];
  };
  extractedData: ExtractedSiteData;
  seoChecks: SeoChecks;
  /** Page text sent alongside the screenshot — must be frozen too, or replay would
   *  exercise a different prompt than production sends. */
  markdown: string | null;
  screenshotFile: string | null;
  screenshotBytes: number | null;
  /** sha256 of the built prompt at capture time — the drift tripwire for replay. */
  promptSha256: string;
}

/** One (model, temperature) experiment cell. `temperature: null` = generationConfig omitted. */
export interface Cell {
  model: GeminiModel;
  temperature: number | null;
}

export interface ReplayRun {
  runIndex: number;
  cell: Cell;
  modelUsed: GeminiModel | null;
  /** Must always be false — cells pin a single model. Kept as a live assertion. */
  fellBack: boolean;
  attempts: number;
  latencyMs: number;
  startedAt: string;
  httpOk: boolean;
  parseOk: boolean;
  parseError: string | null;
  error: string | null;
  rawTextLength: number;
  rawTextSha256: string;
  designScore: number | null;
  trustScore: number | null;
  uxScore: number | null;
  /** Per-criterion ratings + evidence, so rating stability can be inspected directly. */
  assessments: CategoryAssessment[] | null;
  /** All three scores finite and within 0-10. */
  scoresInRange: boolean;
  seoScore: number;
  overallScore: number | null;
  /** Unrounded — computeOverallScore rounds to an integer, hiding sub-half-point effects. */
  overallScoreRaw: number | null;
  counts: {
    biggestProblems: number;
    quickWins: number;
    suggestions: number;
    snippetsPresent: number;
  };
}

export interface DimensionStats {
  n: number;
  min: number;
  max: number;
  range: number;
  mean: number;
  stddev: number;
  median: number;
  distinct: number[];
}

export interface CellSummary {
  cell: Cell;
  runs: number;
  ok: number;
  parseFailures: number;
  fallbacks: number;
  design: DimensionStats | null;
  trust: DimensionStats | null;
  ux: DimensionStats | null;
  overall: DimensionStats | null;
  overallRaw: DimensionStats | null;
  latencyMs: { min: number; max: number; mean: number } | null;
}

export interface ReplayReport {
  kind: "replay";
  fixtureSlug: string;
  url: string;
  fixtureCapturedAt: string;
  fixtureAgeHours: number;
  promptDrift: boolean;
  startedAt: string;
  finishedAt: string | null;
  seoScore: number;
  runs: ReplayRun[];
  summaries: CellSummary[];
  decomposition: {
    samplingRange: number | null;
    samplingStddev: number | null;
    modelIdentityDelta: number | null;
    temperatureDelta: number | null;
    temperatureRangeCollapse: { omitted: number; zero: number } | null;
  };
}

export interface FieldDiff {
  field: string;
  stable: boolean;
  values: Array<{ value: string | number | boolean | null; runs: number[] }>;
}

export interface ExtractionVarianceReport {
  kind: "extraction-variance";
  url: string;
  n: number;
  startedAt: string;
  runs: Array<{
    runIndex: number;
    ok: boolean;
    error: string | null;
    latencyMs: number;
    extractedData: ExtractedSiteData | null;
    seoChecks: SeoChecks | null;
  }>;
  fields: FieldDiff[];
  dataSourceCounts: Record<string, number>;
  seoScore: { values: number[]; min: number; max: number; range: number };
  perCheckStatusChanges: Array<{ id: SeoCheck["id"]; statuses: CheckStatus[]; changed: boolean }>;
  verdict: string;
}

export interface PathCompareRow {
  field: string;
  microlink: unknown;
  fallback: unknown;
  differs: boolean;
  /** True where the two paths differ by construction, not because of instability. */
  expectedByDesign: boolean;
  note: string | null;
}

export interface PathCompareReport {
  kind: "path-compare";
  url: string;
  fixtureSlug: string | null;
  fixtureCapturedAt: string | null;
  fixtureAgeHours: number | null;
  microlinkSource: "fixture" | "live";
  microlink: { extractedData: ExtractedSiteData; seoChecks: SeoChecks };
  fallback: { extractedData: ExtractedSiteData; seoChecks: SeoChecks };
  rows: PathCompareRow[];
  seoScoreDelta: number;
  checkDeltas: Array<{
    id: SeoCheck["id"];
    microlink: CheckStatus;
    fallback: CheckStatus;
    pointsDelta: number;
  }>;
  verdict: string;
}
