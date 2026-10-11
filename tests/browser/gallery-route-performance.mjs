import fs from "node:fs";
import path from "node:path";
import { launchChromium } from "../../scripts/lib/browser.mjs";

// Real header links only. Each origin starts in a fresh browser context, then
// repeats the journey to distinguish first navigation from the router cache.
const base = process.env.PERF_BASE || "http://localhost:3225";
const out = process.env.PERF_OUT || "test-results/site-performance/gallery-route.json";
const negative = process.env.PERF_NEGATIVE === "1";
const browser = await launchChromium();
const reports = [];
try {
  for (const origin of ["/pricing", "/"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 80, downloadThroughput: 625000, uploadThroughput: 312500 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(({ negative }) => {
      window.__routePerf = { clicks: [], tasks: [] };
      new PerformanceObserver(list => window.__routePerf.tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: "longtask", buffered: true });
      addEventListener("click", event => {
        if (!event.target.closest('header nav a[href="/components"]')) return;
        const sample = { start: performance.now() };
        window.__routePerf.clicks.push(sample);
        if (negative) { const end = performance.now() + 300; while (performance.now() < end) {} }
        requestAnimationFrame(() => {
          sample.firstFrame = performance.now() - sample.start;
          requestAnimationFrame(() => { sample.secondFrame = performance.now() - sample.start; });
        });
        const check = () => {
          const cards = [...document.querySelectorAll(".component-grid .component-card")];
          if (cards.length && location.pathname === "/components") {
            sample.cardsReady = performance.now() - sample.start;
            sample.cardCount = cards.length;
            requestAnimationFrame(() => { sample.cardsSecondFrame = performance.now() - sample.start; });
          } else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }, true);
    }, { negative });
    await page.goto(base + origin, { waitUntil: "load" });
    for (const visit of ["first", "repeat"]) {
      // Same time for normal viewport prefetch in every run, including baseline.
      await page.waitForTimeout(3000);
      if (process.env.PERF_PROFILE && origin === "/pricing" && visit === "first") {
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.start");
        await cdp.send("Tracing.start", { categories: "devtools.timeline,v8", transferMode: "ReturnAsStream" });
      }
      await page.locator('header nav a[href="/components"]').click();
      await page.waitForFunction(() => window.__routePerf.clicks.at(-1)?.cardsSecondFrame);
      await page.waitForTimeout(1500);
      const result = await page.evaluate(() => {
        const sample = window.__routePerf.clicks.at(-1);
        const resources = performance.getEntriesByType("resource").filter(r => new URL(r.name).pathname === "/components").map(r => ({ url: r.name, start: r.startTime - sample.start, response: r.responseStart - sample.start, end: r.responseEnd - sample.start, duration: r.duration, bytes: r.transferSize, decoded: r.decodedBodySize }));
        const scripts = performance.getEntriesByType("resource").filter(r => r.name.includes(".js") && r.responseEnd > sample.start).map(r => ({ url: r.name, start: r.startTime - sample.start, end: r.responseEnd - sample.start, decoded: r.decodedBodySize }));
        // The click's task starts before its capture listener, so include
        // overlapping tasks as well as tasks that start after the click.
        const tasks = window.__routePerf.tasks.filter(t => t.start + t.duration >= sample.start && t.start < sample.start + sample.cardsSecondFrame + 500);
        return { ...sample, resources, scripts, tasks, longTaskMax: Math.max(0, ...tasks.map(t => t.duration)) };
      });
      if (process.env.PERF_PROFILE && origin === "/pricing" && visit === "first") {
        fs.writeFileSync(out.replace(".json", ".cpuprofile"), JSON.stringify((await cdp.send("Profiler.stop")).profile));
        const complete = new Promise(resolve => cdp.once("Tracing.tracingComplete", resolve));
        await cdp.send("Tracing.end");
        const { stream } = await complete;
        let trace = "";
        while (true) { const chunk = await cdp.send("IO.read", { handle: stream }); trace += chunk.data; if (chunk.eof) break; }
        await cdp.send("IO.close", { handle: stream });
        fs.writeFileSync(out.replace(".json", "-trace.json"), trace);
      }
      reports.push({ origin, visit, ...result, errors: [...errors] });
      if (visit === "first") {
        fs.mkdirSync(path.dirname(out), { recursive: true });
        await page.screenshot({ path: out.replace(/\.json$/, `-${origin === "/" ? "home" : "pricing"}.png`) });
        await page.locator('header nav a[href="/pricing"]').click();
        await page.waitForURL("**/pricing");
      }
    }
    await context.close();
  }
} finally { await browser.close(); }
const observed = Object.fromEntries(["firstFrame", "secondFrame", "cardsReady", "cardsSecondFrame", "longTaskMax"].map(key => [key, Math.max(...reports.map(r => r[key]))]));
const result = { environment: { viewport: "1440x900", cpu: 4, latency: 80, mbps: 5, renderer: "SwiftShader", negative }, summary: { ok: reports.every(r => !r.errors.length && r.cardsSecondFrame < 350 && r.secondFrame < 200), observed }, reports };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
