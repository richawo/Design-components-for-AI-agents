import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.TEST_BASE || "http://127.0.0.1:4189";
const out = process.env.TEST_OUT || "test-results/component-navigation/recovery";
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium({ args: [] });
try {
  for (const mode of ["transient", "persistent", "stalled"]) {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    let requests = 0, fail = true;
    await page.route("**/preview/chart-portfolio", async route => {
      requests++;
      if (mode === "stalled" && requests === 1) {
        await route.fulfill({ status: 200, contentType: "text/html", body: '<div data-preview-slug="chart-portfolio" data-preview-ready="false"></div>' });
      } else if (fail && mode !== "stalled" && (mode === "persistent" || requests === 1)) {
        await route.fulfill({ status: 503, contentType: "text/html", body: "<title>Temporarily unavailable</title><h1>Error 1105</h1>" });
      } else await route.continue();
    });
    await page.goto(`${base}/components/chart-portfolio`, { waitUntil: "load" });
    if (mode !== "transient") {
      const retry = page.getByRole("button", { name: "Retry preview", exact: true });
      await retry.waitFor({ timeout: 20000 });
      const expected = mode === "persistent" ? 2 : 1;
      assert.equal(requests, expected, "retry a failed document once; allow a valid document to hydrate");
      await page.waitForTimeout(1200);
      assert.equal(requests, expected, "a persistent outage must not cause a retry loop");
      assert.equal(await page.locator("#preview iframe").getAttribute("aria-hidden"), "true");
      await retry.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/${mode}-error.png` });
      fail = false;
      await retry.click();
    }
    await page.frameLocator("#preview iframe").locator('[data-preview-ready="true"]').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => document.querySelector("#preview iframe")?.parentElement.getAttribute("aria-busy") === "false");
    assert.equal(requests, mode === "persistent" ? 3 : 2);
    assert.equal(await page.locator("#preview iframe").getAttribute("aria-hidden"), "false");
    assert.equal(await page.getByRole("button", { name: "Retry preview", exact: true }).count(), 0);
    await page.screenshot({ path: `${out}/${mode}-recovered.png` });
    await context.close();
  }
  console.log("Transient failure recovered once; persistent and stalled previews stopped and manual retry recovered.");
} finally { await browser.close(); }
