import fs from "node:fs";
import path from "node:path";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.TEST_BASE || "http://127.0.0.1:4189";
const out = process.env.TEST_OUT || "test-results/site-performance/navigation-feedback.json";
const browser = await launchChromium({ args: [] });
fs.mkdirSync(path.dirname(out), { recursive: true });
const reports = [];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route(url => url.pathname === "/blocks" && url.searchParams.has("_rsc"), async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.continue().catch(() => {});
    });
    await page.addInitScript(() => {
      window.__feedback = { frames: [] };
      addEventListener("click", event => {
        const link = event.target.closest("a");
        if (!link || new URL(link.href).pathname !== "/blocks") return;
        window.__feedback.start = performance.now();
        const sample = () => {
          const indicators = [...document.querySelectorAll('[data-route-pending="true"]')];
          const visible = indicators.filter(node => getComputedStyle(node).visibility === "visible" && getComputedStyle(node).display !== "none");
          const at = performance.now() - window.__feedback.start;
          window.__feedback.frames.push({ at, pending: indicators.length, visible: visible.length, pathname: location.pathname });
          if (visible.length && window.__feedback.first === undefined) window.__feedback.first = at;
          if (at < 5000) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }, true);
    });
    await page.goto(base + "/", { waitUntil: "load" });
    if (mobile) await page.getByRole("button", { name: "Open menu" }).click();
    const scope = mobile ? "#mobile-nav" : "header";
    await page.locator(`${scope} nav a[href="/blocks"]`).click();
    await page.waitForTimeout(450);
    const waiting = await page.evaluate(() => ({ ...window.__feedback, pathname: location.pathname }));
    await page.screenshot({ path: out.replace(/\.json$/, mobile ? "-mobile.png" : "-desktop.png") });
    // The latest click must win when an earlier server response arrives late.
    await page.locator(`${scope} nav a[href="/pricing"]`).click();
    await page.waitForURL("**/pricing");
    await page.waitForTimeout(3400);
    const final = await page.evaluate(() => ({ ...window.__feedback, pathname: location.pathname, pending: document.querySelectorAll('[data-route-pending="true"]').length, mainInert: !!document.querySelector("#main")?.inert }));
    if (!mobile) {
      const popupPromise = page.context().waitForEvent("page");
      await page.locator('header nav a[href="/components"]').click({ modifiers: [process.platform === "darwin" ? "Meta" : "Control"] });
      const popup = await popupPromise;
      await popup.waitForLoadState("domcontentloaded");
      if (page.url() !== base + "/pricing" || await page.locator('[data-route-pending="true"]').count()) errors.push("modifier click changed the current page or its pending state");
      await popup.close();
    }
    reports.push({ mobile, waiting, final, errors,
      ok: waiting.pathname === "/" && waiting.first < 350 && waiting.frames.some(frame => frame.visible === 1) && final.frames.every(frame => frame.pending <= 1) && final.pathname === "/pricing" && final.pending === 0 && !final.mainInert && !errors.length });
    await page.close();
  }
} finally { await browser.close(); }
const result = { summary: { ok: reports.every(report => report.ok), observed: { feedbackMax: Math.max(...reports.map(report => report.waiting.first ?? 5000)) } }, reports };
fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result.summary));
if (process.env.TEST_ASSERT === "1" && !result.summary.ok) process.exitCode = 1;
