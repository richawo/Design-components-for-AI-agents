import fs from "node:fs";
import path from "node:path";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.PERF_BASE || "http://localhost:3230";
const out = process.env.PERF_OUT || "test-results/site-performance/gallery-slow-after.json";
const negative = process.env.PERF_NEGATIVE === "1";
fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await launchChromium({ args: [] });
const reports = [];
try {
  for (let run = 0; run < Number(process.env.PERF_RUNS || 3); run++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 125000, uploadThroughput: 62500 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const requests = new Map(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    cdp.on("Network.requestWillBeSent", e => requests.set(e.requestId, { url: e.request.url.replace(base, ""), type: e.type, bytes: 0, priority: e.request.initialPriority }));
    cdp.on("Network.dataReceived", e => { const r = requests.get(e.requestId); if (r) r.bytes += e.encodedDataLength; });
    if (negative) await page.route(/\/(?:card-previews|previews)\/[^/]+\.webp$/, async route => { await new Promise(r => setTimeout(r, 3000)); await route.continue(); });
    await page.addInitScript(() => {
      window.__slow = { tasks: [] };
      new PerformanceObserver(list => window.__slow.tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: "longtask" });
      document.addEventListener("click", e => {
        if (!e.target.closest('header nav a[href="/components"]')) return;
        const p = window.__slow; p.start = performance.now();
        requestAnimationFrame(() => { p.firstFrame = performance.now() - p.start; requestAnimationFrame(() => { p.secondFrame = performance.now() - p.start; }); });
        let visible;
        const check = () => {
          if (!visible) {
            const cards = [...document.querySelectorAll(".component-grid .component-card")];
            if (cards.length) { p.cardsReady = performance.now() - p.start; visible = cards.filter(c => c.getBoundingClientRect().top < innerHeight).map(c => c.querySelector("img")).filter(Boolean); p.posters = visible.map(i => i.src); }
          }
          if (visible?.length && visible.every(i => i.complete && i.naturalWidth > 0)) {
            p.posters = visible.map(i => i.currentSrc);
            p.postersReady = performance.now() - p.start;
            requestAnimationFrame(() => { p.postersSecondFrame = performance.now() - p.start; });
          } else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }, true);
    });
    await page.goto(`${base}/pricing`, { waitUntil: "load", timeout: 90000 });
    await page.waitForTimeout(3000);
    await page.locator('header nav a[href="/components"]').click();
    await page.waitForFunction(() => window.__slow.postersSecondFrame, null, { timeout: 30000 });
    const report = await page.evaluate(() => {
      const p = window.__slow;
      return { ...p, cards: document.querySelectorAll(".component-card").length, videoSources: document.querySelectorAll(".component-card video source").length, playbackRequested: [...document.querySelectorAll(".component-card video")].filter(v => !v.paused).length, longTaskMax: Math.max(0, ...p.tasks.filter(t => t.start + t.duration >= p.start).map(t => t.duration)) };
    });
    report.requests = [...requests.values()]; report.errors = errors;
    reports.push(report);
    await page.screenshot({ path: out.replace(".json", `-${run}.png`) });
    await context.close();
  }
} finally { await browser.close(); }
const median = key => reports.map(r => r[key]).sort((a, b) => a - b)[Math.floor(reports.length / 2)];
const observed = { firstFrameMax: Math.max(...reports.map(r => r.firstFrame)), secondFrameMax: Math.max(...reports.map(r => r.secondFrame)), longTaskMax: Math.max(...reports.map(r => r.longTaskMax)), postersReadyMedian: median("postersReady"), postersSecondFrameMedian: median("postersSecondFrame"), cardsReadyMedian: median("cardsReady") };
const result = { environment: { cpu: 4, mbps: 1, latency: 150, renderer: "browser default", negative }, summary: { ok: observed.secondFrameMax < 200 && observed.postersSecondFrameMedian < 2500 && reports.every(r => !r.errors.length), observed }, reports };
fs.writeFileSync(out, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result.summary));
