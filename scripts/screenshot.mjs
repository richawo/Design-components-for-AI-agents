#!/usr/bin/env node
// Renders gallery thumbnails into public/previews/<slug>.webp.
//   node scripts/screenshot.mjs [slug...] [--base=http://localhost:3000]
// Web components: 1440×900 viewport, top of the page, resized to 1280×800.
// Mobile components: the phone frame at 390×844, framed on black at 1280×800.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("--base=")) ?? "--base=http://localhost:3000").slice(7);
const only = args.filter((a) => !a.startsWith("--"));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const index = JSON.parse(fs.readFileSync(path.join(root, "registry/__generated__/index.json"), "utf8"));
const out = path.join(root, "public", "previews");
fs.mkdirSync(out, { recursive: true });

const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const targets = index.filter((e) => e.hasSource && (!only.length || only.includes(e.slug)));

for (const e of targets) {
  const mobile = e.platform === "mobile";
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: "no-preference" });
  try {
    await page.goto(`${base}/preview/${e.slug}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(2800);
    const png = await page.screenshot({ type: "png" });
    let img;
    if (mobile) {
      const phone = await sharp(png).resize({ height: 700 }).toBuffer();
      const meta = await sharp(phone).metadata();
      const rounded = Buffer.from(`<svg width="${meta.width}" height="${meta.height}"><rect width="${meta.width}" height="${meta.height}" rx="44" ry="44"/></svg>`);
      const masked = await sharp(phone).composite([{ input: rounded, blend: "dest-in" }]).png().toBuffer();
      img = sharp({ create: { width: 1280, height: 800, channels: 4, background: "#050505" } }).composite([{ input: masked, gravity: "center" }]);
    } else {
      // Trim a uniform stage (e.g. a component centred on black) so small
      // components fill the card; full-bleed sections are unaffected.
      const trimmed = await sharp(png).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
      const { width: tw, height: th } = trimmed.info;
      if (tw < 1300 || th < 820) {
        const bgPx = await sharp(png).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer();
        const bg = { r: bgPx[0], g: bgPx[1], b: bgPx[2], alpha: 1 };
        const fitted = await sharp(trimmed.data).resize({ width: 1120, height: 680, fit: "inside", withoutEnlargement: false }).toBuffer();
        img = sharp({ create: { width: 1280, height: 800, channels: 4, background: bg } }).composite([{ input: fitted, gravity: "center" }]);
      } else {
        img = sharp(png).resize(1280, 800);
      }
    }
    await img.webp({ quality: 82 }).toFile(path.join(out, `${e.slug}.webp`));
    console.log(`✓ ${e.slug}`);
  } catch (err) {
    console.log(`✗ ${e.slug}: ${err.message}`);
  }
  await page.close();
}
await browser.close();
