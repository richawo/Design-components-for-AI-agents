import fs from "node:fs";
import path from "node:path";
import { launchChromium } from "../../scripts/lib/browser.mjs";

// Measure real links, including their server wait. A fast first animation frame
// alone cannot establish that the destination arrived promptly.
const base = (process.env.PERF_BASE || "http://127.0.0.1:4189").replace(/\/$/, "");
const out = process.env.PERF_OUT || "test-results/site-performance/route-fetch.json";
const cpu = Number(process.env.PERF_CPU || 4);
const dwell = Number(process.env.PERF_DWELL || 3000);
const negative = process.env.PERF_NEGATIVE === "1";
const cacheCases = process.env.PERF_CACHE_CASES?.split(",") ?? [];
const cases = [
  { id: "gallery", origin: "/pricing", destination: "/components", selector: 'header nav a[href="/components"]', ready: ".component-grid .component-card" },
  { id: "blocks", origin: "/", destination: "/blocks", selector: 'header nav a[href="/blocks"]', heading: "Start with the whole page.", ready: 'main a[href="/blocks/block-saas-dashboard"]' },
  { id: "component", origin: "/components?category=charts", destination: "/components/chart-portfolio", selector: 'main a[href="/components/chart-portfolio"]', heading: "Portfolio Chart", ready: "#preview iframe" },
  { id: "block", origin: "/blocks", destination: "/blocks/block-music-workspace", selector: 'main a[href="/blocks/block-music-workspace"]', heading: "Music Listening Workspace", ready: "#preview iframe" },
  { id: "mobile-gallery", origin: "/pricing", destination: "/components", selector: '#mobile-nav a[href="/components"]', ready: ".component-grid .component-card", mobile: true },
  { id: "keyboard-gallery", origin: "/pricing", destination: "/components", selector: 'header nav a[href="/components"]', ready: ".component-grid .component-card", keyboard: true },
  { id: "pricing", origin: "/blocks", destination: "/pricing", selector: 'header nav a[href="/pricing"]', heading: "Free to start.", ready: "main h1" },
  { id: "account", origin: "/pricing", destination: "/account", selector: 'header a[href="/account"]', heading: "licence.", ready: "main h1" },
  { id: "category", origin: "/pricing", destination: "/categories/charts", selector: 'footer a[href="/categories/charts"]', heading: "Charts & maps", ready: "main h1" },
  { id: "docs", origin: "/pricing", destination: "/docs", selector: 'header nav a[href="/docs"]', heading: "Introduction", ready: "main h1" },
  { id: "blog", origin: "/pricing", destination: "/blog", selector: 'header nav a[href="/blog"]', ready: 'main nav[aria-label="Topics"]' },
];
const selected = process.env.PERF_CASES?.split(",");
fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await launchChromium({ args: [] });
const reports = [];
try {
  for (const scenario of cases.filter(c => !selected || selected.includes(c.id))) {
    console.log(`Replay ${scenario.id}`);
    const context = await browser.newContext({ viewport: { width: scenario.mobile ? 390 : 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 80, downloadThroughput: 625000, uploadThroughput: 312500 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    const responses = [], errors = [];
    page.on("pageerror", e => errors.push(e.message));
    cdp.on("Network.responseReceived", ({ response, type }) => {
      const url = new URL(response.url);
      if (url.pathname !== scenario.destination) return;
      const headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]));
      responses.push({ url: response.url, type, status: response.status, protocol: response.protocol,
        cache: headers["x-opennext-cache"] ?? headers["x-nextjs-cache"] ?? headers["x-next-cache"] ?? null,
        cacheControl: headers["cache-control"] ?? null,
        fromDiskCache: response.fromDiskCache ?? false,
        timing: response.timing ? { requestTime: response.timing.requestTime, sendEnd: response.timing.sendEnd, receiveHeadersEnd: response.timing.receiveHeadersEnd } : null });
    });
    await page.addInitScript(({ scenario, negative }) => {
      window.__routeFetch = { clicks: [], tasks: [] };
      new PerformanceObserver(list => window.__routeFetch.tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: "longtask", buffered: true });
      addEventListener("click", event => {
        const link = event.target.closest("a");
        if (!link || new URL(link.href).pathname !== scenario.destination) return;
        const sample = { start: performance.now(), origin: location.pathname, frames: [] };
        window.__routeFetch.clicks.push(sample);
        // A known main-thread stall must fail the same latency guard.
        if (negative) { const until = performance.now() + 300; while (performance.now() < until) {} }
        requestAnimationFrame(() => {
          sample.firstFrame = performance.now() - sample.start;
          requestAnimationFrame(() => { sample.secondFrame = performance.now() - sample.start; });
        });
        const check = () => {
          const at = performance.now() - sample.start;
          const heading = document.querySelector("main h1")?.textContent ?? "";
          const ready = location.pathname === scenario.destination && !!document.querySelector(scenario.ready) && (!scenario.heading || heading.includes(scenario.heading));
          const pending = document.querySelector('[data-route-pending="true"]');
          if (pending && sample.feedback === undefined) sample.feedback = at;
          sample.frames.push({ at, pathname: location.pathname, heading, ready, pending: !!pending });
          if (ready && sample.destinationReady === undefined) {
            sample.destinationReady = at;
            requestAnimationFrame(() => { sample.destinationPaint = performance.now() - sample.start; });
          }
          if (sample.destinationPaint !== undefined && at > sample.destinationPaint + 250) sample.done = true;
          else if (at < 30000) requestAnimationFrame(check);
          else sample.timeout = true;
        };
        requestAnimationFrame(check);
      }, true);
    }, { scenario, negative });
    await page.goto(base + scenario.origin, { waitUntil: "load" });
    for (const visit of ["first", "repeat"]) {
      if (visit === "repeat") await page.goBack({ waitUntil: "commit" });
      // A filtered static gallery replaces its default SSR cards once during
      // hydration. Start the user journey from the restored, visible origin.
      if (scenario.origin.startsWith("/components") && await page.locator("[data-gallery-ready]").count())
        await page.locator('[data-gallery-ready="true"]').waitFor();
      if (scenario.mobile) await page.getByRole("button", { name: "Open menu", exact: true }).click();
      const link = page.locator(scenario.selector).first();
      await link.scrollIntoViewIfNeeded();
      if (scenario.keyboard) await link.focus();
      await page.waitForTimeout(dwell);
      const responseCount = responses.length;
      if (scenario.keyboard) await link.press("Enter");
      else await link.click();
      await page.waitForFunction(() => window.__routeFetch.clicks.at(-1)?.done || window.__routeFetch.clicks.at(-1)?.timeout);
      const report = await page.evaluate(destination => {
        const perf = window.__routeFetch, sample = perf.clicks.at(-1);
        const tasks = perf.tasks.filter(t => t.start + t.duration >= sample.start && t.start < sample.start + sample.destinationPaint);
        const resources = performance.getEntriesByType("resource").filter(r => new URL(r.name).pathname === destination).map(r => ({ url: r.name, start: r.startTime - sample.start, response: r.responseStart - sample.start, end: r.responseEnd - sample.start, duration: r.duration, bytes: r.transferSize, decoded: r.decodedBodySize }));
        const scripts = performance.getEntriesByType("resource").filter(r => r.name.includes(".js") && r.responseEnd > sample.start && r.startTime < sample.start + sample.destinationPaint).map(r => ({ url: r.name, start: r.startTime - sample.start, end: r.responseEnd - sample.start, decoded: r.decodedBodySize }));
        const settled = sample.frames.filter(f => f.at >= sample.destinationPaint);
        return { ...sample, tasks, longTaskMax: Math.max(0, ...tasks.map(t => t.duration)), resources, scripts,
          stableDestination: settled.every(f => f.ready), pathname: location.pathname,
          documentLoads: performance.getEntriesByType("navigation").length };
      }, scenario.destination);
      reports.push({ id: scenario.id, visit, destination: scenario.destination, ...report,
        responses: [...responses], responsesAfterClick: responses.length - responseCount, errors: [...errors] });
      console.log(JSON.stringify({ id: scenario.id, visit, destinationPaint: report.destinationPaint, firstFrame: report.firstFrame, secondFrame: report.secondFrame, longTaskMax: report.longTaskMax, stable: report.stableDestination }));
      if (visit === "first") await page.screenshot({ path: out.replace(/\.json$/, `-${scenario.id}.png`) });
    }
    await context.close();
  }
} finally { await browser.close(); }
const observed = Object.fromEntries(["firstFrame", "secondFrame", "destinationReady", "destinationPaint", "longTaskMax"].map(key => [key, Math.max(0, ...reports.map(r => r[key] ?? 30000))]));
const result = { environment: { cpu, latency: 80, mbps: 5, dwell, renderer: "browser default", negative },
  summary: { ok: reports.every(r => !r.errors.length && r.stableDestination && r.destinationPaint < 700 && r.secondFrame < 200 && (!cacheCases.includes(r.id) || r.responses.some(response => response.cache === "HIT"))), observed }, reports };
fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ ...result, reports: reports.map(({ frames, responses, resources, scripts, ...r }) => ({ ...r, resources })) }, null, 2));
if (process.env.PERF_ASSERT === "1" && !result.summary.ok) process.exitCode = 1;
