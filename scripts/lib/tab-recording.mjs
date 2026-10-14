import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/** Record only the isolated, owned tab. Reject any scaling or other surface. */
export async function startTabRecording(page, { title, width, height }) {
  return page.evaluate(async ({ title, width, height }) => {
    document.title = title;
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 60, width: { ideal: width }, height: { ideal: height } },
      audio: false, preferCurrentTab: true, selfBrowserSurface: "include",
    });
    try {
      const track = stream.getVideoTracks()[0], settings = track.getSettings();
      if (settings.displaySurface !== "browser" || settings.width !== width || settings.height !== height)
        throw new Error(`Owned tab must deliver exact ${width}x${height} pixels; got ${settings.width}x${settings.height} ${settings.displaySurface}. Use a verified even scene.`);
      const mimeType = ["video/mp4;codecs=avc1.42001e", "video/webm;codecs=vp8"].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType || typeof MediaStreamTrackProcessor !== "function") throw new Error("This Chromium cannot record native tab frames.");
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 16000000 });
      const chunks = [], timings = [], sourceFrames = [], longTasks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const clone = track.clone(), reader = new MediaStreamTrackProcessor({ track: clone }).readable.getReader();
      let running = true, resolveOpening, raf;
      const opening = new Promise(resolve => { resolveOpening = resolve; });
      const reading = (async () => {
        while (running) {
          const { value, done } = await reader.read();
          if (done) break;
          timings.push({ timestamp: value.timestamp, time: Date.now() / 1000, width: value.displayWidth, height: value.displayHeight });
          value.close();
          if (timings.length === 1) resolveOpening();
        }
      })();
      const sample = () => { sourceFrames.push(Date.now() / 1000); raf = requestAnimationFrame(sample); };
      raf = requestAnimationFrame(sample);
      const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration }))));
      observer.observe({ entryTypes: ["longtask"] });
      const startTime = Date.now() / 1000;
      recorder.start();
      window.__dfaTabRecording = { stream, recorder, chunks, timings, sourceFrames, longTasks, clone, reader, reading,
        stop: () => { running = false; cancelAnimationFrame(raf); observer.disconnect(); } };
      let timer;
      try {
        await Promise.race([opening, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("No native opening frame before demo actions.")), 1500); })]);
      } finally { clearTimeout(timer); }
      return { settings, startTime, mimeType };
    } catch (error) {
      window.__dfaTabRecording?.stop();
      stream.getTracks().forEach(track => track.stop());
      throw error;
    }
  }, { title, width, height });
}

/** Probe the encoded file, since encoder cadence can differ from source frames. */
export async function stopTabRecording(page, directory, start) {
  const result = await page.evaluate(async () => {
    const capture = window.__dfaTabRecording;
    await new Promise((resolve, reject) => {
      capture.recorder.onstop = resolve;
      capture.recorder.onerror = event => reject(new Error(event.error?.message ?? "Native tab encoding failed."));
      capture.recorder.stop();
    });
    capture.stop();
    await capture.reader.cancel();
    await capture.reading;
    capture.clone.stop();
    capture.stream.getTracks().forEach(track => track.stop());
    const bytes = new Uint8Array(await new Blob(capture.chunks, { type: capture.recorder.mimeType }).arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    return { base64: btoa(binary), mimeType: capture.recorder.mimeType, timings: capture.timings, sourceFrames: capture.sourceFrames, longTasks: capture.longTasks };
  });
  const extension = result.mimeType.startsWith("video/mp4") ? "mp4" : "webm";
  const file = path.join(directory, `native.${extension}`);
  fs.writeFileSync(file, Buffer.from(result.base64, "base64"));
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_frames", "-show_streams", "-show_entries", "frame=best_effort_timestamp_time:stream=width,height", "-of", "json", file]).toString());
  const encoded = probe.streams[0];
  if (encoded.width !== start.settings.width || encoded.height !== start.settings.height) throw new Error("Native encoder changed the owned tab dimensions.");
  const frames = probe.frames.map(frame => ({ t: start.startTime + Number(frame.best_effort_timestamp_time) }));
  if (!frames.length) throw new Error("Native video encoder produced no frames.");
  return { file, extension, frames, evidence: { settings: start.settings, startTime: start.startTime,
    timings: result.timings, sourceFrames: result.sourceFrames, longTasks: result.longTasks } };
}
