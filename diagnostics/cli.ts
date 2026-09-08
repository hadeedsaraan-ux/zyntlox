import { parseArgs } from "node:util";
import { capture } from "./commands/capture";
import { extractionVariance } from "./commands/extractionVariance";
import { inspect, list } from "./commands/inspect";
import { pathCompare } from "./commands/pathCompare";
import { replay } from "./commands/replay";
import { describeKeyPresence } from "./env";
import { spentToday } from "./fixtures";

const HELP = `
  zyntlox diagnostics — decompose score variance into its actual sources

  Usage:  npm run diag -- <command> [options]

  Commands:

    capture --url <url> [--label <slug>] [--force] [--skip-screenshot]
        Scrape once and freeze the facts + screenshot to a fixture.
        COSTS 1 Microlink request. Everything else replays this for free.

    list
        List captured fixtures.

    inspect --fixture <slug>
        Print a fixture's facts and the path to its screenshot.
        The screenshot is what Gemini actually scored — open it to check for a
        regional variant (currency, language, consent banner).

    replay --fixture <slug> [--runs 5] [--models flash,flash-lite]
           [--temps default,0] [--delay-ms 4000] [--dry-run] [--mock] [--print-prompt]
        THE CORE EXPERIMENT. Replays one frozen input through Gemini N times per
        (model × temperature) cell and reports how much each source moves the score.
        COSTS 0 Microlink requests. Needs GEMINI_API_KEY unless --dry-run/--mock.
        "--temps default" means generationConfig is omitted entirely — that cell is
        exactly what production sends today.

    path-compare --fixture <slug> [--fresh]
        Run the regex fallback against the same URL and diff it against the
        Microlink facts. Quantifies how wrong the fallback is for this site.
        COSTS 0 Microlink requests (1 with --fresh).

    extraction-variance --url <url> [--runs 3] --yes [--delay-ms 2000]
        Re-scrape the same URL N times and diff the facts.
        COSTS N Microlink requests. Requires --yes.

  Notes:
    Microlink's free tier is ~25 requests/day. Spending commands log to
    diagnostics/results/.quota-log.jsonl so today's usage is countable.
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", default: false },
      url: { type: "string" },
      fixture: { type: "string" },
      label: { type: "string" },
      runs: { type: "string" },
      models: { type: "string" },
      temps: { type: "string" },
      "delay-ms": { type: "string" },
      force: { type: "boolean", default: false },
      fresh: { type: "boolean", default: false },
      "skip-screenshot": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      mock: { type: "boolean", default: false },
      "print-prompt": { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
    },
  });

  const command = positionals[0];

  if (!command || values.help) {
    console.log(HELP);
    if (!values.help) process.exitCode = 1;
    return;
  }

  const requireFlag = (name: "url" | "fixture"): string => {
    const value = values[name];
    if (!value) {
      console.error(`\n  ${command} requires --${name}\n`);
      process.exit(1);
    }
    return value;
  };

  const num = (raw: string | undefined, fallback: number): number => {
    if (raw === undefined) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      console.error(`\n  Invalid numeric value: ${raw}\n`);
      process.exit(1);
    }
    return n;
  };

  switch (command) {
    case "capture":
      await capture({
        url: requireFlag("url"),
        label: values.label,
        force: values.force,
        skipScreenshot: values["skip-screenshot"],
      });
      break;

    case "list":
      list();
      break;

    case "inspect":
      inspect(requireFlag("fixture"));
      break;

    case "replay":
      await replay({
        fixture: requireFlag("fixture"),
        runs: num(values.runs, 5),
        models: values.models ?? "flash,flash-lite",
        temps: values.temps ?? "default",
        delayMs: num(values["delay-ms"], 4000),
        dryRun: values["dry-run"],
        mock: values.mock,
        printPrompt: values["print-prompt"],
      });
      break;

    case "path-compare":
      await pathCompare({ fixture: requireFlag("fixture"), fresh: values.fresh });
      break;

    case "extraction-variance":
      await extractionVariance({
        url: requireFlag("url"),
        runs: num(values.runs, 3),
        yes: values.yes,
        delayMs: num(values["delay-ms"], 2000),
      });
      break;

    case "env":
      console.log(`\n  GEMINI_API_KEY: ${describeKeyPresence()}`);
      console.log(`  Microlink requests logged today: ${spentToday()}\n`);
      break;

    default:
      console.error(`\n  Unknown command "${command}"\n${HELP}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n  Unexpected failure:", err);
  process.exit(1);
});
