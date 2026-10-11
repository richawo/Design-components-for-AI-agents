import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.TEST_BASE || "http://localhost:3218";
const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const categoryRequests = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.searchParams.has("category") && url.searchParams.has("_rsc")) categoryRequests.push(url.href);
  });
  await page.goto(`${base}/components`);
  await page.locator(".site-reveal[data-reveal]").first().waitFor({ state: "attached" });
  await page.locator('[data-row="item:charts"]').click();
  await page.waitForURL("**/components?category=charts");
  assert.equal(await page.locator('[data-row="item:charts"]').getAttribute("aria-pressed"), "true");
  assert.equal(categoryRequests.length, 0, "local filtering must not request another server render");
  const count = Number((await page.locator('[data-row="item:charts"]').innerText()).match(/\d+$/)[0]);
  // Outgoing cards remain mounted until their exit animation finishes.
  await page.waitForFunction(count => document.querySelectorAll(".component-card").length === count, count);
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
  await page.locator('header nav a[href="/pricing"]').scrollIntoViewIfNeeded();
  await page.locator('header nav a[href="/pricing"]').click();
  await page.waitForURL("**/pricing");
  await page.goBack();
  await page.waitForURL("**/components?category=charts");
  await page.locator('[data-row="item:charts"][aria-pressed="true"]').waitFor();
  assert.equal(await page.locator(".component-card").count(), count);
  await page.screenshot({ path: "test-results/site-performance/gallery-history.png" });
  await page.goForward();
  await page.waitForURL("**/pricing");
  await page.goto(`${base}/components?category=charts`);
  await page.locator(".site-reveal[data-reveal]").first().waitFor({ state: "attached" });
  assert.equal(await page.locator(".component-card").count(), count);
  assert.deepEqual(errors, []);
  console.log("Categories update without a server render; back/forward restores the URL, selection and cards.");
} finally { await browser.close(); }
