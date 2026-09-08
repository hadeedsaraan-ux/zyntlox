import { DimensionStats } from "./types";

export function describe(values: number[]): DimensionStats | null {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) return null;

  const sorted = [...nums].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;

  // Population stddev: these are all the runs we took, not a sample of a larger set.
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;

  const median =
    n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

  return {
    n,
    min: sorted[0],
    max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    mean: round2(mean),
    stddev: round2(Math.sqrt(variance)),
    median: round2(median),
    distinct: [...new Set(sorted)],
  };
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

export function padLeft(text: string, width: number): string {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => pad(c ?? "", widths[i])).join("  ");
  return [
    line(headers),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...rows.map(line),
  ].join("\n");
}

export function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "-";
  return v.toFixed(digits);
}

export function signed(v: number | null, digits = 2): string {
  if (v === null || !Number.isFinite(v)) return "-";
  return (v >= 0 ? "+" : "") + v.toFixed(digits);
}
