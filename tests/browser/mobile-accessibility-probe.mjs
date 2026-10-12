import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
const browser = await launchChromium();
const page = await browser.newPage({
  reducedMotion: "reduce",
  viewport: { width: 390, height: 900 },
});
try {
  for (const [slug, tier, name] of [
    ["mobile-settings", "free", "Text size"],
    ["mobile-onboarding", "free", null],
    ["mobile-bottom-sheet", "pro", "Order sheet"],
    ["mobile-now-playing", "pro", "Volume"],
  ]) {
    if (!fs.existsSync(`registry/${tier}/${slug}`)) continue;
    await page.goto(
      (process.env.PREVIEW_BASE ?? "http://localhost:3120") +
        "/preview/" +
        slug,
      { waitUntil: "networkidle" },
    );
    await page.waitForTimeout(500);
    const slider = name
      ? page.getByRole("slider", { name, exact: true })
      : page.getByRole("slider").first();
    await slider.waitFor({ state: "visible" });
    await slider.press("Home");
    await page.waitForFunction(() => {
      const el = document.activeElement;
      return (
        el?.getAttribute("aria-valuenow") === el?.getAttribute("aria-valuemin")
      );
    });
    const before = Number(await slider.getAttribute("aria-valuenow"));
    assert.ok(Number.isFinite(before), slug);
    await slider.focus();
    await slider.press("ArrowRight");
    await page.waitForFunction(
      (before) =>
        Number(document.activeElement?.getAttribute("aria-valuenow")) > before,
      before,
    );
    assert.ok(
      Number(await slider.getAttribute("aria-valuenow")) > before,
      slug + " arrow increment",
    );
    await slider.press("Home");
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-valuenow") ===
        document.activeElement?.getAttribute("aria-valuemin"),
    );
    assert.equal(
      await slider.getAttribute("aria-valuenow"),
      await slider.getAttribute("aria-valuemin"),
      slug + " Home",
    );
    if (slug === "mobile-settings") {
      const switches = page.getByRole("switch", {
        name: "Daily reminder",
        exact: true,
      });
      assert.equal(await switches.count(), 1);
      const was = await switches.getAttribute("aria-checked");
      await switches.click();
      assert.notEqual(await switches.getAttribute("aria-checked"), was);
    }
    console.log("PASS keyboard and accessibility state " + slug);
  }
} finally {
  await browser.close();
}
