import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.TEST_BASE || "http://localhost:3227";
const browser = await launchChromium();
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1440, height: 900 }, reducedMotion: "reduce" });
    const errors = [], requests = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", r => {
      const url = new URL(r.url());
      if (url.pathname === "/components" && url.searchParams.has("_rsc") && !url.searchParams.has("tier")) requests.push(url.href);
    });
    await page.goto(`${base}/pricing`);
    if (mobile) await page.getByRole("button", { name: "Open menu" }).click();
    // Chromium may discard a prefetch response body before CDP can read it.
    // Resource timing retains its decoded size: the partial shell is <3 KB,
    // while the complete 243-card catalogue is >160 KB.
    await page.waitForFunction(() => performance.getEntriesByType("resource").some(r => new URL(r.name).pathname === "/components" && r.decodedBodySize > 50000), null, { timeout: 20000 });
    const before = requests.length;
    const link = page.locator(`${mobile ? "#mobile-nav" : "header"} nav a[href="/components"]`);
    await link.click();
    await page.waitForURL("**/components");
    await page.locator(".component-card").first().waitFor();
    await page.waitForTimeout(500);
    assert.equal(requests.length, before, "the click reuses the prefetched route");
    assert.equal(await page.locator(".component-card").count(), 12);
    if (mobile) assert.equal(await page.locator("#main").evaluate(el => el.inert), false);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Desktop/mobile: the full Components route is ready before the click and is reused on navigation; initial batch remains 12.");
} finally { await browser.close(); }
