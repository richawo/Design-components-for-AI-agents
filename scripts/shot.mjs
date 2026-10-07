#!/usr/bin/env node
// Screenshot component previews for visual review.
//
//   node scripts/shot.mjs <slug...> [--widths=1440,768,390] [--out=dir] [--base=http://localhost:3100] [--wait=1200]
//
// Writes <out>/<slug>-<width>.png (full page). Mobile components are captured
// once at 390x844. Requires a running dev or prod server.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};
const slugs = args.filter((a) => !a.startsWith("--"));
const widths = flag("widths", "1440,768,390").split(",").map(Number);
const out = path.resolve(flag("out", "test-results/shots"));
const base = flag("base", process.env.PREVIEW_BASE || "http://localhost:3100");
const wait = Number(flag("wait", "1500"));
const index = JSON.parse(fs.readFileSync(new URL("../registry/__generated__/index.json", import.meta.url), "utf8"));

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
const browser = await chromium.launch({ executablePath: executablePath(), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const slug of slugs) {
  const entry = index.find((e) => e.slug === slug);
  const ws = entry?.platform === "mobile" ? [390] : widths;
  for (const w of ws) {
    const page = await browser.newPage({ viewport: { width: w, height: entry?.platform === "mobile" ? 844 : 900 }, deviceScaleFactor: 1 });
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
    await page.goto(`${base}/preview/${slug}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(wait);
    const file = path.join(out, `${slug}-${w}.png`);
    await page.screenshot({ path: file, fullPage: entry?.platform !== "mobile" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`${file}${overflow > 1 ? `  ⚠ horizontal overflow ${overflow}px` : ""}${errs.length ? `\n  errors: ${errs.slice(0, 5).join(" | ")}` : ""}`);
    await page.close();
  }
}
await browser.close();
