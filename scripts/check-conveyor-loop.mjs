#!/usr/bin/env node
// Accelerate only animation timestamps to exercise complete track boundaries.
import fs from "node:fs";
import { launchChromium } from "./lib/browser.mjs";
const arg = (key, dflt) =>
  process.argv
    .find((a) => a.startsWith(`--${key}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? dflt;
const browser = await launchChromium({ args: [] });
try {
  const page = await browser.newPage({
    viewport: { width: Number(arg("width", "5000")), height: 1000 },
  });
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      request((now) => callback(now * 24));
  });
  await page.goto(arg("base", "http://127.0.0.1:3189"), { waitUntil: "load" });
  await page.waitForTimeout(3500);
  const row = page.locator('[data-conveyor-row="0"]');
  const box = await row.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await page.mouse.wheel(25000, 0);
  await page.waitForTimeout(250);
  await page.mouse.move(0, 0);
  const observed = await page.evaluate(async () => {
    const rows = [...document.querySelectorAll("[data-conveyor-row]")],
      maxGap = rows.map(() => 0),
      maxScroll = rows.map(() => 0),
      wraps = rows.map(() => 0),
      previous = rows.map(() => null);
    let samples = 0;
    await new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        samples++;
        rows.forEach((row, index) => {
          const root = row.getBoundingClientRect(),
            track = row.querySelector("[data-conveyor-track]"),
            bounds = track.getBoundingClientRect();
          maxGap[index] = Math.max(
            maxGap[index],
            root.right - bounds.right,
            bounds.left - root.left,
          );
          maxScroll[index] = Math.max(
            maxScroll[index],
            Math.abs(row.scrollLeft),
          );
          if (
            previous[index] !== null &&
            Math.abs(bounds.x - previous[index]) > 100
          )
            wraps[index]++;
          previous[index] = bounds.x;
        });
        if (performance.now() - start < 45000) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return {
      samples,
      maxGap,
      maxScroll,
      wraps,
      sets: rows.map(
        (row) => row.querySelector("[data-conveyor-track]").children.length,
      ),
    };
  });
  const broken = arg("expect", "loop") === "broken";
  const valid =
    observed.maxGap.every((gap) => gap <= 24) &&
    observed.maxScroll.every((left) => left === 0) &&
    observed.wraps.every((n) => n >= 1);
  const report = { summary: { ok: broken ? !valid : valid, observed } };
  const out = arg("out", "");
  if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  process.exitCode = report.summary.ok ? 0 : 1;
} finally {
  await browser.close();
}
