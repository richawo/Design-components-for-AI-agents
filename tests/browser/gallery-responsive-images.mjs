import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.TEST_BASE || "http://localhost:3232";
const browser = await launchChromium({ args: [] });
const out = "test-results/site-performance";
fs.mkdirSync(out, { recursive: true });
const results = [];
try {
  for (const [width, dpr, candidate] of [[1440, 1, ".480.webp"], [1100, 2, ".768.webp"], [390, 2, ".768.webp"], [390, 3, "/previews/chart-candlestick.webp"]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: dpr, reducedMotion: "reduce" });
    const page = await context.newPage(), requests = [], errors = [];
    page.on("request", r => { if (r.resourceType() === "image") requests.push(r.url()); });
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(`${base}/components`);
    const first = page.locator(".component-card img").first();
    await first.waitFor();
    await first.evaluate(i => i.decode());
    const url = await first.evaluate(i => i.currentSrc);
    assert.ok(url.endsWith(candidate), `${width}px DPR ${dpr}: ${url}`);
    const original = await first.getAttribute("src");
    if (candidate.startsWith(".")) assert.ok(!requests.some(r => r.endsWith(original)), "Unused full-size image downloaded");
    const card = page.locator(".component-card").first();
    const before = await card.boundingBox();
    await page.screenshot({ path: `${out}/gallery-responsive-${width}-${dpr}.png` });
    assert.deepEqual(await card.boundingBox(), before);
    assert.equal(await page.locator(".component-card").count(), 12);
    assert.deepEqual(errors, []);
    results.push({ width, dpr, url, card: before });
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  let failures = 0;
  await page.route("**/card-previews/*", route => { failures++; return route.fulfill({ status: 404, body: "Missing previous deployment asset" }); });
  await page.goto(`${base}/components`);
  await page.waitForFunction(() => {
    const i = document.querySelector(".component-card img");
    return i?.complete && i.naturalWidth > 0 && !i.srcset;
  });
  assert.ok(failures > 0);
  assert.ok(await page.locator(".component-card img").first().evaluate(i => i.currentSrc.endsWith("/previews/chart-candlestick.webp")));
  await page.waitForTimeout(500);
  assert.ok(failures <= 12, "Fallback retried failed derivatives repeatedly");
  await context.close();
  console.log(JSON.stringify({ ok: true, results, missingDerivativeFallback: true }));
} finally { await browser.close(); }
