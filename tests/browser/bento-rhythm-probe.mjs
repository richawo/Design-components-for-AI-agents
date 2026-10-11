import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";

const browser = await launchChromium();
const errors = [];
try {
  for (const [theme, reducedMotion, ambient] of [
    ["dark", "no-preference", true],
    ["light", "no-preference", true],
    ["dark", "reduce", true],
    ["dark", "no-preference", false],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 760, height: 800 },
      reducedMotion,
    });
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await mountFixture(
        page,
        "bento-grid",
        "pro",
        `createRoot(document.getElementById('root')).render(<Subject.BentoGrid theme=${JSON.stringify(theme)} ambient={${ambient}}><Subject.HeatmapTile label="03 / Rhythm" title="Know when they show up" body="A week of sessions, hour by hour." peakLabel="Peak · Tue 10:00" /></Subject.BentoGrid>);`,
      );
      const heatmap = page.getByRole("img", {
        name: /Weekly sessions by weekday and hour/,
      });
      await page.waitForTimeout(2400);
      assert.equal(await heatmap.locator(".aspect-square").count(), 168);
      const snapshot = () =>
        heatmap.locator(".aspect-square").evaluateAll((cells) =>
          cells.map((cell) => {
            const style = getComputedStyle(cell);
            return [
              style.backgroundColor,
              style.opacity,
              style.transform,
              style.scale,
              style.animationName,
            ];
          }),
        );
      const before = await snapshot();
      assert.ok(
        before.every((cell) => cell[1] === "1" && cell[4] === "none"),
        "all cells settle visibly without looping animations",
      );
      const peak = heatmap.locator(".aspect-square").nth(34);
      assert.equal(
        await peak.evaluate((cell) => cell.classList.contains("ring-inset")),
        true,
      );
      await heatmap.evaluate((element) => {
        window.rhythmChanges = 0;
        window.rhythmObserver = new MutationObserver(
          (records) => (window.rhythmChanges += records.length),
        );
        window.rhythmObserver.observe(element, {
          attributes: true,
          childList: true,
          subtree: true,
        });
      });
      await page.waitForTimeout(2300);
      assert.deepEqual(
        await snapshot(),
        before,
        "weekly data keeps the same intensities and peak",
      );
      const changes = await page.evaluate(() => {
        window.rhythmObserver.disconnect();
        return window.rhythmChanges;
      });
      assert.equal(
        changes,
        0,
        "ambient playback never brightens or remounts historical cells",
      );
    } finally {
      await page.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "Rhythm stays stable after entrance in both themes, reduced motion and ambient-off mode; all 168 cells and the Tuesday peak remain intact.",
  );
} finally {
  await browser.close();
}
