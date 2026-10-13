import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.TEST_BASE || "http://127.0.0.1:4189";
const out = process.env.TEST_OUT || "test-results/site-performance/gallery-query";
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium();
const negative = process.env.TEST_NEGATIVE === "1";
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const errors = [], filterRequests = [];
    // Hold hydration long enough to expose an incorrect static first paint.
    // The negative control deliberately makes those default cards visible.
    await page.route("**/_next/static/chunks/*.js", async route => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      await route.continue();
    });
    await page.addInitScript(({ negative }) => {
      window.__initialGallery = [];
      window.__queryWrites = [];
      const value = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      Object.defineProperty(HTMLInputElement.prototype, "value", {
        ...value,
        set(next) {
          value.set.call(this, next);
          if (window.__queryTypingActive && this.id === "component-search") window.__queryWrites.push({ kind: "set", value: this.value });
        },
      });
      document.addEventListener("input", event => {
        if (window.__queryTypingActive && event.target.id === "component-search") window.__queryWrites.push({ kind: "input", value: event.target.value });
      }, true);
      document.addEventListener("DOMContentLoaded", () => {
        if (negative) {
          const style = document.createElement("style");
          style.textContent = 'html[data-gallery-query-pending="true"] [data-gallery-ready="false"] > :not([data-gallery-loading]) { visibility: visible !important; }';
          document.head.append(style);
        }
        const sample = () => {
          const visible = [...document.querySelectorAll(".component-grid .component-card")].filter(card => {
            const rect = card.getBoundingClientRect();
            for (let node = card; node && node !== document.body; node = node.parentElement) {
              const style = getComputedStyle(node);
              if (style.visibility !== "visible" || style.display === "none" || Number(style.opacity) < 0.1) return false;
            }
            return rect.top < innerHeight && rect.bottom > 0;
          }).map(card => card.getAttribute("href"));
          window.__initialGallery.push({ at: performance.now(), visible });
          if (!window.__initialGalleryDone) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }, { once: true });
    }, { negative });
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error" && /hydrat|didn't match|maximum update depth/i.test(message.text())) errors.push(message.text());
    });
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname === "/components" && url.searchParams.has("_rsc") && (url.searchParams.has("category") || url.searchParams.has("q"))) filterRequests.push(url.href);
    });
    const search = page.getByRole("searchbox", { name: "Search components" });
    async function expectResults({ q, tier, category, slug }) {
      await page.waitForFunction(expected => {
        const input = document.querySelector("#component-search");
        const cards = [...document.querySelectorAll(".component-grid .component-card")];
        const params = new URLSearchParams(location.search);
        return input?.value === expected.q && params.get("tier") === expected.tier && (params.get("category") ?? "all") === expected.category &&
          cards.length === 1 && cards[0].getAttribute("href") === `/components/${expected.slug}`;
      }, { q, tier, category, slug });
    }
    await page.goto(`${base}/components?category=charts&tier=free&q=portfolio`, { waitUntil: "load" });
    await expectResults({ q: "portfolio", tier: "free", category: "charts", slug: "chart-portfolio" });
    await page.waitForFunction(() => window.__initialGallery.some(frame => frame.visible.includes("/components/chart-portfolio")));
    const initial = await page.evaluate(() => { window.__initialGalleryDone = true; return window.__initialGallery; });
    fs.writeFileSync(path.join(out, `initial-${width}.json`), JSON.stringify({ negative, initial }, null, 2) + "\n");
    assert.ok(initial.every(frame => frame.visible.every(href => href === "/components/chart-portfolio")), "a filtered link must never paint unrelated default cards, even before hydration");
    await page.unroute("**/_next/static/chunks/*.js");
    await page.locator('main a[href="/components/chart-portfolio"]').click();
    await page.waitForURL("**/components/chart-portfolio");
    await page.locator("main h1").waitFor();
    await page.goBack();
    await expectResults({ q: "portfolio", tier: "free", category: "charts", slug: "chart-portfolio" });

    await search.press("Escape");
    await page.waitForFunction(() => document.querySelector("#component-search")?.value === "");
    await page.evaluate(() => {
      window.__queryTyping = [];
      window.__queryTypingActive = true;
      const sample = () => {
        window.__queryTyping.push({ at: performance.now(), value: document.querySelector("#component-search")?.value, query: new URLSearchParams(location.search).get("q") ?? "" });
        if (window.__queryTypingActive) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await search.pressSequentially("chart", { delay: 15 });
    await page.waitForFunction(() => document.querySelector("#component-search")?.value === "chart" && new URLSearchParams(location.search).get("q") === "chart");
    await page.waitForTimeout(200);
    const { typing, writes } = await page.evaluate(() => { window.__queryTypingActive = false; return { typing: window.__queryTyping, writes: window.__queryWrites }; });
    assert.equal(await search.inputValue(), "chart", "URL observation must not undo fast typing");
    for (let i = 1; i < typing.length; i++) assert.ok(typing[i].value.length >= typing[i - 1].value.length, "typing must not bounce to an older router snapshot");
    for (let i = 1; i < writes.length; i++) assert.ok(writes[i].value.length >= writes[i - 1].value.length, "a queued URL must not write an older value between animation frames");

    const before = filterRequests.length;
    // Next supports native History updates. Exercise an external query change
    // while the gallery stays mounted, then real back/forward through it.
    await page.evaluate(() => history.pushState(null, "", "/components?category=charts&tier=pro&q=candlestick"));
    await expectResults({ q: "candlestick", tier: "pro", category: "charts", slug: "chart-candlestick" });
    await page.goBack();
    await page.waitForFunction(() => document.querySelector("#component-search")?.value === "chart" && new URLSearchParams(location.search).get("tier") === "free");
    await page.goForward();
    await expectResults({ q: "candlestick", tier: "pro", category: "charts", slug: "chart-candlestick" });
    assert.equal(filterRequests.length, before, "query/history changes must not fetch another server render");

    await page.goto(`${base}/components?category=not-a-category&tier=free&q=waffle`, { waitUntil: "load" });
    await expectResults({ q: "waffle", tier: "free", category: "all", slug: "chart-waffle" });
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(out, `query-${width}.png`) });
    fs.writeFileSync(path.join(out, `query-${width}.json`), JSON.stringify({ ok: true, width, typing, writes, errors, filterRequests }, null, 2) + "\n");
    await page.close();
  }
  console.log("Desktop/mobile: static-gallery hydration, filtered links, cached return, fast typing, external query updates, back/forward and invalid category recovery pass.");
} finally { await browser.close(); }
