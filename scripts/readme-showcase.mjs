#!/usr/bin/env node
// Rebuild the GitHub README artwork from the public component recordings.
// Requires npm install, ffmpeg and a Chromium supported by scripts/lib/browser.mjs.
// No Pro source, credentials, network requests or running app are needed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { launchChromium } from "./lib/browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, ".github", "assets");
const previews = path.join(root, "public", "previews");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "design-readme-"));
const url = (file) => pathToFileURL(file).href;
const font = (pkg, file) => url(path.join(root, "node_modules", pkg, "files", file));
const sans = font("@fontsource-variable/geist", "geist-latin-wght-normal.woff2");
const serif = font("@fontsource/instrument-serif", "instrument-serif-latin-400-italic.woff2");
const mono = font("@fontsource-variable/geist-mono", "geist-mono-latin-wght-normal.woff2");
const mark = `<svg viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" fill="#ff7a45"/><rect x="6.5" y="6.5" width="6.5" height="6.5" rx="1.6" fill="#000"/><circle cx="18.25" cy="9.75" r="3.25" fill="#000"/><path d="M6.5 15h6.5v6.5A6.5 6.5 0 0 1 6.5 15Z" fill="#000"/><rect x="15" y="15" width="6.5" height="6.5" rx="3.25" fill="#000" opacity=".35"/></svg>`;
const fonts = `@font-face{font-family:Geist;src:url('${sans}');font-weight:100 900}@font-face{font-family:Instrument;src:url('${serif}');font-style:italic}@font-face{font-family:Mono;src:url('${mono}');font-weight:100 900}`;
const selections = [
  ["hero-terminal-agent", "AI agent hero", "Free"],
  ["three-globe-arcs", "WebGL globe", "Pro"],
  ["chart-portfolio", "Portfolio chart", "Free"],
  ["bento-grid", "Live analytics bento", "Pro"],
  ["mobile-tab-bar", "React Native navigation", "Free"],
  ["three-particle-sphere", "Particle sphere", "Pro"],
];
fs.mkdirSync(assets, { recursive: true });

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
}

function gif(input, output, { frames = false, width = 600, colors = 96, fps = 12, dither = "bayer:bayer_scale=3" } = {}) {
  const args = frames ? ["-framerate", "12", "-i", input] : ["-i", input];
  ffmpeg([...args, "-t", "6", "-filter_complex",
    `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=${dither}:diff_mode=rectangle`,
    "-loop", "0", output]);
}

