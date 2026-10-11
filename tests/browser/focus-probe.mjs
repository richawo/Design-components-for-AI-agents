import assert from "node:assert/strict";
const base = (process.env.PREVIEW_BASE || "http://localhost:3100").replace(
  /\/$/,
  "",
);
import { launchChromium } from "../../scripts/lib/browser.mjs";
const b = await launchChromium();
const p = await b.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
await p.goto(`${base}/preview/usage-meter-tokens`);
await p.waitForTimeout(900);
const slider = p.getByRole("slider");
await slider.focus();
const before = Number(await slider.getAttribute("aria-valuenow"));
await p.keyboard.press("ArrowRight");
assert.ok(Number(await slider.getAttribute("aria-valuenow")) > before);
assert.equal(
  await slider.locator('[aria-hidden="true"][tabindex="0"]').count(),
  0,
);
await p.goto(`${base}/preview/mobile-agent-approval`);
await p.waitForTimeout(900);
const later = p.getByRole("button", { name: /Decide later/ });
await later.click();
await p.waitForTimeout(650);
const review = p.getByRole("button", { name: /Review the question/ });
await review.focus();
assert.equal(await review.evaluate((e) => e === document.activeElement), true);
await review.click();
await p.waitForTimeout(650);
assert.equal(await p.locator('[aria-hidden="true"] [tabindex="0"]').count(), 0);
assert.ok(await p.getByRole("button", { name: /Decide later/ }).isEnabled());
console.log(
  "Slider keyboard operation and deferred receipt focus/reopen pass.",
);
await b.close();
