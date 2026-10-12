import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const b = await launchChromium();
const p = await b.newPage({ viewport: { width: 1440, height: 1400 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
try {
  for (const slug of ["agent-plan-steps", "multiselect-chips"]) {
    const meta = JSON.parse(fs.readFileSync(`registry/pro/${slug}/meta.json`));
    await mountFixture(
      p,
      slug,
      "pro",
      `import{DemoPlayer}from'./lib/demo/player';import{parseSteps}from'./lib/demo/schema.mjs';createRoot(document.getElementById('root')).render(<Subject.default/>);window.play=steps=>new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},new AbortController().signal).play(parseSteps(steps));`,
    );
    await p.evaluate((steps) => window.play(steps), meta.demo.steps);
    if (slug === "agent-plan-steps") {
      const order = await p
        .locator('[data-demo^="step-"]')
        .evaluateAll((es) => es.map((e) => e.dataset.demo));
      assert.ok(
        order.indexOf("step-backfill") < order.indexOf("step-schema"),
        "A held-pointer replay moves Backfill ahead of Schema",
      );
      assert.match(
        await p.locator("[data-demo=step-dedupe]").innerText(),
        /in staging/,
      );
    } else {
      for (const id of ["arn1", "cdg1", "sfo1"])
        assert.equal(
          await p
            .locator(`[data-demo=option-${id}]`)
            .getAttribute("aria-selected"),
          "true",
          id + " remains selected",
        );
      assert.equal(
        await p.evaluate(() =>
          document.activeElement.getAttribute("data-demo"),
        ),
        "input",
        "A cancelled mousedown must preserve combobox focus",
      );
    }
    assert.deepEqual(errors, []);
    console.log("PASS native replay semantics " + slug);
  }
} finally {
  await b.close();
}
