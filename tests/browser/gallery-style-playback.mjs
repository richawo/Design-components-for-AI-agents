// A styled gallery must play its actual demo, without mounting live components.
// TEST_BASE=<local Worker> TEST_STYLE_LICENSE=<existing fixture> node tests/browser/gallery-style-playback.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.TEST_BASE || "http://127.0.0.1:4189";
const license = process.env.TEST_STYLE_LICENSE;
if (!license) throw new Error("Set TEST_STYLE_LICENSE to an existing Pro key scoped to TEST_BASE.");
const out = process.env.TEST_OUT || "test-results/crayon-motion/gallery";
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium({ args: [] });
const report = {};
async function context(options = {}, paid = true) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference", ...options });
  if (paid) await ctx.addCookies([{ name: "dfa_license", value: license, url: base, httpOnly: true, sameSite: "Lax", secure: new URL(base).protocol === "https:" }]);
  return ctx;
}
async function choose(page, name) {
  await page.getByRole("button", { name: "Choose component style", exact: true }).click();
  await page.getByRole("region", { name: "Component styles", exact: true }).getByRole("button", { name: new RegExp(`^${name}`) }).click();
}
async function waitForStyle(page, styled) {
  await page.waitForFunction(styled => {
    const images = [...document.querySelectorAll(".component-card img")];
    return images.length > 0 && images.every(img => img.src.includes("/style-previews/crayon/") === styled);
  }, styled);
}
async function movingCard(page, prefix) {
  const clip = page.locator(".component-card video").first();
  await clip.scrollIntoViewIfNeeded();
  await page.locator(".component-card").first().hover();
  await page.waitForFunction(prefix => {
    const video = document.querySelector(".component-card video");
    return video && !video.paused && video.readyState >= 2 && video.currentSrc.includes(prefix);
  }, prefix);
  // Timestamp progress alone can pass for an encoded still. Sample decoded pixels too.
  const frames = await clip.evaluate(async video => {
    const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 80;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const samples = []; let first;
    for (let i = 0; i < 12; i++) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      first ??= pixels;
      let changedPixels = 0, absolute = 0;
      for (let p = 0; p < pixels.length; p += 4) {
        let peak = 0;
        for (let channel = 0; channel < 3; channel++) {
          const delta = Math.abs(pixels[p + channel] - first[p + channel]);
          absolute += delta; peak = Math.max(peak, delta);
        }
        if (peak >= 16) changedPixels++;
      }
      samples.push({ time: video.currentTime, changedPixels, meanDelta: absolute / (canvas.width * canvas.height * 3) });
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    return { source: video.currentSrc, width: video.videoWidth, height: video.videoHeight, samples };
  });
  assert.ok(new Set(frames.samples.map(f => f.time)).size > 2, "video time did not advance");
  assert.ok(frames.samples.some(f => f.changedPixels >= 5 || f.meanDelta >= .25), "decoded preview has no movement above compression noise");
  return frames;
}
try {
  const ctx = await context(), page = await ctx.newPage(), requests = [], errors = [];
  page.on("request", req => requests.push({ url: req.url().replace(base, ""), type: req.resourceType() }));
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}/components`);
  await choose(page, "Crayon");
  await waitForStyle(page, true);
  report.crayon = await movingCard(page, "/style-previews/crayon/");
  assert.equal(await page.locator(".component-card img[srcset]").count(), 0, "Original responsive posters survived the style switch");
  assert.equal(await page.locator('.component-card source[src^="/previews/"]').count(), 0, "Original recording covered Crayon");
  const active = await page.locator(".component-card video").evaluateAll(videos => videos.filter(v => !v.paused).length);
  assert.ok(active > 0 && active <= 6, `unbounded decoder count: ${active}`);
  assert.ok(!requests.some(req => /^\/preview\/|^\/api\/styles\//.test(req.url)), "gallery initialized a live component or fetched licensed source");
  await page.screenshot({ path: `${out}/crayon-playing.png` });

  const oldCard = await page.locator(".component-card video").first().elementHandle();
  await page.mouse.move(8, 8);
  await page.evaluate(() => scrollBy(0, 1800));
  await page.waitForTimeout(2600);
  assert.equal(await oldCard.evaluate(video => video.querySelectorAll("source").length), 0, "offscreen recording kept its source");
  report.offscreenUnloaded = true;
  await page.locator(".component-card").first().scrollIntoViewIfNeeded();
  await choose(page, "Original");
  await waitForStyle(page, false);
  report.original = await movingCard(page, "/previews/");
  assert.equal(await page.locator('.component-card source[src^="/style-previews/"]').count(), 0, "styled recording survived Original selection");
  await choose(page, "Crayon"); await waitForStyle(page, true);
  const first = page.locator(".component-card").first(), destination = await first.getAttribute("href");
  await first.click();
  await page.waitForURL(url => url.pathname === destination);
  await page.frameLocator("#preview iframe").locator('[data-licensed-visual-style]').waitFor({ state: "attached", timeout: 30000 });
  assert.equal(new URL(page.url()).searchParams.get("visualStyle"), "crayon");
  await page.goBack(); await waitForStyle(page, true);
  report.navigationPreservedStyle = true;

  await page.goto(base);
  await page.mouse.move(8, 8);
  await page.locator('[data-conveyor-row="0"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll("[data-conveyor-row] video")].some(video => !video.paused && video.readyState >= 2 && video.videoWidth === 960 && video.currentSrc.includes("/style-previews/crayon/conveyor/")));
  report.conveyor = await page.locator("[data-conveyor-row] video").evaluateAll(videos => ({ active: videos.filter(v => !v.paused && v.readyState >= 2).length, decoderCost: videos.filter(v => !v.paused && v.readyState >= 2).reduce((sum, v) => sum + (v.videoWidth <= 960 ? .5 : 1), 0), loaded: videos.filter(v => v.currentSrc).map(v => ({ source: v.currentSrc, width: v.videoWidth })) }));
  assert.ok(report.conveyor.active > 0 && report.conveyor.active <= 12);
  assert.ok(report.conveyor.decoderCost <= 6);
  assert.ok(report.conveyor.loaded.every(v => v.source.includes("/style-previews/crayon/")));
  await page.getByRole("button", { name: "Pause conveyor", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll("[data-conveyor-row] video").length === 0);
  await page.getByRole("button", { name: "Resume conveyor", exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll("[data-conveyor-row] video")].some(video => !video.paused && video.readyState >= 2));
  report.conveyor.pauseResume = true;
  assert.deepEqual(errors, []);
  await ctx.close();

  for (const preference of ["reduced-motion", "save-data"]) {
    const ctx = await context(preference === "reduced-motion" ? { reducedMotion: "reduce" } : {});
    if (preference === "save-data") await ctx.addInitScript(() => {
      if (navigator.connection) Object.defineProperty(navigator.connection, "saveData", { configurable: true, get: () => true });
    });
    const page = await ctx.newPage(), mediaRequests = [];
    page.on("request", req => { if (req.resourceType() === "media") mediaRequests.push(req.url()); });
    await page.goto(`${base}/components`); await choose(page, "Crayon"); await waitForStyle(page, true);
    await page.locator(".component-card").first().scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
    assert.equal(await page.locator(".component-card source").count(), 0);
    assert.deepEqual(mediaRequests, [], `${preference} still downloaded recordings`);
    report[preference] = { posterOnly: true };
    await ctx.close();
  }
  const guest = await context({}, false), guestPage = await guest.newPage();
  await guestPage.goto(`${base}/components`); await choose(guestPage, "Crayon");
  await guestPage.getByText("Preview the look. Pro unlocks Crayon components, prompts and MCP access.", { exact: true }).waitFor();
  assert.equal(await guestPage.locator('.component-card img[src^="/style-previews/"]').count(), 0);
  report.guestStillLocked = true;
  await guest.close();
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log("Styled and Original recordings animate; offscreen unloading, navigation, preferences and guest access passed.");
} catch (error) {
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ ...report, error: error.message }, null, 2));
  throw error;
} finally { await browser.close(); }
