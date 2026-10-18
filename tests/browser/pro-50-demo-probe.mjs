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
      fs.existsSync("registry/pro/" + s.slug) &&
      (!selected.size || selected.has(s.slug)),
  )) {
    replay = { slug };
    const meta = JSON.parse(
      fs.readFileSync("registry/pro/" + slug + "/meta.json"),
    );
    const steps = meta.demo.steps;
    replay.steps = steps;
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
    replay.before = before;
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
