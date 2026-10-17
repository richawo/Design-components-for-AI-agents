import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
// Replay the same metadata that drives the component page and recorded preview.
// A separate copy of the steps drifts when a transition needs settling time.
const specs = fs
  .readdirSync(new URL("./pro-50/", import.meta.url))
  .filter((file) => file.endsWith(".mjs"))
  .map((file) => ({ slug: file.slice(0, -4) }));
const finalStates = {
  "commerce-fulfilment-desk":
    "A recovery action has been recorded for this shipment.",
  "fashion-exchange-selector": "Exchange confirmed",
  "finance-close-checklist": "Signed off",
  "finance-receivables-aging":
    "Reminder sent",
  "hr-leave-approval": "No additional manager note.",
  "hr-policy-acknowledgement":
    "Your acknowledgement of this revision is recorded.",
  "legal-matter-intake": "Check again",
  "legal-signature-request": "Jordan Blake signed.",
};
for (const slug of Object.keys(finalStates)) {
  if (!specs.some(spec => spec.slug === slug)) specs.push({slug});
}
const selected = new Set(process.argv.slice(2));
for (const slug of selected) assert.ok(specs.some(spec => spec.slug === slug), `Unknown demo case: ${slug}`);
const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1400 },
  reducedMotion: "no-preference",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  for (const { slug } of specs.filter(
    (s) =>
      fs.existsSync("registry/pro/" + s.slug) &&
      (!selected.size || selected.has(s.slug)),
  )) {
    const meta = JSON.parse(
      fs.readFileSync("registry/pro/" + slug + "/meta.json"),
    );
    const steps = meta.demo.steps;
    await mountFixture(
      page,
      slug,
      "pro",
      `import {DemoPlayer} from './lib/demo/player';import {parseSteps} from './lib/demo/schema.mjs';createRoot(document.getElementById('root')).render(<Subject.default/>);window.play=steps=>new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},new AbortController().signal).play(parseSteps(steps));`,
    );
    await page.locator("#root").evaluate((el) => {
      el.style.maxWidth = "none";
      el.style.padding = "0";
    });
    await page.setViewportSize({ width: 1440, height: meta.previewHeight });
    await page.waitForTimeout(200);
    const before = await page.locator("#root").innerText();
    await page.evaluate((steps) => window.play(steps), steps);
    await page.waitForTimeout(100);
    const last = steps
      .filter((s) => s.startsWith("click:@"))
      .at(-1)
      ?.slice(7);
    const target = page.locator('[data-demo="' + last + '"]');
    const notice = await page.getByRole("status").allTextContents();
    if (notice.some((s) => s.trim() && !s.startsWith("Connect "))) {
      assert.doesNotMatch(notice.join(" "), /failed|Connect the host/);
    } else if (
      (await target.count()) &&
      (await target.getAttribute("aria-pressed")) !== null
    ) {
      assert.equal(await target.getAttribute("aria-pressed"), "true");
    } else {
      assert.notEqual(
        await page.locator("#root").innerText(),
        before,
        slug + " replay must change the displayed workflow",
      );
    }
    if (finalStates[slug]) {
      await page.waitForFunction(
        () =>
          document
            .getAnimations()
            .every(
              (animation) =>
                animation.playState !== "running" ||
                animation.effect?.getTiming().iterations === Infinity,
            ),
        null,
        { timeout: 5000 },
      );
      assert.ok(
        (await page.locator("#root").innerText()).includes(
          finalStates[slug],
        ),
        `${slug} reaches its intended final state`,
      );
    }
    assert.deepEqual(errors, [], slug);
    console.log("PASS live replay " + slug);
  }
} finally {
  await browser.close();
}
