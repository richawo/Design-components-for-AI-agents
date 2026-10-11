import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.TEST_BASE || "http://localhost:3217";
const browser = await launchChromium();
try {
  const page = await browser.newPage();
  let blocked = false;
  let navigations = 0;
  page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++; });
  await page.route("**/_next/static/chunks/*.js", async route => {
    if (!blocked) { blocked = true; return route.abort("failed"); }
    return route.continue();
  });
  await page.goto(`${base}/preview/button-press-depth`, { waitUntil: "domcontentloaded" }).catch(error => {
    if (!String(error).includes("interrupted by another navigation")) throw error;
  });
  await page.locator("[data-demo]").first().waitFor({ timeout: 30000 });
  assert(blocked, "the negative condition actually blocked a build asset");
  assert.equal(navigations, 2, "the failed load recovered with exactly one reload");
  assert(await page.evaluate(() => sessionStorage.getItem("dfa:asset-recovery")));
  console.log("Missing build asset recovered to a working preview with exactly one reload.");
} finally {
  await browser.close();
}
