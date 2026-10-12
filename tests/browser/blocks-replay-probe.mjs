import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const specs = [
  ["block-saas-dashboard", "Last 7 supplied days"],
  ["block-workspace-settings", "Preferences saved."],
  ["block-financial-report", "September 2026"],
  ["block-fashion-workspace", "Line plan"],
  ["block-people-workspace", "A considered first week"],
  ["block-legal-workspace", "Obligations and evidence"],
  ["block-commerce-workspace", "A considered return."],
  ["block-saas-landing", "Your Solo workspace."],
];
const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1500 },
  reducedMotion: "no-preference",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  for (const [slug, final] of specs) {
    const meta = JSON.parse(fs.readFileSync(`registry/pro/${slug}/meta.json`));
    await mountFixture(
      page,
      slug,
      "pro",
      `import {DemoPlayer} from './lib/demo/player';import {parseSteps} from './lib/demo/schema.mjs';createRoot(document.getElementById('root')).render(<Subject.default/>);window.play=steps=>new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},new AbortController().signal).play(parseSteps(steps));`,
    );
    await page.locator("#root").evaluate((node) => {
      node.style.maxWidth = "none";
      node.style.padding = "0";
    });
    await page.setViewportSize({ width: 1440, height: meta.previewHeight });
    await page.evaluate((steps) => window.play(steps), meta.demo.steps);
    assert.ok(
      (await page.locator("#root").innerText()).includes(final),
      slug + " intended end",
    );
    if (slug === "block-financial-report")
      assert.doesNotMatch(
        await page.locator("#root").innerText(),
        /today|all on target/,
      );
    assert.deepEqual(errors, []);
    console.log("PASS metadata replay " + slug);
  }
} finally {
  await browser.close();
}
