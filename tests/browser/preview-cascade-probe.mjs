import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const slug = "hero-layout-playground";
if (fs.existsSync(`registry/pro/${slug}`)) {
  const browser = await launchChromium();
  const base = process.env.PREVIEW_BASE || "http://localhost:3100";
  try {
    for (const reducedMotion of ["reduce", "no-preference"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, reducedMotion });
      try {
        await page.goto(`${base}/preview/${slug}`, { waitUntil: "networkidle" });
        const heading = page.getByRole("heading", { level: 1 }).first();
        const serif = heading.locator(".font-serif").first();
        await serif.waitFor();
        assert.match(await serif.evaluate(el => getComputedStyle(el).fontFamily), /Instrument Serif/, "Registry serif tokens survive shell CSS ordering");
        assert.match(await heading.evaluate(el => getComputedStyle(el).fontFamily), /Geist/, "Registry display tokens use the current Geist role");
        assert.equal(await heading.evaluate(el => getComputedStyle(el).gridColumnEnd), "span 7", "Desktop container variants survive the shell cascade");
        const stack = page.locator('[data-demo="breakpoint-stack"]');
        await stack.click();
        await page.waitForFunction(() => document.querySelector('[data-demo="breakpoint-stack"]')?.getAttribute("aria-pressed") === "true");
        await page.setViewportSize({ width: 390, height: 900 });
        assert.equal(await heading.evaluate(el => getComputedStyle(el).gridColumnEnd), "auto", "Phone layout clears the desktop column span");
        assert.equal(await stack.isVisible(), true);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
  console.log("PASS preview fonts, container variants and controls in both motion modes");
} else console.log("SKIP preview cascade: private layout playground unavailable");
