import fs from "node:fs";
import path from "node:path";
import { webkit } from "playwright-core";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.TEST_BASE || "http://localhost:3230";
const out = process.env.HOVER_OUT || "test-results/site-performance/hover-after.json";
const browser = process.env.TEST_BROWSER === "webkit" ? await webkit.launch() : await launchChromium({ args: [] });
fs.mkdirSync(path.dirname(out), { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${base}/components`);
  await page.locator(".component-card").first().waitFor();
  await page.waitForTimeout(1200);
  if (process.env.HOVER_CSS) await page.addStyleTag({ content: fs.readFileSync(process.env.HOVER_CSS, "utf8") });
  if (process.env.HOVER_NEGATIVE) await page.addStyleTag({ content: ".component-grid .component-card::after { transition: none !important; }" });
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    window.__hover = { phase: "entry", samples: [], tasks: [], feedback: [], longTasksSupported: PerformanceObserver.supportedEntryTypes.includes("longtask") };
    if (window.__hover.longTasksSupported) new PerformanceObserver(list => window.__hover.tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: "longtask" });
    const cards = [...document.querySelectorAll(".component-card")].slice(0, 3);
    const tick = () => {
      window.__hover.samples.push({ time: performance.now(), phase: window.__hover.phase, opacity: cards.map(c => Number(getComputedStyle(c, "::after").opacity)) });
      window.__hover.frame = requestAnimationFrame(tick);
    };
    window.__hover.frame = requestAnimationFrame(tick);
    document.addEventListener("pointerover", e => {
      if (!e.target.closest(".component-card")) return;
      const start = performance.now();
      window.__hover.entered ??= start;
      requestAnimationFrame(() => { const first = performance.now() - start; requestAnimationFrame(() => window.__hover.feedback.push({ first, second: performance.now() - start })); });
    }, true);
  });
  const cards = page.locator(".component-card");
  const first = await cards.nth(0).boundingBox(), second = await cards.nth(1).boundingBox();
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.waitForTimeout(750);
  await page.evaluate(() => { window.__hover.phase = "gap"; });
  await page.mouse.move((first.x + first.width + second.x) / 2, first.y + first.height / 2);
  await page.waitForTimeout(110);
  await page.evaluate(() => { window.__hover.phase = "transfer"; });
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2);
  await page.waitForTimeout(650);
  await page.screenshot({ path: out.replace(".json", ".png") });
  await page.evaluate(() => { window.__hover.phase = "leave"; });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(800);
  const report = await page.evaluate(() => { cancelAnimationFrame(window.__hover.frame); return window.__hover; });
  const entry = report.samples.filter(s => s.phase === "entry" && s.opacity[2] > 0);
  const gap = report.samples.filter(s => s.phase === "gap" || s.phase === "transfer");
  const minimumGapOpacity = Math.min(...gap.map(s => s.opacity[2]));
  const riseDuration = entry.find(s => s.opacity[2] >= .179)?.time - report.entered;
  const end = report.samples.at(-1);
  const observed = { minimumGapOpacity, riseDuration, firstFrameMax: Math.max(0, ...report.feedback.map(f => f.first)), secondFrameMax: Math.max(0, ...report.feedback.map(f => f.second)), longTaskMax: report.longTasksSupported ? Math.max(0, ...report.tasks.map(t => t.duration)) : null };
  const result = { summary: { ok: minimumGapOpacity >= .17 && riseDuration >= 250 && end.opacity.every(v => v === 0) && !errors.length, observed }, report, errors };
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result.summary));
} finally { await browser.close(); }
