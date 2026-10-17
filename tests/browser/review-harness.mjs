import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";

export async function runReview(prefixes) {
  const requested = new Set(process.argv.slice(2));
  const available = fs.readdirSync("tests/browser/review")
    .filter(file => file.endsWith(".mjs") && prefixes.some(prefix => file.startsWith(prefix)))
    .map(file => file.slice(0, -4))
    .filter(slug => ["free", "pro"].some(tier => fs.existsSync(`registry/${tier}/${slug}/${slug}.tsx`)));
  for (const slug of requested) assert.ok(available.includes(slug), `Unknown or unavailable review case: ${slug}`);
  const cases = available.filter(slug => !requested.size || requested.has(slug));
  if (!cases.length) { console.log("Review cases skipped: their private sources are not checked out."); return; }
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(120000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    for (const slug of cases) {
      errors.length = 0;
      const mount = code => mountFixture(page, slug, "pro", code);
      const { check } = await import(`./review/${slug}.mjs`);
      try {
        await check({ page, mount, assert });
      } catch (error) {
        const folder = "test-results/review";
        fs.mkdirSync(folder, { recursive: true });
        await page.screenshot({ path: `${folder}/${slug}-failed.png`, fullPage: true });
        fs.writeFileSync(`${folder}/${slug}-failed.txt`, await page.locator("body").innerText());
        console.error(`Failure evidence: ${folder}/${slug}-failed.{png,txt}`);
        throw error;
      }
      assert.deepEqual(errors, [], `${slug} runtime errors`);
      console.log(`PASS review ${slug}`);
    }
  } finally { await browser.close(); }
}
