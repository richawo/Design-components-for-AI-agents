/** Optional second-engine smoke test. Install with: npx playwright-core install webkit */
import assert from "node:assert/strict";
import fs from "node:fs";
import { webkit } from "playwright-core";

const base = (process.env.PREVIEW_BASE || "http://localhost:3100").replace(
  /\/$/,
  "",
);
const workflows = fs
  .readdirSync("tests/browser/pro-50")
  .filter((name) => name.endsWith(".mjs"))
  .map((name) => name.slice(0, -4));
const scroll = [
  "scroll-expanding-mosaic",
  "scroll-cinema-frame",
  "scroll-background-wipe",
  "scroll-chapter-stack",
  "scroll-horizontal-showcase",
  "scroll-image-curtain",
];
const slugs = [...workflows, ...scroll].filter((slug) =>
  fs.existsSync(`registry/pro/${slug}`),
);
assert.ok(
  slugs.length,
  "Check out the private Pro sources before running this test.",
);
const browser = await webkit.launch({ headless: true });
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  for (const slug of slugs) {
    const errors = [];
    const onError = (error) => errors.push(error.message);
    page.on("pageerror", onError);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/preview/${slug}`, { waitUntil: "networkidle" });
      await page.locator("section").first().waitFor();
      await page.waitForTimeout(150);
      assert.ok(await page.locator("section").first().innerText(), slug);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${slug} at ${width}px`,
      );
      assert.deepEqual(errors, [], `${slug} at ${width}px`);
    }
    page.off("pageerror", onError);
    console.log(`PASS WebKit render ${slug}`);
  }
} finally {
  await browser.close();
}
