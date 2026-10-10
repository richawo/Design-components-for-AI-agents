#!/usr/bin/env node
// Records each component's demo script (meta.demo) into the gallery card's
// hover video: public/previews/<slug>.mp4 (H.264, yuv420p, 1280×800, muted,
// faststart). Framed exactly like the WebP poster from scripts/screenshot.mjs,
// so the video fades in over the poster without a jump.
//
//   node scripts/record-demos.mjs [slug...] [--base=http://localhost:3100]
//        [--out=public/previews] [--webm] [--sheet=dir] [--max-kb=400]
//
// With no slugs it records every component that has a demo. Drives the
// preview with real input (so CSS :hover shows) and draws the same branded
// cursor as the live player. Writes a poster from the first frame only when
// the component has no WebP yet.
//
// Exits non-zero if a target is missing, the page throws or logs an error,
// or the video can't get under --max-kb. Safe to run concurrently: each run
// works in its own temp dir and replaces <slug>.mp4 atomically.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { launchChromium } from "./lib/browser.mjs";
import { CURSOR_CSS, CURSOR_HTML, CURSOR_START } from "../lib/demo/cursor.mjs";
import { TIMING, demoDuration, parseSteps, targetSelector } from "../lib/demo/schema.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};
const base = flag("base", process.env.PREVIEW_BASE || "http://localhost:3100");
const out = path.resolve(root, flag("out", "public/previews"));
const sheetDir = flag("sheet", "");
const webm = args.includes("--webm");
const maxBytes = Number(flag("max-kb", "400")) * 1024;
const only = args.filter((a) => !a.startsWith("--"));

const OUT_W = 1280;
const OUT_H = 800;
const FPS = 30;