const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const panel = (slug, className, label, tier) => `<div class="panel ${className}"><video src="${url(path.join(previews, `${slug}.mp4`))}" preload="auto" muted playsinline></video><div class="label"><span>${label}</span><span>${tier}</span></div></div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
    *{box-sizing:border-box}html,body{margin:0;width:1600px;height:900px;background:#070707;color:#f4f4f2;font-family:Geist,sans-serif}
    .canvas{position:relative;width:1600px;height:900px;overflow:hidden;background:radial-gradient(ellipse at 88% 2%,#202020 0,transparent 46%),#070707;border:1px solid #292929;border-radius:24px}
    .brand{position:absolute;left:52px;top:39px;display:flex;gap:13px;align-items:center;font-size:24px;font-weight:570;letter-spacing:-.8px}.brand svg{width:35px;height:35px}
    .edition{position:absolute;right:52px;top:49px;font:13px Mono;color:#858585;letter-spacing:2px}
    .headline{position:absolute;top:106px;left:52px;margin:0;font-size:79px;line-height:1.02;font-weight:520;letter-spacing:-4px}.headline em{font-family:Instrument,serif;font-weight:400;font-size:96px;letter-spacing:-1px;color:#d9d7d2}
    .sub{position:absolute;right:52px;top:134px;width:300px;font-size:21px;line-height:1.5;color:#a0a0a0;letter-spacing:-.5px}
    .line{position:absolute;left:52px;right:52px;top:242px;height:1px;background:#292929}
    .panel{position:absolute;overflow:hidden;border:1px solid #292929;border-radius:15px;background:#050505}.panel video{display:block;width:100%;height:calc(100% - 38px);object-fit:contain}.label{height:38px;border-top:1px solid #232323;display:flex;justify-content:space-between;align-items:center;padding:0 16px;font:11px Mono;letter-spacing:.4px;color:#c0c0c0}.label span:last-child{color:#777}
    .hero{left:52px;top:269px;width:664px;height:526px}
    .chart{left:734px;top:269px;width:498px;height:320px}
    .sphere{left:734px;top:607px;width:498px;height:188px}.sphere video{object-fit:cover;object-position:50% 28%}
    .mobile{left:1250px;top:269px;width:298px;height:526px}.mobile video{object-fit:cover}
    .footer{position:absolute;left:52px;right:52px;bottom:38px;display:flex;justify-content:space-between;font:12px Mono;letter-spacing:1px;color:#888}.footer strong{font-weight:400;color:#d5d5d5}
  </style></head><body><div class="canvas"><div class="brand">${mark}Design for AI</div><div class="edition">THE COMPONENT COLLECTION</div><h1 class="headline">Interfaces with <em>a point of view.</em></h1><p class="sub">Code. Brief. JSON prompt.<br>Built for your agent.</p><div class="line"></div>
  ${panel("hero-terminal-agent", "hero", "01 / AI agent hero", "Free")}
  ${panel("chart-portfolio", "chart", "02 / Portfolio chart", "Free")}
  ${panel("three-particle-sphere", "sphere", "03 / Particle sphere", "Pro")}
  ${panel("mobile-tab-bar", "mobile", "04 / React Native", "Free")}
  <div class="footer"><span>REACT · TAILWIND CSS · REACT NATIVE</span><strong>design.yaps.ai ↗</strong></div></div></body></html>`;
  const source = path.join(scratch, "hero.html");
  fs.writeFileSync(source, html);
  await page.goto(url(source), { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll("video")].map((video) => video.readyState >= 2
      ? Promise.resolve() : new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = reject; })));
  });
  async function frame(t) {
    await page.evaluate(async (time) => {
      await Promise.all([...document.querySelectorAll("video")].map((video) => {
        video.pause();
        const next = Math.min(time, video.duration - 0.05);
        if (Math.abs(video.currentTime - next) < 0.001) return;
        return new Promise((resolve) => { video.addEventListener("seeked", resolve, { once: true }); video.currentTime = next; });
      }));
    }, t);
    return page.screenshot({ type: "png" });
  }
  const still = await frame(0.6);
  await sharp(still).png().toFile(path.join(assets, "showcase-still.png"));
  await sharp(still).resize(1280, 640, { fit: "contain", background: "#070707" }).png().toFile(path.join(assets, "social-preview.png"));
  for (let i = 0; i < 72; i++) {
    fs.writeFileSync(path.join(scratch, `hero-${String(i).padStart(3, "0")}.png`), await frame(i / 12));
  }
  gif(path.join(scratch, "hero-%03d.png"), path.join(assets, "showcase.gif"), { frames: true, width: 960, colors: 96 });

  for (const theme of ["dark", "light"]) {
    await page.setViewportSize({ width: 620, height: 104 });
    await page.setContent(`<html><head><style>${fonts}html,body{margin:0;background:transparent}body{display:flex;align-items:center;justify-content:center;gap:19px;width:620px;height:104px;color:${theme === "dark" ? "#f4f4f2" : "#191919"};font:570 56px Geist;letter-spacing:-2px}svg{width:67px;height:67px}</style></head><body>${mark}<span>Design for AI</span></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(assets, `wordmark-${theme}.png`), omitBackground: true });
  }
  await page.close();

  for (const [slug] of selections) {
    const input = path.join(previews, `${slug}.mp4`);
    if (!fs.existsSync(input)) throw new Error(`Missing public recording: ${slug}`);
    gif(input, path.join(assets, `${slug}.gif`), slug.startsWith("three-")
      ? { width: 540, colors: 64, fps: 10, dither: "none" } : {});
    await sharp(path.join(previews, `${slug}.webp`)).resize(960).png().toFile(path.join(assets, `${slug}.png`));
  }
  for (const file of fs.readdirSync(assets).filter((file) => /\.(gif|png)$/.test(file))) {
    const bytes = fs.statSync(path.join(assets, file)).size;
    console.log(`${file}: ${(bytes / 1024).toFixed(0)} KB`);
  }
} finally {
  await browser.close();
  fs.rmSync(scratch, { recursive: true, force: true });
}
