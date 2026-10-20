import fs from "node:fs";
import path from "node:path";
import { launchChromium } from "../../scripts/lib/browser.mjs";

// Measure the visible, mounted preview, not just the arrival of its iframe.
const base = (process.env.PERF_BASE || "http://127.0.0.1:3100").replace(/\/$/, "");
const out = process.env.PERF_OUT || "test-results/component-navigation/report.json";
const slugs = (process.env.PERF_SLUGS || "chart-portfolio,three-globe-arcs,mobile-settings").split(",");
const cpu = Number(process.env.PERF_CPU || 4);
const negative = process.env.PERF_NEGATIVE === "1";
const prefix = process.env.PERF_LOCALE ? `/${process.env.PERF_LOCALE}` : "";
const catalogue = JSON.parse(fs.readFileSync(new URL("../../registry/__generated__/index.json", import.meta.url), "utf8"));
const browser = await launchChromium({ args: [] });
const reports = [];
fs.mkdirSync(path.dirname(out), { recursive: true });
try {
  for (const slug of slugs) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 80, downloadThroughput: 625000, uploadThroughput: 312500 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    const requests = new Map(), failures = [], errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error" && /hydrati|Minified React error #4(?:18|23|25)/i.test(message.text())) errors.push(message.text());
    });
    cdp.on("Network.requestWillBeSent", event => requests.set(event.requestId, {
      url: event.request.url.replace(base, ""), type: event.type, start: event.timestamp,
      initiator: event.initiator.type, priority: event.request.initialPriority,
    }));
    cdp.on("Network.responseReceived", event => {
      const request = requests.get(event.requestId);
      if (request) Object.assign(request, { status: event.response.status, headersAt: event.timestamp,
        cache: event.response.headers["x-opennext-cache"] ?? null, timing: event.response.timing });
      if (event.response.status >= 500) failures.push({ url: event.response.url.replace(base, ""), status: event.response.status });
    });
    cdp.on("Network.loadingFinished", event => {
      const request = requests.get(event.requestId);
      if (request) Object.assign(request, { end: event.timestamp, bytes: event.encodedDataLength });
    });
    await page.addInitScript(({ slug, negative, prefix }) => {
      window.__componentPerf = { tasks: [], samples: [] };
      new PerformanceObserver(list => window.__componentPerf.tasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })))).observe({ type: "longtask", buffered: true });
      document.addEventListener("click", event => {
        if (!event.target.closest(`a[href="${prefix}/components/${slug}"]`)) return;
        const sample = { start: performance.now() };
        window.__componentPerf.samples.push(sample);
        if (negative) { const end = performance.now() + 300; while (performance.now() < end) {} }
        requestAnimationFrame(() => {
          sample.firstFrame = performance.now() - sample.start;
          requestAnimationFrame(() => { sample.secondFrame = performance.now() - sample.start; });
        });
        const check = () => {
          const frame = document.querySelector("#preview iframe");
          const at = performance.now() - sample.start;
          if (frame && location.pathname === `${prefix}/components/${slug}`) {
            sample.shell ??= at;
            const mounted = frame.contentDocument?.querySelector(`[data-preview-slug="${slug}"][data-preview-ready="true"]`);
            if (mounted && Number(getComputedStyle(frame).opacity) > 0 && !frame.parentElement.matches('[aria-busy="true"]')) {
              sample.previewReady = at;
              requestAnimationFrame(() => { sample.previewPaint = performance.now() - sample.start; });
              return;
            }
          }
          if (at < 55000) requestAnimationFrame(check);
          else sample.timeout = true;
        };
        requestAnimationFrame(check);
      }, true);
    }, { slug, negative, prefix });
    try {
      // Use the real search and catalogue card. Never inject a substitute link.
      const name = catalogue.find(entry => entry.slug === slug)?.name;
      if (!name) throw new Error(`Cannot find catalogue name for ${slug}`);
      const origin = `${base}${prefix}/components?q=${encodeURIComponent(name)}`;
      await page.goto(origin, { waitUntil: "load" });
      await page.locator('[data-gallery-ready="true"]').waitFor();
      const link = page.locator(`main a[href="${prefix}/components/${slug}"]`).first();
      // A second document visit preserves HTTP caches but starts a fresh router.
      // Back/forward behaviour has its own gallery navigation regression replay.
      for (const visit of ["first", "warm"]) {
        if (visit === "warm") await page.goto(origin, { waitUntil: "load" });
        await page.locator('[data-gallery-ready="true"]').waitFor();
        await link.waitFor({ state: "visible" });
        await link.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        await link.click();
        await page.waitForFunction(() => window.__componentPerf.samples.at(-1)?.previewPaint || window.__componentPerf.samples.at(-1)?.timeout);
        const sample = await page.evaluate(() => {
          const perf = window.__componentPerf, sample = perf.samples.at(-1);
          const tasks = perf.tasks.filter(task => task.start + task.duration >= sample.start && task.start < sample.start + (sample.previewPaint ?? 55000));
          return { ...sample, longTaskMax: Math.max(0, ...tasks.map(task => task.duration)), tasks,
            heading: document.querySelector("main h1")?.textContent, pathname: location.pathname };
        });
        const preview = page.frames().find(frame => frame.url().startsWith(`${base}${prefix}/preview/${slug}`));
        const previewScripts = preview ? await preview.evaluate(() => [...new Set(performance.getEntriesByType("resource")
          .filter(resource => new URL(resource.name).pathname.endsWith(".js")).map(resource => new URL(resource.name).pathname))]) : [];
        reports.push({ slug, visit, ...sample, previewScripts, requests: [...requests.values()], failures: [...failures], errors: [...errors] });
        fs.writeFileSync(out, JSON.stringify({ reports }, null, 2));
        console.log(JSON.stringify({ slug, visit, ...sample }));
        if (visit === "first") await page.screenshot({ path: out.replace(/\.json$/, `-${slug}.png`) });
      }
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const observed = Object.fromEntries(["firstFrame", "secondFrame", "shell", "previewPaint", "longTaskMax"].map(key => [key, Math.max(0, ...reports.map(report => report[key] ?? 55000))]));
const summary = { ok: reports.every(report => !report.timeout && !report.errors.length && !report.failures.length && report.previewPaint < 2500 && report.secondFrame < 200 && report.previewScripts.length <= 24), observed };
fs.writeFileSync(out, JSON.stringify({ environment: { base, prefix, cpu, negative, latency: 80, mbps: 5 }, summary, reports }, null, 2) + "\n");
console.log(JSON.stringify({ summary }));
if (process.env.PERF_ASSERT === "1" && !summary.ok) process.exitCode = 1;
