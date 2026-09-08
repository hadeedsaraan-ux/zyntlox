import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Fixture } from "./types";

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = join(HERE, "fixtures");
export const RESULTS_DIR = join(HERE, "results");

export function ensureDirs(): void {
  for (const dir of [FIXTURES_DIR, RESULTS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

export function slugify(url: string): string {
  let base = url;
  try {
    const parsed = new URL(url);
    base = parsed.hostname + parsed.pathname;
  } catch {
    // fall through to raw string
  }
  return (
    base
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "fixture"
  );
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function gitCommit(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: HERE,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export function fixturePath(slug: string): string {
  return join(FIXTURES_DIR, `${slug}.json`);
}

export function screenshotPath(slug: string): string {
  return join(FIXTURES_DIR, `${slug}.png`);
}

export function fixtureExists(slug: string): boolean {
  return existsSync(fixturePath(slug));
}

/**
 * The screenshot is written as a sibling PNG rather than embedded base64 so the
 * fixture JSON stays readable and the geo question is answerable by opening the image.
 */
export function saveFixture(fixture: Fixture, screenshotBase64: string | null): void {
  ensureDirs();
  if (screenshotBase64) {
    writeFileSync(screenshotPath(fixture.slug), Buffer.from(screenshotBase64, "base64"));
  }
  writeFileSync(fixturePath(fixture.slug), JSON.stringify(fixture, null, 2));
}

export function loadFixture(slug: string): Fixture {
  const path = fixturePath(slug);
  if (!existsSync(path)) {
    const available = listFixtures();
    console.error(
      `\n  No fixture "${slug}".\n` +
        (available.length
          ? `  Available: ${available.join(", ")}\n`
          : "  None captured yet.\n") +
        `\n  Capture one with:  npm run diag -- capture --url <url>\n`
    );
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf8")) as Fixture;
}

/** Screenshots round-trip exactly: the base64 came from Buffer.toString("base64"). */
export function loadScreenshotBase64(fixture: Fixture): string | null {
  if (!fixture.screenshotFile) return null;
  const path = join(FIXTURES_DIR, fixture.screenshotFile);
  if (!existsSync(path)) return null;
  return readFileSync(path).toString("base64");
}

export function listFixtures(): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export function ageHours(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

export function saveResult(name: string, data: unknown): string {
  ensureDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(RESULTS_DIR, `${stamp}-${name}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
}

/** Overwrites in place — used to persist partial results after every replay run. */
export function saveResultTo(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

export function newResultPath(name: string): string {
  ensureDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return join(RESULTS_DIR, `${stamp}-${name}.json`);
}

/**
 * Manual quota ledger. Nothing tracks Microlink's ~25/day cap, so every spending
 * command appends here and the CLI can show today's spend.
 */
export function recordMicrolinkSpend(requests: number, command: string): void {
  ensureDirs();
  const line = JSON.stringify({ ts: new Date().toISOString(), requests, command });
  const path = join(RESULTS_DIR, ".quota-log.jsonl");
  const prev = existsSync(path) ? readFileSync(path, "utf8") : "";
  writeFileSync(path, prev + line + "\n");
}

export function spentToday(): number {
  const path = join(RESULTS_DIR, ".quota-log.jsonl");
  if (!existsSync(path)) return 0;
  const today = new Date().toISOString().slice(0, 10);
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as { ts: string; requests: number };
      } catch {
        return null;
      }
    })
    .filter((e): e is { ts: string; requests: number } => e !== null && e.ts.startsWith(today))
    .reduce((sum, e) => sum + e.requests, 0);
}
