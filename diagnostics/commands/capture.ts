import { fetchSiteData } from "../../app/lib/siteData";
import { computeSeoAudit } from "../../app/lib/seoAudit";
import { buildRoastPrompt } from "../../app/lib/prompts";
import {
  fixtureExists,
  gitCommit,
  saveFixture,
  screenshotPath,
  sha256,
  slugify,
} from "../fixtures";
import { Fixture } from "../types";

export async function capture(args: {
  url: string;
  label?: string;
  force: boolean;
  skipScreenshot: boolean;
}): Promise<void> {
  const slug = args.label ?? slugify(args.url);

  if (fixtureExists(slug) && !args.force) {
    console.error(
      `\n  Fixture "${slug}" already exists.\n` +
        `  Pass --force to overwrite, or --label <name> to keep both.\n`
    );
    process.exit(1);
  }

  console.log(`  Capturing ${args.url} -> ${slug}\n`);

  const result = await fetchSiteData(args.url, (s) => console.log(`    ${s.label}`), undefined, {
    skipScraper: args.skipScreenshot,
  });

  if (!result.ok) {
    console.error(`\n  Capture failed: ${result.error}\n`);
    process.exit(1);
  }

  const seoChecks = computeSeoAudit(result.extractedData);
  const promptSha256 = sha256(
    buildRoastPrompt({
      extractedData: result.extractedData,
      seoChecks,
      hasScreenshot: Boolean(result.screenshotBase64),
      markdown: result.markdown,
    })
  );

  const fixture: Fixture = {
    version: 1,
    slug,
    url: args.url,
    capturedAt: new Date().toISOString(),
    capturedWith: {
      nodeVersion: process.version,
      gitCommit: gitCommit(),
      dataSource: result.extractedData.dataSource,
    },
    extractedData: result.extractedData,
    seoChecks,
    markdown: result.markdown,
    screenshotFile: result.screenshotBase64 ? `${slug}.png` : null,
    screenshotBytes: result.screenshotBase64
      ? Buffer.from(result.screenshotBase64, "base64").length
      : null,
    promptSha256,
  };

  saveFixture(fixture, result.screenshotBase64);

  console.log(`\n  Saved fixture "${slug}"`);
  console.log(`    dataSource : ${result.extractedData.dataSource}`);
  console.log(`    isVerified : ${result.extractedData.isVerified}`);
  console.log(`    seoScore   : ${seoChecks.seoScore}/10`);
  console.log(`    markdown   : ${result.markdown ? `${result.markdown.length} chars` : "none"}`);
  console.log(`    timings    : total ${result.timings.totalMs}ms, scraper ${result.timings.scraperMs ?? "-"}ms`);
  if (fixture.screenshotFile) {
    console.log(`    screenshot : ${screenshotPath(slug)} (${fixture.screenshotBytes} bytes)`);
  } else {
    console.log(`    screenshot : none`);
  }

  if (result.extractedData.dataSource === "raw-fetch") {
    console.log(
      `\n  NOTE: SEO facts came from UNRENDERED HTML (scraper did not return an html field).\n` +
        `  JS-rendered content is invisible on this path.`
    );
  }
  console.log("");
}
