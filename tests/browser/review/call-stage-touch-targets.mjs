import fs from "node:fs";
import path from "node:path";
import { mountFixture } from "../../../scripts/lib/component-fixture.mjs";

export async function check({ browser, assert }) {
  const out = process.env.CALL_STAGE_TOUCH_OUT ?? "test-results/call-stage-touch";
  fs.mkdirSync(out, { recursive: true });
  const context = await browser.newContext({ hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  const page = await context.newPage(), results = [], errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    assert.equal(await page.evaluate(() => matchMedia("(pointer:coarse)").matches), true);
    for (const theme of ["dark", "light"]) for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await mountFixture(page, "collab-call-stage", "pro", `createRoot(document.getElementById('root')).render(<Subject.default theme="${theme}"/>);`);
      await page.getByRole("button", { name: "Speaker view", exact: true }).tap();
      await page.waitForFunction(() => document.querySelector('[data-demo="call-speaker"]').getAttribute("aria-pressed") === "true");
      await page.getByRole("button", { name: "Grid view", exact: true }).tap();
      await page.waitForFunction(() => document.querySelector('[data-demo="call-grid"]').getAttribute("aria-pressed") === "true");
      await page.waitForTimeout(250);
      const targets = await page.getByRole("button").evaluateAll(nodes => nodes.filter(node => !node.disabled && node.getClientRects().length).map(node => {
        const box = node.getBoundingClientRect();
        return { name: node.getAttribute("aria-label") ?? node.textContent.trim(), width: box.width, height: box.height };
      }));
      const heading = await page.locator('header h2').evaluate(node => ({ width: node.clientWidth, contentWidth: node.scrollWidth, text: node.textContent }));
      assert.ok(heading.contentWidth <= heading.width, "The default meeting title remains readable beside or above touch actions");
      results.push({ theme, width, targets, heading });
      await page.screenshot({ path: path.join(out, `${theme}-${width}.png`) });
    }
    fs.writeFileSync(path.join(out, "proof.json"), JSON.stringify({ results, errors }, null, 2) + "\n");
    assert.deepEqual(results.flatMap(row => row.targets.filter(target => target.width < 43.5 || target.height < 43.5).map(target => ({ theme: row.theme, viewport: row.width, ...target }))), [], "Every enabled mobile call action has a 44px target");
    assert.deepEqual(errors, []);
    console.log("PASS call stage 44px touch actions, native grid/speaker taps and both themes");
  } finally { await context.close(); }
}
