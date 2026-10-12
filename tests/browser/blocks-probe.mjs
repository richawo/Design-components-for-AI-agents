import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const requested = new Set(process.argv.slice(2));
const cases = fs
  .readdirSync("tests/browser/blocks")
  .filter((file) => file.endsWith(".mjs"))
  .map((file) => file.slice(0, -4))
  .filter((slug) => !requested.size || requested.has(slug));
const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1500 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  for (const slug of cases) {
    const full = "block-" + slug;
    if (!fs.existsSync(`registry/pro/${full}`)) continue;
    const mount = async (code) => {
      await mountFixture(page, full, "pro", code);
      await page.locator("#root").evaluate((el) => {
        el.style.maxWidth = "none";
        el.style.padding = "0";
      });
    };
    const { check } = await import(`./blocks/${slug}.mjs`);
    await check({ page, mount, assert });
    assert.deepEqual(errors, [], slug);
    console.log("PASS block workflow " + slug);
  }
} finally {
  await browser.close();
}
