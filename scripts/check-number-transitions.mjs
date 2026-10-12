#!/usr/bin/env node
import fs from "node:fs";
import { launchChromium } from "./lib/browser.mjs";
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
const browser = await launchChromium({ args: [] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${arg("base", "http://localhost:3123")}/components`, { waitUntil: "load" });
  await page.waitForTimeout(2200);
  const read = () => page.locator("p.font-mono[aria-live='polite']").first().evaluate(el => Number((el.querySelector("[data-number-digits]")?.textContent ?? el.textContent).match(/\d+/)?.[0]));
  const sample = () => page.evaluate(async () => {
    const values = [], el = document.querySelector("p.font-mono[aria-live='polite']");
    await new Promise(resolve => { const start = performance.now(); const tick = now => { values.push(Number((el.querySelector("[data-number-digits]")?.textContent ?? el.textContent).match(/\d+/)?.[0])); if(now-start<850) requestAnimationFrame(tick);else resolve(); }; requestAnimationFrame(tick); });
    return [...new Set(values)];
  });
  const start = await read();
  const downRun = sample(); await page.getByRole("searchbox", { name: "Search components", exact: true }).fill("legal"); const down = await downRun;
  const end = await read();
  const upRun = sample(); await page.getByRole("searchbox", { name: "Search components", exact: true }).fill(""); const up = await upRun;
  const downMoves = down.some(n => n > end && n < start), upMoves = up.some(n => n > end && n < start);
  const monotonic = (values, direction) => values.slice(1).every((n,i) => direction * (n-values[i]) >= 0);
  const tween = arg("expect", "tween") === "tween";
  const ok = start > end && (tween ? downMoves && upMoves && monotonic(down, -1) && monotonic(up, 1) : !downMoves && !upMoves);
  const result = { summary: { ok, observed: { start, end, down, up, downMoves, upMoves } } };
  const output = arg("out", "");if(output)fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=ok?0:1;
} finally { await browser.close(); }
