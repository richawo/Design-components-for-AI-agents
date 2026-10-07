#!/usr/bin/env node
// Screenshot site pages:  node scripts/shot-page.mjs /pricing / --widths=1440,390 --out=dir [--full]
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const flag = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=").slice(1).join("=");
const pages = args.filter((a) => !a.startsWith("--"));
const widths = flag("widths", "1440,390").split(",").map(Number);
const out = path.resolve(flag("out", "test-results/pages"));
const base = flag("base", "http://localhost:3100");
const full = args.includes("--full");
fs.mkdirSync(out, { recursive: true });
const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const p of pages) {
  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(base + p, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(1200);
    const name = (p === "/" ? "home" : p.replace(/^\//, "").replace(/\//g, "_")) + `-${w}.png`;
    await page.screenshot({ path: path.join(out, name), fullPage: full });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(path.join(out, name), overflow > 1 ? `⚠ overflow ${overflow}px` : "", errs.length ? `errors: ${errs.join(" | ")}` : "");
    await page.close();
  }
}
await browser.close();
