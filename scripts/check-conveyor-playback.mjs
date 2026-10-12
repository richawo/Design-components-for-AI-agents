#!/usr/bin/env node
// Temporal browser regression for the moving showcase. No pointer engagement.
import fs from "node:fs";
import { launchChromium } from "./lib/browser.mjs";
const option = (key, fallback) => process.argv.find(a => a.startsWith(`--${key}=`))?.split("=").slice(1).join("=") ?? fallback;
const browser = await launchChromium({ args: [] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  if (process.argv.includes("--block-video")) await page.route("**/*.mp4", route => route.abort());
  await page.goto(option("base", "http://localhost:3123"), { waitUntil: "load" });
  await page.waitForTimeout(3500);
  const observed = await page.evaluate(async () => {
    const frames = [], tasks = [], videoFrames = new Map();
    const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => e.duration)));
    observer.observe({ type: "longtask", buffered: false });
    const videos = [...document.querySelectorAll("[data-conveyor-row] video")];
    const visible = v => { const r = v.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; };
    const active = videos.filter(v => visible(v) && !v.paused && v.readyState >= 2);
    for (const v of active) videoFrames.set(v, {total:v.getVideoPlaybackQuality().totalVideoFrames,dropped:v.getVideoPlaybackQuality().droppedVideoFrames});
    const track = document.querySelector("[data-conveyor-track]");
    const before = track?.getBoundingClientRect().x;
    await new Promise(resolve => { const start = performance.now(); const tick = now => { frames.push(now); if (now - start < 4000) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); });
    observer.disconnect();
    const gaps = frames.slice(1).map((t, i) => t - frames[i]).sort((a, b) => a - b);
    return {
      activeWithoutHover: active.length,
      loaded: videos.filter(v => v.currentSrc).length,
      conveyorDistance: Math.abs((track?.getBoundingClientRect().x ?? before) - before),
      rafP95GapMs: gaps[Math.floor(gaps.length * .95)] ?? 0,
      rafMaxGapMs: gaps.at(-1) ?? 0,
      longTaskMaxMs: Math.max(0, ...tasks),
      clips: active.map(v => ({ name: v.closest("a")?.getAttribute("aria-label"), framesAdvanced: v.getVideoPlaybackQuality().totalVideoFrames - videoFrames.get(v).total, droppedFrames: v.getVideoPlaybackQuality().droppedVideoFrames - videoFrames.get(v).dropped })),
    };
  });
  const poster = option("expect", "autoplay") === "poster";
  let controlsPass = true;
  if (!poster) {
    await page.getByRole("button",{name:"Pause conveyor",exact:true}).click();
    await page.waitForTimeout(250);
    const paused = await page.locator("[data-conveyor-row] video").count() === 0;
    await page.getByRole("button",{name:"Resume conveyor",exact:true}).click();
    await page.waitForTimeout(700);
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.waitForTimeout(250);
    const reduced = await page.locator("[data-conveyor-row] video").evaluateAll(videos => videos.every(v=>v.paused && !v.currentSrc));
    await page.emulateMedia({reducedMotion:"no-preference"});
    await page.waitForTimeout(1200);
    const restored = await page.locator("[data-conveyor-row] video").evaluateAll(videos => videos.filter(v=>!v.paused&&v.readyState>=2).length);
    observed.controls = {paused,reduced,restored};
    controlsPass = paused && reduced && restored >= 4;
  }
  const ok = controlsPass && observed.conveyorDistance > 20 && (poster ? observed.activeWithoutHover === 0 : observed.activeWithoutHover >= 4 && observed.activeWithoutHover <= 12 && observed.clips.every(c => c.framesAdvanced > 20));
  const result = { summary: { ok, observed } };
  const destination = option("out", "");
  if (destination) fs.writeFileSync(destination, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exitCode = ok ? 0 : 1;
} finally { await browser.close(); }
