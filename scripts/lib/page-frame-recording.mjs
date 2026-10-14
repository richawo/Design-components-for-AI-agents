import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { concatFrameList } from "./recording-quality.mjs";

const captures = new WeakMap();

/** Request real images from this exact page surface, bypassing video sampling. */
export async function startPageFrameRecording(page, { width, height, quality = 75 }) {
  const session = await page.context().newCDPSession(page);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dfa-owned-screenshots-"));
  try {
    await page.evaluate(() => {
      const root = document.getElementById("root");
      if (!root) throw new Error("Missing actual fixture root");
      const sourceFrames = [], sourceChanges = [], longTasks = [];
      let raf;
      const tick = () => { sourceFrames.push(Date.now() / 1000); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
      const change = () => sourceChanges.push(Date.now() / 1000);
      const mutation = new MutationObserver(change);
      mutation.observe(root, { subtree: true, attributes: true, childList: true, characterData: true });
      root.addEventListener("input", change, true);
      root.addEventListener("scroll", change, true);
      const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration }))));
      observer.observe({ entryTypes: ["longtask"] });
      window.__dfaScreenshotEvidence = { sourceFrames, sourceChanges, longTasks, stop: () => {
        cancelAnimationFrame(raf); mutation.disconnect(); observer.disconnect();
        root.removeEventListener("input", change, true); root.removeEventListener("scroll", change, true);
      } };
    });
  } catch (error) {
    await session.detach().catch(() => {});
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  let running = true, openingResolve, openingReject;
  const opening = new Promise((resolve, reject) => { openingResolve = resolve; openingReject = reject; });
  const frames = [], startTime = Date.now() / 1000;
  const reading = (async () => {
    while (running) {
      const began = Date.now();
      const { data } = await session.send("Page.captureScreenshot", { format: "jpeg", quality, fromSurface: true, captureBeyondViewport: false });
      const t = Date.now() / 1000, bytes = Buffer.from(data, "base64");
      if (!frames.length) {
        const measured = await sharp(bytes).metadata();
        if (measured.width !== width || measured.height !== height) throw new Error("Owned-page screenshot changed exact pixel dimensions.");
      }
      const file = path.join(directory, `frame-${String(frames.length).padStart(5, "0")}.jpg`);
      fs.writeFileSync(file, bytes);
      frames.push({ t, file });
      if (frames.length === 1) openingResolve();
      const remaining = 1000 / 60 - (Date.now() - began);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
    }
  })();
  reading.catch(error => openingReject(error));
  captures.set(page, { reading, frames, directory, session, stop: () => { running = false; } });
  let timer;
  try {
    await Promise.race([opening, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("No actual opening image before demo actions.")), 1500); })]);
  } catch (error) {
    await discardPageFrameRecording(page);
    throw error;
  } finally { clearTimeout(timer); }
  return { settings: { width, height, quality, source: "owned-page-cdp-screenshot" }, startTime };
}

/** Preserve actual delivery times; CFR export only holds the captured images. */
export async function stopPageFrameRecording(page, directory, start) {
  const capture = captures.get(page);
  capture.stop();
  await capture.reading;
  const evidence = await page.evaluate(() => {
    const capture = window.__dfaScreenshotEvidence;
    capture.stop();
    return { sourceFrames: capture.sourceFrames, sourceChanges: capture.sourceChanges, longTasks: capture.longTasks };
  });
  await capture.session.detach();
  const files = path.join(capture.directory, "frames.txt");
  fs.writeFileSync(files, concatFrameList(capture.frames, start.startTime, capture.frames.at(-1).t));
  const file = path.join(directory, "native.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", files, "-vf", "fps=60,format=yuv420p", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-an", "-movflags", "+faststart", file]);
  fs.rmSync(capture.directory, { recursive: true });
  captures.delete(page);
  const frames = capture.frames.map(({ t }) => ({ t }));
  return { file, extension: "mp4", frames, evidence: { settings: start.settings, startTime: start.startTime, ...evidence, captureRequests: frames.map(frame => frame.t) } };
}

/** Release a partial capture after a missing target, page error or pixel mismatch. */
export async function discardPageFrameRecording(page) {
  const capture = captures.get(page);
  if (!capture) return;
  capture.stop();
  await capture.session.detach().catch(() => {});
  await capture.reading.catch(() => {});
  await page.evaluate(() => window.__dfaScreenshotEvidence?.stop()).catch(() => {});
  fs.rmSync(capture.directory, { recursive: true, force: true });
  captures.delete(page);
}
