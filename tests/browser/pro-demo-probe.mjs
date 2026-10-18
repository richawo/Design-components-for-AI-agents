import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const slugs = ["data-query-builder", "commerce-catalog-import", "commerce-variant-stock", "finance-reconciliation", "hr-capacity-planner", "legal-version-history", "app-permission-matrix", "commerce-return-desk"];
const selected = new Set(process.argv.slice(2));
try {
  for (const slug of slugs.filter(slug => !selected.size || selected.has(slug))) {
    const meta = JSON.parse(fs.readFileSync(`registry/pro/${slug}/meta.json`, "utf8"));
    await mountFixture(page, slug, "pro", `
      import { DemoPlayer } from './lib/demo/player';
      import { parseSteps } from './lib/demo/schema.mjs';
      createRoot(document.getElementById('root')).render(<Subject.default/>);
      window.play=steps=>new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},new AbortController().signal).play(parseSteps(steps));
    `);
    await page.evaluate(steps => window.play(steps), meta.demo.steps);
    const text = await page.locator("body").innerText();
    if (slug === "data-query-builder") {
      assert.equal(await page.getByRole("textbox", { name: "Value for condition 2" }).inputValue(), "20");
      assert.match(text, /Segment applied/);
    } else if (slug === "commerce-catalog-import") assert.match(text, /records imported/);
    else if (slug === "commerce-variant-stock") {
      assert.equal(await page.getByRole("spinbutton", { name: "Ink / XL stock", exact: true }).inputValue(), "5");
      assert.match(text, /Stock saved · 1 cell updated/);
    } else if (slug === "finance-reconciliation") {
      await page.getByText("Every statement line is matched", { exact: true }).waitFor();
      assert.match(await page.locator('[data-demo="statement-s6"]').getAttribute("aria-label"), /^Matched statement/);
      assert.match(await page.locator('[data-demo="ledger-l6"]').getAttribute("aria-label"), /^Matched ledger/);
      assert.match(await page.locator('[data-demo="ledger-l7"]').getAttribute("aria-label"), /^Matched ledger/);
      assert.equal(await page.getByRole("button", { name: "Mark reconciled", exact: true }).isEnabled(), true);
    } else if (slug === "hr-capacity-planner") {
      assert.match(await page.locator('[data-demo="capacity-mara-tue"]').innerText(), /8/);
      assert.equal(await page.getByRole("button", { name: "Save plan", exact: true }).isDisabled(), true);
    } else if (slug === "legal-version-history") {
      assert.equal(await page.locator('[data-demo^="revision-"]').count(), 4);
      assert.match(text, /Restoration completed/);
    } else if (slug === "app-permission-matrix") assert.match(text, /Access policy saved/);
    else if (slug === "commerce-return-desk") assert.match(text, /RET-2038/);
    console.log(`PASS live demo replay: ${slug}`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
