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
  "input-number-stepper": "workers",
  "input-password-checklist": "3 of 3 requirements met",
  "input-tag-editor": "Design systems removed.",
  "input-color-swatches": "#C7785B",
  "three-material-inspector": "Uncoated C360 brass.",
  "three-exploded-assembly": "A compressible seal between tray and cover.",
  "editor-version-restore": "Restored 1 block",
  "editor-storyboard-strip": "Waxed cotton",
  "editor-layer-stack": "Shape · 3 of 6 from the top",
  "editor-keyframe-track": "Key 2 of 5",
  "editor-spacing-inspector": "align-items: center;",
  "editor-font-pairing": "Live on every page that uses the brand tokens.",
  "chart-waterfall-bridge": "Closing 164 $k",
  "data-query-builder": "Segment applied · 2 records",
  "hr-capacity-planner": "Capacity plan saved.",
  "legal-version-history": "Restoration completed",
  "app-permission-matrix": "Access policy saved · 2 changes",
  "commerce-catalog-import": "Import complete",
  "commerce-variant-stock": "Stock saved · 1 cell updated",
  "commerce-return-desk": "RET-2038",
  "commerce-promotion-builder": "AUTUMN20 rule saved",
  "commerce-purchase-order": "PO-3342 draft saved · 3 lines",
  "commerce-operations-dashboard": "£289,560.00",
  "commerce-fulfilment-desk":
    "Request a new label recorded for #4788",
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
let replay;
try {
  for (const { slug } of specs.filter(
    (s) =>
      ["free", "pro"].some(tier => fs.existsSync(`registry/${tier}/${s.slug}`)) &&
      (!selected.size || selected.has(s.slug)),
  )) {
    replay = { slug };
    const tier = fs.existsSync(`registry/pro/${slug}`) ? "pro" : "free";
    const meta = JSON.parse(
      fs.readFileSync(`registry/${tier}/${slug}/meta.json`),
    );
    const steps = meta.demo.steps;
    replay.steps = steps;
    await mountFixture(
      page,
      slug,
      tier,
      `import {DemoPlayer} from './lib/demo/player';import {parseSteps} from './lib/demo/schema.mjs';createRoot(document.getElementById('root')).render(<Subject.default/>);window.play=steps=>new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},new AbortController().signal).play(parseSteps(steps));`,
    );
    await page.locator("#root").evaluate((el) => {
      el.style.maxWidth = "none";
      el.style.padding = "0";
    });
    await page.setViewportSize({ width: 1440, height: meta.previewHeight });
    await page.waitForTimeout(200);
    const before = await page.locator("#root").innerText();
    replay.before = before;
    if (slug === "editor-keyframe-track")
      replay.keyBefore = await page.locator('[data-demo="key-y-1"]').getAttribute("aria-label");
    if (slug === "editor-spacing-inspector")
      replay.paddingBefore = Number(await page.getByRole("textbox", { name: "Left padding", exact: true }).inputValue());
    await page.evaluate(() => {
      window.demoReplayClicks = [];
      document.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target.closest("[data-demo]") : null;
        window.demoReplayClicks.push({
          at: performance.now(),
          target: target?.getAttribute("data-demo") ?? null,
          text: target?.textContent?.trim(),
          disabled: target?.matches(':disabled,[aria-disabled="true"]') ?? false,
        });
      }, true);
    });
    await page.evaluate((steps) => window.play(steps), steps);
    await page.waitForTimeout(100);
    const last = steps
      .filter((s) => s.startsWith("click:@"))
      .at(-1)
      ?.slice(7);
    const target = page.locator('[data-demo="' + last + '"]');
    const notice = await page.getByRole("status").allTextContents();
    if (slug === "input-color-swatches") {
      assert.equal(await page.getByRole("button", {name:"Terracotta, #c7785b",exact:true}).getAttribute("aria-pressed"), "true", "The colour demo finishes on Terracotta");
      assert.equal(await page.locator('button[aria-pressed="true"]').count(), 1);
      assert.equal(await page.getByLabel("Custom colour", {exact:true}).inputValue(), "#c7785b", "The native picker matches the selected specimen");
    }
    if (slug === "input-tag-editor") {
      assert.deepEqual(await page.locator('section button[aria-label^="Remove "]').evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label").slice(7))), ["Interaction", "Typography"], "The topic demo adds Typography and removes only Design systems");
      assert.equal(await page.getByRole("textbox").inputValue(), "", "The topic demo finishes ready for another topic");
    }
    if (slug === "input-number-stepper") {
      assert.equal(await page.getByRole("spinbutton").inputValue(), "5", "The quantity demo finishes one step above its initial value");
      const position = await page.locator('[data-demo="ruler-indicator"]').evaluate(node => parseFloat(node.style.left));
      assert.ok(Math.abs(position - 100 * 4 / 15) < 0.1, "The ruler matches the accepted quantity");
    } else if (slug === "input-password-checklist") {
      const field = page.locator('[data-demo="password"]');
      assert.equal(await field.inputValue(), "Cedar-river42!");
      assert.equal(await field.getAttribute("type"), "text", "The password demo finishes revealed");
      assert.equal(await page.getByRole("button", { name: "Hide password", exact: true }).getAttribute("aria-pressed"), "true");
    } else if (notice.some((s) => s.trim() && !s.startsWith("Connect "))) {
      assert.doesNotMatch(notice.join(" "), /failed|Connect the host/);
    } else if (
      (await target.count()) &&
      (await target.getAttribute("aria-pressed")) !== null
    ) {
      assert.equal(await target.getAttribute("aria-pressed"), slug === "editor-layer-stack" ? "false" : "true");
    } else {
      assert.notEqual(
        await page.locator("#root").innerText(),
        before,
        slug + " replay must change the displayed workflow",
      );
    }
    if (slug === "editor-layer-stack") {
      const rows = await page.locator('ul [data-demo^="layer-"]:not([data-demo^="layer-grip-"]):not([data-demo^="layer-visible-"]):not([data-demo^="layer-lock-"])').evaluateAll(nodes => nodes.map(node => node.dataset.demo));
      assert.equal(rows.indexOf("layer-moon"), 2, "The layer demo moves Moon above Wave");
      assert.equal(await page.locator('[data-demo="layer-moon"]').getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator('[data-demo="explode"]').getAttribute("aria-pressed"), "false");
      await page.waitForFunction(() => document.querySelector('[data-demo="artboard"]').style.transform.includes("rotateX(0deg)"));
    }
    if (slug === "editor-storyboard-strip") {
      const order = await page.locator('[data-demo="strip"] [data-demo^="scene-"]').evaluateAll(nodes => nodes.map(node => node.dataset.demo));
      assert.deepEqual(order.slice(0, 3), ["scene-lake", "scene-detail", "scene-ridge"], "The storyboard demo drops Waxed cotton into the second position");
      assert.equal(await page.locator('[data-demo="scene-detail"]').getAttribute("aria-current"), "true");
      assert.equal(await page.getByRole("textbox", { name: "Shot length in seconds", exact: true }).inputValue(), "3.5", "The recorded stepper extends the moved shot by half a second");
      assert.equal(await page.getByRole("button", { name: "Play the board", exact: true }).count(), 1, "The replay ends paused");
    }
    if (slug === "three-material-inspector") {
      assert.equal(await page.locator('[data-demo="material-brass"]').isChecked(), true);
      const turn = Number(await page.locator('[data-demo="material-turn"]').inputValue());
      const light = Number(await page.locator('[data-demo="material-light"]').inputValue());
      assert.ok(turn > 22, "The material demo turns the sample");
      assert.ok(light > 0 && light < 180, "The material demo swings the key light away from its opening position");
      await page.waitForFunction(({turn, light}) => {
        const pose = document.querySelector('.mi-canvas.mi-ready canvas')?.dataset;
        return pose && Math.abs(Number(pose.azimuth) - turn) < 1 && Math.abs(Number(pose.light) - light) < 1 &&
          Math.abs(Number(pose.metalness) - 1) < 0.001 && Math.abs(Number(pose.roughness) - 0.36) < 0.001 && Number(pose.transmission) === 0;
      }, {turn, light});
      assert.deepEqual(await page.getByRole("definition").allTextContents(), ["1.00", "0.36", "0.00"], "The finish parameters match the canvas material");
    }
    if (slug === "three-exploded-assembly") {
      assert.equal(await page.locator('[data-demo="assembly-frame"]').isChecked(), true);
      const separation = Number(await page.locator('[data-demo="assembly-separation"]').inputValue());
      const turn = Number(await page.locator('[data-demo="assembly-turn"]').inputValue());
      assert.ok(separation > 90, "The assembly demo opens the stack through the recorded separation control");
      assert.ok(turn > 25, "The assembly demo turns the model");
      const canvas = page.locator('.ea-canvas.ea-ready canvas');
      await page.waitForFunction(({separation, turn}) => {
        const pose = document.querySelector('.ea-canvas.ea-ready canvas')?.dataset;
        return pose && Math.abs(Number(pose.separation) - separation / 100) < 0.01 && Math.abs(Number(pose.azimuth) - turn) < 1;
      }, {separation, turn});
      assert.equal(await canvas.count(), 1, "The visible canvas reaches the accepted pose");
    }
    if (slug === "editor-version-restore") {
      assert.ok((await page.getByRole("status").allTextContents()).some(text => text.includes("Restored 1 block from Legal review")), "The restore demo applies only the selected block from the recorded revision");
      assert.equal(await page.locator('[data-demo="undo"]').isEnabled(), true);
      assert.equal(await page.getByRole("option").filter({ hasText: "Before restore" }).count(), 1, "The restore leaves a rollback snapshot");
      assert.equal(await page.locator('[data-demo="pick-closing"]').count(), 0, "The restored block retires its selection control");
    }
    if (slug === "editor-keyframe-track") {
      const key = page.locator('[data-demo="key-y-1"]');
      assert.notEqual(await key.getAttribute("aria-label"), replay.keyBefore, "The keyframe demo changes its recorded key");
      assert.equal(await key.getAttribute("aria-pressed"), "true");
    }
    if (slug === "editor-spacing-inspector") {
      const padding = Number(await page.getByRole("textbox", { name: "Left padding", exact: true }).inputValue());
      assert.ok(padding > replay.paddingBefore, "The spacing demo increases padding through its recorded drag");
      assert.ok((await page.locator("#root").innerText()).includes("flex-direction: row;"));
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
} catch (error) {
  const folder = "test-results/demo-replays";
  fs.mkdirSync(folder, { recursive: true });
  const state = await page.evaluate(() => ({
    clicks: window.demoReplayClicks,
    text: document.getElementById("root")?.innerText,
    scrollY,
    targets: [...document.querySelectorAll("[data-demo]")].map((node) => {
      const box = node.getBoundingClientRect();
      return {
        target: node.getAttribute("data-demo"),
        disabled: node.matches(':disabled,[aria-disabled="true"]'),
        inert: !!node.closest("[inert],[hidden]"),
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        hit: document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          ?.closest("[data-demo]")?.getAttribute("data-demo"),
      };
    }),
  }));
  const file = `${folder}/${replay?.slug ?? "mount"}-failed`;
  fs.writeFileSync(`${file}.json`, JSON.stringify({ ...replay, errors, state }, null, 2));
  await page.screenshot({ path: `${file}.png`, fullPage: true });
  console.error(`Replay failure evidence: ${file}.{json,png}`);
  throw error;
} finally {
  await browser.close();
}