// Read metas from source (not the generated index) so a component being
// built right now can be recorded before anyone rebuilds the registry.
function readMeta(slug) {
  for (const tier of ["free", "pro"]) {
    const p = path.join(root, "registry", tier, slug, "meta.json");
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  return null;
}
function allSlugsWithDemo() {
  const slugs = [];
  for (const tier of ["free", "pro"]) {
    const dir = path.join(root, "registry", tier);
    if (!fs.existsSync(dir)) continue;
    for (const d of fs.readdirSync(dir)) {
      const m = fs.existsSync(path.join(dir, d, "meta.json")) ? JSON.parse(fs.readFileSync(path.join(dir, d, "meta.json"), "utf8")) : null;
      if (m?.demo && m.status !== "draft") slugs.push(d);
    }
  }
  return slugs.sort();
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Same framing rules as scripts/screenshot.mjs, expressed as a crop of the viewport. */
async function framing(png, vw, vh) {
  const t = await sharp(png).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
  const { width: tw, height: th, trimOffsetLeft = 0, trimOffsetTop = 0 } = t.info;
  const bgPx = await sharp(png).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer();
  const bg = `0x${[...bgPx.subarray(0, 3)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  if (tw < 1300 || th < 820) {
    // The poster fits the trimmed box into 1120×680, centred on 1280×800, so
    // the video shows the region of the viewport that lands on the same pixels.
    const s = Math.min(1120 / tw, 680 / th);
    return { cw: OUT_W / s, ch: OUT_H / s, cx: -trimOffsetLeft + tw / 2 - OUT_W / s / 2, cy: -trimOffsetTop + th / 2 - OUT_H / s / 2, bg };
  }
  return { cw: vw, ch: vh, cx: 0, cy: 0, bg };
}

/** Mobile posters are the phone at 700px tall with 44px corners on #050505; this is the mask that frames the video the same way. */
async function phoneMask(file, vw, vh) {
  const h = 700;
  const w = Math.round((vw / vh) * h);
  const x = Math.round((OUT_W - w) / 2);
  const y = Math.round((OUT_H - h) / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}"><defs><mask id="m"><rect width="100%" height="100%" fill="#fff"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="44" fill="#000"/></mask></defs><rect width="100%" height="100%" fill="#050505" mask="url(#m)"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
  return { w, h };
}

async function record(browser, slug) {
  const meta = readMeta(slug);
  if (!meta?.demo) throw new Error("no demo in meta.json");
  const steps = parseSteps(meta.demo.steps);
  const mobile = meta.platform === "mobile";
  const strip = meta.category === "headers" || meta.category === "footers";
  const vw = mobile ? 390 : strip ? 1024 : 1440;
  const vh = mobile ? 844 : strip ? 640 : 900;
  const dpr = mobile ? 2 : 1;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `dfa-rec-${slug}-`));
  const problems = [];

  const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, reducedMotion: "no-preference" });
  const page = await context.newPage();
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`console error: ${m.text()}`));
  try {
    await page.goto(`${base}/preview/${slug}`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(meta.category === "three-d" || meta.dependencies?.includes("three") ? 6000 : 3200);

    // The branded cursor, following the real mouse.
    await page.addStyleTag({ content: CURSOR_CSS });
    await page.evaluate(
      ({ html, start }) => {
        const c = document.createElement("div");
        c.className = "dfa-cursor";
        c.innerHTML = html;
        c.setAttribute("aria-hidden", "true");
        document.body.appendChild(c);
        const ring = c.firstElementChild;
        const place = (x, y) => (c.style.transform = `translate3d(${x}px, ${y}px, 0)`);
        place(innerWidth * start[0], innerHeight * start[1]);
        addEventListener("pointermove", (e) => place(e.clientX, e.clientY), true);
        addEventListener("pointerdown", () => {
          c.dataset.down = "1";
          ring.dataset.pulse = "0";
          void ring.offsetWidth;
          ring.dataset.pulse = "1";
        }, true);
        addEventListener("pointerup", () => (c.dataset.down = "0"), true);
        window.__dfaCursor = c;
      },
      { html: CURSOR_HTML, start: CURSOR_START },
    );
    let px = vw * CURSOR_START[0];
    let py = vh * CURSOR_START[1];
    await page.mouse.move(px, py);

    // Poster framing from the frame we're about to start on.
    const first = await page.screenshot({ type: "png" });
    const frame = mobile ? null : await framing(first, vw, vh);

    // Frames: Chrome's screencast, with timestamps, at full quality.
    const cdp = await context.newCDPSession(page);
    const frames = [];
    cdp.on("Page.screencastFrame", async (f) => {
      const file = path.join(tmp, `f${String(frames.length).padStart(5, "0")}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, "base64"));
      frames.push({ file, t: f.metadata.timestamp });
      await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1, maxWidth: vw * dpr, maxHeight: vh * dpr });
    const t0 = Date.now() / 1000;
    await page.evaluate(() => (window.__dfaCursor.dataset.on = "1"));
    await page.waitForTimeout(150);

    // Paced by the clock, not by step count, so a glide takes exactly as long
    // as it does in the live player however slow each mouse.move is.
    const glide = async (x, y, ms) => {
      const x0 = px;
      const y0 = py;
      const start = Date.now();
      for (;;) {
        const t = Math.min(1, (Date.now() - start) / ms);
        const e = ease(t);
        await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
        if (t >= 1) break;
        await page.waitForTimeout(12);
      }
      px = x;
      py = y;
    };
    // One round trip per target, so a busy page doesn't stretch the recording.
    const pointOf = async (t) => {
      const r = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        let b = el.getBoundingClientRect();
        if (b.bottom < 0 || b.top > innerHeight) {
          el.scrollIntoView({ block: "center" });
          b = el.getBoundingClientRect();
        }
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      }, targetSelector(t.name));
      if (!r) {
        problems.push(`demo target @${t.name} not found when its step ran`);
        return null;
      }
      const [fx, fy] = t.at ?? [0.5, 0.5];
      return [r.x + r.w * fx, r.y + r.h * fy];
    };

    for (const s of steps) {
      if (s.cmd === "wait") await page.waitForTimeout(s.ms);
      else if (s.cmd === "move") await glide(s.point[0] * vw, s.point[1] * vh, TIMING.glide);
      else if (s.cmd === "hover" || (s.cmd === "click" && s.target)) {
        const p = await pointOf(s.target);
        if (p) await glide(p[0], p[1], TIMING.glide);
        if (s.cmd === "click") {
          await page.mouse.down();
          await page.waitForTimeout(TIMING.press);
          await page.mouse.up();
        }
      } else if (s.cmd === "click") {
        await page.mouse.down();
        await page.waitForTimeout(TIMING.press);
        await page.mouse.up();
      } else if (s.cmd === "down") await page.mouse.down();
      else if (s.cmd === "up") await page.mouse.up();
      else if (s.cmd === "drag") {
        await page.mouse.down();
        await glide(s.point[0] * vw, s.point[1] * vh, TIMING.drag);
        await page.mouse.up();
      } else if (s.cmd === "tab") {
        for (let i = 0; i < s.n; i++) {
          await page.keyboard.press("Tab");
          await page.waitForTimeout(TIMING.tabGap);
        }
      } else if (s.cmd === "key") {
        await page.keyboard.press(s.key);
        await page.waitForTimeout(TIMING.keyGap);
      } else if (s.cmd === "type") await page.keyboard.type(s.text, { delay: TIMING.typeGap });
      else if (s.cmd === "scroll") {
        await page.mouse.wheel(0, s.px);
        await page.waitForTimeout(TIMING.scrollSettle);
      }
    }
    // A short tail so the last state lands before the loop restarts.
    await page.evaluate(() => (window.__dfaCursor.dataset.on = "0"));
    await page.waitForTimeout(350);
    const t1 = Date.now() / 1000;
    await cdp.send("Page.stopScreencast");
    await page.waitForTimeout(100);

    if (!frames.length) throw new Error("screencast produced no frames");
    // Each frame holds until the next one; the last holds to the end.
    frames.sort((a, b) => a.t - b.t);
    const list = frames
      .map((f, i) => {
        const next = i + 1 < frames.length ? frames[i + 1].t : Math.max(t1, f.t + 1 / FPS);
        const start = i === 0 ? Math.min(f.t, t0) : f.t;
        return `file '${f.file}'\nduration ${Math.max(1 / 240, next - start).toFixed(4)}`;
      })
      .join("\n");
    fs.writeFileSync(path.join(tmp, "frames.txt"), `${list}\nfile '${frames.at(-1).file}'\n`);

    const P = 2000;
    let inputs = ["-f", "concat", "-safe", "0", "-i", path.join(tmp, "frames.txt")];
    let graph;
    if (mobile) {
      const mask = path.join(tmp, "mask.png");
      const { h } = await phoneMask(mask, vw, vh);
      inputs = [...inputs, "-i", mask];
      graph = `[0:v]scale=-2:${h}:flags=lanczos,pad=${OUT_W}:${OUT_H}:(ow-iw)/2:(oh-ih)/2:color=0x050505[v];[v][1:v]overlay=0:0,fps=${FPS},format=yuv420p`;
    } else {
      graph = `[0:v]pad=${vw + 2 * P}:${vh + 2 * P}:${P}:${P}:color=${frame.bg},crop=${Math.round(frame.cw)}:${Math.round(frame.ch)}:${Math.round(frame.cx + P)}:${Math.round(frame.cy + P)},scale=${OUT_W}:${OUT_H}:flags=lanczos,fps=${FPS},format=yuv420p`;
    }
    const mp4Tmp = path.join(tmp, `${slug}.mp4`);
    let crf = 24;
    for (;;) {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", graph, "-an", "-c:v", "libx264", "-preset", "slow", "-tune", "animation", "-crf", String(crf), "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4Tmp]);
      if (fs.statSync(mp4Tmp).size <= maxBytes || crf >= 36) break;
      crf += 2;
    }
    const size = fs.statSync(mp4Tmp).size;
    if (size > maxBytes) problems.push(`video is ${Math.round(size / 1024)} KB even at crf ${crf}; shorten the demo or reduce motion`);
    const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4Tmp]).toString().trim());
    if (dur < 2.5 || dur > 9.5) problems.push(`video runs ${dur.toFixed(1)}s; demos should be 3–8s (script estimate ${(demoDuration(steps) / 1000).toFixed(1)}s)`);

    fs.mkdirSync(out, { recursive: true });
    const finalMp4 = path.join(out, `${slug}.mp4`);
    fs.copyFileSync(mp4Tmp, `${finalMp4}.${process.pid}.tmp`);
    fs.renameSync(`${finalMp4}.${process.pid}.tmp`, finalMp4);
    const written = [`${finalMp4}  ${Math.round(size / 1024)} KB · ${dur.toFixed(1)}s · crf ${crf}`];

    if (webm) {
      const w = path.join(tmp, `${slug}.webm`);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4Tmp, "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", w]);
      // Only worth shipping if it's actually smaller.
      if (fs.statSync(w).size < size * 0.9) {
        const f = path.join(out, `${slug}.webm`);
        fs.copyFileSync(w, `${f}.${process.pid}.tmp`);
        fs.renameSync(`${f}.${process.pid}.tmp`, f);
        written.push(`${f}  ${Math.round(fs.statSync(f).size / 1024)} KB`);
      }
    }

    const poster = path.join(out, `${slug}.webp`);
    if (!fs.existsSync(poster)) {
      const png = path.join(tmp, "poster.png");
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4Tmp, "-frames:v", "1", png]);
      await sharp(png).webp({ quality: 82 }).toFile(poster);
      written.push(`${poster}  (poster from the first frame)`);
    }

    if (sheetDir) {
      const dir = path.resolve(root, sheetDir);
      fs.mkdirSync(dir, { recursive: true });
      const sheet = path.join(dir, `${slug}-video-frames.png`);
      const every = Math.max(0.25, dur / 12);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4Tmp, "-vf", `fps=${1 / every},scale=480:-1,tile=4x3:padding=4:color=0x333333`, "-frames:v", "1", sheet]);
      written.push(sheet);
    }
    return { written, problems };
  } finally {
    await context.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const slugs = only.length ? only : allSlugsWithDemo();
if (!slugs.length) {
  console.log("No components with a demo.");
  process.exit(0);
}
const browser = await launchChromium();
let failed = 0;
for (const slug of slugs) {
  try {
    const { written, problems } = await record(browser, slug);
    console.log(`${problems.length ? "✗" : "✓"} ${slug}\n  ${written.join("\n  ")}`);
    for (const p of problems) console.log(`  ⚠ ${p}`);
    if (problems.length) failed++;
  } catch (e) {
    failed++;
    console.log(`✗ ${slug}: ${e.message}`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
