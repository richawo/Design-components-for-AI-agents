#!/usr/bin/env node
// Record a component preview being used, for reviewing interactions.
//
//   node scripts/rec.mjs <slug> [--steps="..."] [--width=1440] [--height=900]
//        [--base=http://localhost:3100] [--out=dir] [--fps=12] [--every=200]
//        [--focus=<selector>] [--cols=3] [--from=ms]
//
// --from starts the contact sheet that many ms into the recording, so a long
// set-up doesn't use up the frames.
//
// --focus crops the GIF and contact sheet to that element (plus a margin), so
// small hover and press states are big enough to judge.
//
// Writes <out>/<slug>.webm, <slug>.gif and <slug>-frames.png (a contact sheet
// sampled every --every ms, for reviewing frame by frame).
//
// Steps are separated by ";":
//   wait:600            pause
//   move:0.5,0.4        glide the pointer to a fraction of the viewport
//   hover:<selector>    glide to the centre of an element (Playwright selector)
//   click[:<selector>]  click an element, or wherever the pointer is
//   down / up           press / release the mouse
//   drag:0.3,0.5        hold, glide to a point, release
//   tab:3               press Tab three times, 450ms apart
//   key:Enter           press a key
//   type:hello          type text
//   scroll:600          scroll the page by pixels
//
// Without --steps it waits, tabs through the first five focusable elements,
// then sweeps the pointer across the page.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};
const slug = args.find((a) => !a.startsWith("--"));
if (!slug) {
  console.error("usage: node scripts/rec.mjs <slug> [--steps=...]");
  process.exit(1);
}
const width = Number(flag("width", "1440"));
const height = Number(flag("height", "900"));
const base = flag("base", process.env.PREVIEW_BASE || "http://localhost:3100");
const out = path.resolve(flag("out", "test-results/rec"));
const fps = Number(flag("fps", "12"));
const every = Number(flag("every", "200"));
const focus = flag("focus", "");
const cols = Number(flag("cols", "3"));
const from = Number(flag("from", "0")) / 1000;
const steps = flag("steps", "wait:1200;tab:5;wait:400;move:0.2,0.35;move:0.5,0.5;move:0.8,0.4;move:0.6,0.7;wait:600");

function executablePath() {
  const root = "/opt/pw-browsers";
  if (!fs.existsSync(root)) return undefined;
  for (const d of fs.readdirSync(root)) {
    for (const rel of ["chrome-linux/chrome", "chrome-linux64/chrome"]) {
      const p = path.join(root, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(out, ".video-"));
const browser = await chromium.launch({ executablePath: executablePath(), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: tmp, size: { width, height } } });

// Headless Chromium draws no cursor, so add one that follows the mouse and
// shrinks while pressed.
await context.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.style.cssText =
      "position:fixed;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:0 0 0 1.5px rgba(0,0,0,.6);pointer-events:none;z-index:2147483647;transition:transform 90ms;mix-blend-mode:difference";
    document.body.appendChild(c);
    addEventListener("pointermove", (e) => (c.style.translate = `${e.clientX}px ${e.clientY}px`), true);
    addEventListener("pointerdown", () => (c.style.transform = "scale(.7)"), true);
    addEventListener("pointerup", () => (c.style.transform = ""), true);
  });
});

const t0 = Date.now();
const page = await context.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`${base}/preview/${slug}`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(400);
// Trim the blank load from the start of the recording.
const trim = (Date.now() - t0) / 1000;
let crop = null;
if (focus) {
  const box = await page.locator(focus).first().boundingBox();
  if (box) {
    const m = 24;
    const x = Math.max(0, Math.floor(box.x - m));
    const y = Math.max(0, Math.floor(box.y - m));
    crop = { x, y, w: Math.min(width - x, Math.ceil(box.width + m * 2)) & ~1, h: Math.min(height - y, Math.ceil(box.height + m * 2)) & ~1 };
  } else console.warn(`  focus ${focus} not found; recording the full viewport`);
}

let px = width / 2;
let py = height / 2;
const glide = async (x, y, ms = 700) => {
  const n = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.mouse.move(px + (x - px) * e, py + (y - py) * e);
    await page.waitForTimeout(16);
  }
  px = x;
  py = y;
};

for (const raw of steps.split(";").map((s) => s.trim()).filter(Boolean)) {
  const [cmd, ...rest] = raw.split(":");
  const arg = rest.join(":");
  if (cmd === "wait") await page.waitForTimeout(Number(arg));
  else if (cmd === "move") {
    const [fx, fy] = arg.split(",").map(Number);
    await glide(fx * width, fy * height);
  } else if (cmd === "hover" || (cmd === "click" && arg)) {
    const box = await page.locator(arg).first().boundingBox();
    if (!box) {
      console.warn(`  no element for ${arg}`);
      continue;
    }
    await glide(box.x + box.width / 2, box.y + box.height / 2);
    if (cmd === "click") {
      await page.mouse.down();
      await page.waitForTimeout(110);
      await page.mouse.up();
    }
  } else if (cmd === "click") {
    await page.mouse.down();
    await page.waitForTimeout(110);
    await page.mouse.up();
  } else if (cmd === "down") await page.mouse.down();
  else if (cmd === "up") await page.mouse.up();
  else if (cmd === "drag") {
    const [fx, fy] = arg.split(",").map(Number);
    await page.mouse.down();
    await glide(fx * width, fy * height, 600);
    await page.mouse.up();
  } else if (cmd === "tab") {
    for (let i = 0; i < Number(arg || 1); i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(450);
    }
  } else if (cmd === "key") {
    await page.keyboard.press(arg);
    await page.waitForTimeout(250);
  } else if (cmd === "type") await page.keyboard.type(arg, { delay: 70 });
  else if (cmd === "scroll") {
    await page.mouse.wheel(0, Number(arg));
    await page.waitForTimeout(500);
  } else console.warn(`  unknown step ${raw}`);
}
await page.waitForTimeout(300);
const video = page.video();
await context.close();
await browser.close();

const webm = path.join(out, `${slug}.webm`);
fs.renameSync(await video.path(), webm);
fs.rmSync(tmp, { recursive: true, force: true });

const gif = path.join(out, `${slug}.gif`);
const sheet = path.join(out, `${slug}-frames.png`);
const cropF = crop ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},` : "";
const srcW = crop ? crop.w : width;
const scale = Math.min(crop ? 960 : 720, srcW);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", trim.toFixed(2), "-i", webm, "-vf", `${cropF}fps=${fps},scale=${scale}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, gif]);
// Contact sheet: one frame every `every` ms, `cols` across.
const dur = -from + (Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", webm]).toString().trim()) || 4) - trim;
const frames = Math.min(64, Math.max(1, Math.ceil((dur * 1000) / every)));
const rows = Math.ceil(frames / cols);
const cell = Math.round(Math.min(srcW, 1500 / cols));
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", (trim + from).toFixed(2), "-i", webm, "-vf", `${cropF}fps=${1000 / every},scale=${cell}:-1,tile=${cols}x${rows}:padding=4:color=0x333333`, "-frames:v", "1", sheet]);

console.log(`${webm}\n${gif}\n${sheet}${errs.length ? `\n  errors: ${errs.slice(0, 3).join(" | ")}` : ""}`);
