import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const specs = [
  ["block-saas-dashboard", "Trial signups per day"],
  ["block-workspace-settings", "Preferences saved."],
  ["block-financial-report", "September 2026 exported."],
  ["block-fashion-workspace", "Line plan saved"],
  ["block-people-workspace", "A considered first week"],
  ["block-legal-workspace", "Completion evidence recorded for Deliver the quarterly service report."],
  ["block-commerce-workspace", "RET-ORD-1042 · Return request recorded"],
  ["block-saas-landing", "Your Solo workspace."],
  ["block-meetings-workspace", "Studio review"],
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
    if (slug === "block-fashion-workspace") {
      await page.evaluate(() => {
        window.fashionReplay = [];
        document.addEventListener("click", (event) => {
          const target = event.target.closest?.("[data-demo]");
          const name = target?.dataset.demo;
          if (["nav-planning", "add-outer", "save"].includes(name)) {
            window.fashionReplay.push(name);
          }
        }, true);
      });
    }
    if (slug === "block-financial-report") {
      await page.evaluate(() => {
        window.financialReplay = [];
        document.addEventListener("click", event => {
          const name = event.target.closest?.("[data-demo]")?.dataset.demo;
          if (["trigger", "report-detail", "export-report"].includes(name)) window.financialReplay.push(name);
        }, true);
      });
    }
    if (slug === "block-legal-workspace") {
      await page.evaluate(() => {
        window.legalReplay = [];
        document.addEventListener("click", event => {
          const name = event.target.closest?.("[data-demo]")?.dataset.demo;
          if (["nav-obligations", "evidence", "record"].includes(name)) window.legalReplay.push(name);
        }, true);
      });
    }
    if (slug === "block-meetings-workspace") {
      await page.evaluate(() => {
        window.meetingsReplay = [];
        document.addEventListener("click", event => {
          const name = event.target.closest?.("[data-demo]")?.dataset.demo;
          if (["join-meeting", "spotlight-mara", "call-hand"].includes(name)) window.meetingsReplay.push(name);
        }, true);
      });
    }
    await page.evaluate((steps) => window.play(steps), meta.demo.steps);
    assert.ok(
      (await page.locator("#root").innerText()).includes(final),
      slug + " intended end",
    );
    if (slug === "block-meetings-workspace") {
      assert.deepEqual(await page.evaluate(() => window.meetingsReplay), ["join-meeting", "spotlight-mara", "call-hand"]);
      const pane = page.getByRole("tabpanel", { name: "Meeting room", exact: true });
      assert.equal(await page.getByRole("tab", { name: "Meeting room", exact: true }).getAttribute("aria-selected"), "true");
      assert.equal(await pane.getByRole("heading", { name: "Studio review", exact: true }).isVisible(), true);
      assert.equal(await pane.getByRole("button", { name: "Speaker view", exact: true }).getAttribute("aria-pressed"), "true");
      assert.equal(await pane.getByRole("button", { name: "Remove spotlight from Mara Vale", exact: true }).getAttribute("aria-pressed"), "true");
      assert.equal(await page.getByRole("button", { name: "Lower hand", exact: true }).getAttribute("aria-pressed"), "true");
    }
    if (slug === "block-legal-workspace") {
      assert.deepEqual(await page.evaluate(() => window.legalReplay), ["nav-obligations", "evidence", "record"]);
      const pane = page.getByRole("tabpanel", { name: "Obligations", exact: true });
      assert.equal(await pane.getByText("Q3 report filed as DOC-404.", { exact: true }).isVisible(), true);
      assert.equal(await pane.getByRole("article").getByText("Done", { exact: true }).isVisible(), true);
      assert.equal(await page.getByRole("tab", { name: "Obligations", exact: true }).getAttribute("aria-selected"), "true");
      assert.equal(await pane.getByRole("button", { name: "Record completion", exact: true }).count(), 0);
      assert.equal(await pane.getByRole("status").filter({ hasText: final }).isVisible(), true);
    }
    if (slug === "block-financial-report") {
      assert.doesNotMatch(await page.locator("#root").innerText(), /today|all on target/);
      assert.deepEqual(await page.evaluate(() => window.financialReplay), ["trigger", "report-detail", "export-report"]);
      assert.equal(await page.getByRole("status").filter({ hasText: "September 2026 exported." }).isVisible(), true);
      const row = page.getByRole("grid").getByRole("row").filter({ has: page.getByText("Software and infrastructure", { exact: true }) });
      assert.equal(await row.getByRole("gridcell").nth(2).locator('span[aria-hidden="true"]').innerText(), "£8,700.00");
    }
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
    if (slug === "block-fashion-workspace") {
      assert.deepEqual(await page.evaluate(() => window.fashionReplay), [
        "nav-planning", "add-outer", "save",
      ], "Fashion replay adds a real style before saving its collection plan");
      const pane = page.getByRole("tabpanel", { name: "Line plan", exact: true });
      const receipt = pane.getByRole("status").filter({ hasText: "Line plan saved" });
      assert.equal(await receipt.isVisible(), true);
      assert.match(await receipt.innerText(), /15 options.*530 units.*£17,760\.00/s);
      assert.equal(await page.getByRole("tab", { name: "Line plan", exact: true }).getAttribute("aria-selected"), "true");
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
