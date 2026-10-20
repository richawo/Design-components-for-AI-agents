import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
const browser = await launchChromium();
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      `${process.env.PREVIEW_BASE ?? "http://localhost:3100"}/preview/hero-terminal-agent`,
      { waitUntil: "networkidle" },
    );
    const log = page.getByRole("log", { name: "Example Relay session" });
    await log.focus();
    assert.equal(
      await log.evaluate((el) => el === document.activeElement),
      true,
    );
    await log.press("Home");
    await page.waitForFunction(
      () => document.querySelector('[role="log"]').scrollTop === 0,
    );
    await log.press("PageDown");
    assert.ok(
      (await log.evaluate((el) => el.scrollTop)) > 0,
      "PageDown scrolls the focused terminal",
    );
    await log.press("ArrowUp");
    await log.press("End");
    await page.waitForFunction(() => {
      const el = document.querySelector('[role="log"]');
      return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    });
    console.log(`PASS terminal keyboard scrolling at ${width}px`);
  }
} finally {
  await browser.close();
}
