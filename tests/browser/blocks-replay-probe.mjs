import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const specs = [
  ["block-saas-dashboard", "Trial signups per day"],
  ["block-workspace-settings", "Preferences saved."],
  ["block-financial-report", "September 2026"],
  ["block-fashion-workspace", "Line plan"],
  ["block-people-workspace", "A considered first week"],
  ["block-legal-workspace", "Obligations and evidence"],
  ["block-commerce-workspace", "RET-ORD-1042 · Return request recorded"],
  ["block-saas-landing", "Your Solo workspace."],
];
const requested = new Set(process.argv.slice(2));
for (const slug of requested) assert.ok(specs.some(([name]) => name === slug), `Unknown block replay: ${slug}`);
// Match the native rendering used by the component metadata motion replays.
const browser = await launchChromium({ args: [] });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1500 },
  reducedMotion: "no-preference",
});
const errors = [];
let activeSlug = "setup";
page.on("pageerror", (error) => errors.push(error.message));
try {
  for (const [slug, final] of specs) {
    if (requested.size && !requested.has(slug)) continue;
    activeSlug = slug;
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
    if (slug === "block-commerce-workspace") {
      await page.evaluate(() => {
        const trace = { phases: [], choices: [] };
        window.commerceReplay = trace;
        const sample = () => {
          const active = [...document.querySelectorAll('[data-demo="return-next"]')]
            .find((node) => !node.closest('[inert], [aria-hidden="true"], [hidden]'));
          const heading = active?.closest("section")?.querySelector("h3")?.textContent;
          const phase = heading === "Recorded items" ? "recorded"
            : heading === "Review selected items" ? "review"
              : heading === "Choose the items to return" ? "editing" : "overview";
          if (trace.phases.at(-1) !== phase) trace.phases.push(phase);
        };
        sample();
        new MutationObserver(sample).observe(document.getElementById("root"), {
          subtree: true, childList: true, attributes: true, characterData: true,
        });
        document.addEventListener("change", (event) => {
          const node = event.target;
          if (["return-item-0", "return-reason-0"].includes(node.dataset?.demo)) {
            trace.choices.push({ target: node.dataset.demo, checked: node.checked });
          }
        });
      });
    }
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
    if (slug === "block-commerce-workspace") {
      assert.deepEqual(await page.evaluate(() => window.commerceReplay), {
        phases: ["overview", "editing", "review", "recorded"],
        choices: [
          { target: "return-item-0", checked: true },
          { target: "return-reason-0", checked: true },
        ],
      }, "Commerce replay selects a real item and reason, reviews, then records");
      const pane = page.getByRole("tabpanel", { name: "Returns", exact: true });
      const desk = pane.getByRole("region", { name: "Return request", exact: true });
      assert.equal(await desk.getByRole("button", { name: "Recorded", exact: true }).isDisabled(), true);
      assert.equal(await desk.getByText("Merino crew", { exact: true }).isVisible(), true);
      assert.equal(await desk.getByText("The fit was not right", { exact: true }).isVisible(), true);
      assert.equal(await desk.getByText("1 unit selected", { exact: true }).isVisible(), true);
      assert.equal(await desk.getByRole("checkbox").count(), 0);
      assert.equal(await desk.getByRole("radio").count(), 0);
      assert.match(await desk.innerText(), /£125\.00/);
      assert.equal(await desk.getByText(final, { exact: true }).isVisible(), true);
    }
    assert.deepEqual(errors, []);
    console.log("PASS metadata replay " + slug);
  }
} catch (error) {
  const out = `test-results/block-replay-failures/${activeSlug}-${Date.now()}`;
  fs.mkdirSync(out, { recursive: true });
  await Promise.allSettled([
    page.screenshot({ path: out + "/failure.png", fullPage: true }),
    page.locator("body").innerText().then((text) => fs.writeFileSync(out + "/body.txt", text)),
  ]);
  fs.writeFileSync(out + "/error.txt", String(error.stack ?? error));
  throw error;
} finally {
  await browser.close();
}
