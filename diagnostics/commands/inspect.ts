import { buildRoastPrompt } from "../../app/lib/prompts";
import { ageHours, listFixtures, loadFixture, screenshotPath, sha256 } from "../fixtures";

export function list(): void {
  const slugs = listFixtures();
  if (slugs.length === 0) {
    console.log("\n  No fixtures. Capture one:  npm run diag -- capture --url <url>\n");
    return;
  }
  console.log("");
  for (const slug of slugs) {
    const f = loadFixture(slug);
    const age = ageHours(f.capturedAt);
    console.log(
      `  ${slug}\n    ${f.url}\n    captured ${age.toFixed(1)}h ago · ${f.capturedWith.dataSource} · seo ${f.seoChecks.seoScore}/10`
    );
  }
  console.log("");
}

/**
 * Also the answer to the geo question: the stored PNG is literally the page
 * Microlink's headless browser rendered, from Microlink's egress region — which is
 * exactly what Gemini scored. If it's a regional variant, the subjective scores
 * describe a page the user has never seen.
 */
export function inspect(slug: string): void {
  const f = loadFixture(slug);
  const currentSha = sha256(
    buildRoastPrompt({
      extractedData: f.extractedData,
      seoChecks: f.seoChecks,
      hasScreenshot: Boolean(f.screenshotFile),
    })
  );

  console.log(`\n  ${f.slug}  (${f.url})`);
  console.log(`  captured ${ageHours(f.capturedAt).toFixed(1)}h ago at ${f.capturedAt}`);
  console.log(`  node ${f.capturedWith.nodeVersion} · git ${f.capturedWith.gitCommit ?? "?"}\n`);

  console.log(`  dataSource     : ${f.extractedData.dataSource} (isVerified: ${f.extractedData.isVerified})`);
  console.log(`  title          : ${JSON.stringify(f.extractedData.title)} (${f.extractedData.titleLength} chars)`);
  console.log(`  metaDescription: ${JSON.stringify(f.extractedData.metaDescription)} (${f.extractedData.metaDescriptionLength} chars)`);
  console.log(`  h1Tags         : ${JSON.stringify(f.extractedData.h1Tags)}`);
  console.log(`  images         : ${f.extractedData.imagesWithoutAlt} of ${f.extractedData.totalImages} missing alt`);
  console.log(`  viewport       : ${f.extractedData.viewportPresent} · canonical: ${f.extractedData.canonicalPresent}`);
  console.log(`  hasHttps       : ${f.extractedData.hasHttps}`);
  console.log(`  detectedStack  : ${f.extractedData.detectedStack}`);
  console.log(`  seoScore       : ${f.seoChecks.seoScore}/10\n`);

  if (f.screenshotFile) {
    console.log(`  screenshot: ${screenshotPath(f.slug)}  (${f.screenshotBytes} bytes)`);
    console.log(
      `    Open it to check for a regional variant — currency, language, a consent\n` +
        `    banner, a shipping selector. This image is what Gemini actually scored.`
    );
  } else {
    console.log("  screenshot: none captured");
  }

  console.log(
    `\n  promptSha256: ${f.promptSha256}${
      currentSha === f.promptSha256 ? " (matches current code)" : `\n  DRIFT: current code produces ${currentSha}`
    }\n`
  );
}
