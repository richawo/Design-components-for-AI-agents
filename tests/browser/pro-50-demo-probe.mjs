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
  "input-shortcut-recorder": "Shortcut reset.",
  "input-file-dropzone": "1 of 5 files selected.",
  "date-booking-slots": "Tue 13, 10:00 selected",
  "onboarding-setup-checklist": "Everything on your list is complete.",
  "date-week-agenda": "Research playback",
  "forms-preference-center": "Preferences saved.",
  "data-file-explorer": "A small, accessible action with honest loading feedback.",
  "data-kanban-compact": "Test keyboard paths moved to Done.",
  "media-before-after": "Final design",
  "devtools-json-inspector": "error",
  "devtools-request-waterfall": "/workspace",
  "media-story-deck": "Make the last ten percent count.",
  "chart-bullet-targets": "Docs published",
  "chart-slope-comparison": "Editor",
  "cards-event-ticket": "View programme",
  "content-release-notes": "A calmer place to work.",
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
    if (slug === "input-shortcut-recorder") {
      await page.locator("section").evaluate(recorder => {
        const state = () => [[...recorder.querySelectorAll("kbd")].map(node => node.textContent), recorder.querySelector('[data-demo="record-shortcut"]')?.getAttribute("aria-label"), recorder.querySelector('[role="status"]')?.textContent.trim()];
        window.shortcutStates = [state()];
        window.shortcutObserver = new MutationObserver(() => {
          const next = state();
          if (JSON.stringify(next) !== JSON.stringify(window.shortcutStates.at(-1))) window.shortcutStates.push(next);
        });
        window.shortcutObserver.observe(recorder, {childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["aria-label"]});
      });
    }
    if (slug === "input-file-dropzone") {
      await page.locator("section").evaluate(dropzone => {
        const state = () => [[...dropzone.querySelectorAll("li p.font-medium")].map(node => node.textContent), dropzone.querySelector('[role="status"]')?.textContent.trim()];
        window.dropzoneStates = [state()];
        window.dropzoneObserver = new MutationObserver(() => {
          const next = state();
          if (JSON.stringify(next) !== JSON.stringify(window.dropzoneStates.at(-1))) window.dropzoneStates.push(next);
        });
        window.dropzoneObserver.observe(dropzone, {childList:true,characterData:true,subtree:true});
      });
    }
    if (slug === "date-booking-slots") {
      await page.locator("section").evaluate(booking => {
        const state = () => [booking.querySelector('[aria-pressed="true"]')?.getAttribute("data-demo"), booking.querySelector('input[type="radio"]:checked')?.closest("label").textContent.trim() ?? null, booking.querySelector('[role="status"]')?.textContent.replace(/\s+/g," ").trim()];
        window.bookingStates = [state()];
        window.bookingObserver = new MutationObserver(() => {
          const next = state();
          if (next[0] && JSON.stringify(next) !== JSON.stringify(window.bookingStates.at(-1))) window.bookingStates.push(next);
        });
        window.bookingObserver.observe(booking, {childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["aria-pressed","checked"]});
      });
    }
    if (slug === "onboarding-setup-checklist") {
      await page.locator("section").evaluate(checklist => {
        const state = () => [checklist.querySelector('[role="img"]')?.getAttribute("aria-label"), checklist.querySelector('[data-demo="setup-task-1"]')?.getAttribute("aria-expanded"), checklist.querySelector('[data-demo="setup-task-2"]')?.getAttribute("aria-expanded")];
        window.setupStates = [state()];
        window.setupObserver = new MutationObserver(() => {
          const next = state();
          if (next.every(Boolean) && JSON.stringify(next) !== JSON.stringify(window.setupStates.at(-1))) window.setupStates.push(next);
        });
        window.setupObserver.observe(checklist, {childList:true,subtree:true,attributes:true,attributeFilter:["aria-label","aria-expanded"]});
      });
    }
    if (slug === "date-week-agenda") {
      await page.locator("section").evaluate(agenda => {
        const state = () => [agenda.querySelector('[aria-pressed="true"]')?.textContent, agenda.querySelector('ol button span.block')?.textContent, agenda.querySelector('ol button')?.getAttribute("aria-expanded")];
        window.agendaStates = [state()];
        window.agendaObserver = new MutationObserver(() => {
          const next = state();
          if (next.every(Boolean) && JSON.stringify(next) !== JSON.stringify(window.agendaStates.at(-1))) window.agendaStates.push(next);
        });
        window.agendaObserver.observe(agenda, {childList:true,subtree:true,attributes:true,attributeFilter:["aria-pressed","aria-expanded"]});
      });
    }
    if (slug === "forms-preference-center") {
      await page.locator("section").evaluate(form => {
        const choices = () => [...form.querySelectorAll('input[type="checkbox"]')].map(input => input.checked);
        const action = form.querySelector('[data-demo="save-preferences"]');
        const busy = () => action.getAttribute("aria-busy") === "true";
        window.preferenceChoices = [choices()];
        window.preferenceBusy = [busy()];
        form.addEventListener("change", () => queueMicrotask(() => {
          const next = choices();
          if (JSON.stringify(next) !== JSON.stringify(window.preferenceChoices.at(-1))) window.preferenceChoices.push(next);
        }));
        window.preferenceObserver = new MutationObserver(() => {
          const next = busy();
          if (next !== window.preferenceBusy.at(-1)) window.preferenceBusy.push(next);
        });
        window.preferenceObserver.observe(action, {attributes:true,attributeFilter:["aria-busy"]});
      });
    }
    if (slug === "data-file-explorer") {
      await page.locator("section").evaluate(explorer => {
        const state = () => [explorer.querySelector("h3")?.textContent, explorer.querySelector('[data-demo="node-components"]')?.getAttribute("aria-expanded")];
        window.fileExplorerStates = [state()];
        window.fileExplorerObserver = new MutationObserver(() => {
          const next = state();
          if (next.every(Boolean) && JSON.stringify(next) !== JSON.stringify(window.fileExplorerStates.at(-1))) window.fileExplorerStates.push(next);
        });
        window.fileExplorerObserver.observe(explorer, {childList:true,subtree:true,attributes:true,attributeFilter:["aria-expanded"]});
      });
    }
    if (slug === "data-kanban-compact") {
      await page.locator("section[aria-labelledby]").evaluate(board => {
        const positions = () => ["DS-14", "DS-18"].map(id => board.querySelector('[data-kanban-card="'+id+'"]:not([inert])')?.closest("[data-kanban-column]")?.getAttribute("data-kanban-column"));
        window.kanbanStates = [positions()];
        window.kanbanObserver = new MutationObserver(() => {
          const state = positions();
          if (state.every(Boolean) && JSON.stringify(state) !== JSON.stringify(window.kanbanStates.at(-1))) window.kanbanStates.push(state);
        });
        window.kanbanObserver.observe(board, {childList:true,subtree:true,attributes:true,attributeFilter:["inert"]});
      });
    }
    if (slug === "media-before-after") {
      await page.getByRole("slider").evaluate(slider => {
        window.beforeAfterStates = [Number(slider.value)];
        window.beforeAfterInput = () => {
          const value = Number(slider.value);
          if (value !== window.beforeAfterStates.at(-1)) window.beforeAfterStates.push(value);
        };
        slider.addEventListener("input", window.beforeAfterInput);
      });
    }
    if (slug === "devtools-json-inspector") {
      await page.locator("section").evaluate(reader => {
        const folds = () => ["json-root-3", "json-root-4"].map(id => reader.querySelector('[data-demo="'+id+'"]')?.getAttribute("aria-expanded"));
        window.jsonFoldStates = [folds()];
        window.jsonFoldObserver = new MutationObserver(() => {
          const state = folds();
          if (JSON.stringify(state) !== JSON.stringify(window.jsonFoldStates.at(-1))) window.jsonFoldStates.push(state);
        });
        window.jsonFoldObserver.observe(reader, {subtree:true,attributes:true,attributeFilter:["aria-expanded"]});
      });
    }
    if (slug === "devtools-request-waterfall") {
      await page.locator("section").evaluate(capture => {
        const selected = () => capture.querySelector('button[aria-pressed="true"]')?.getAttribute("data-demo");
        window.requestWaterfallStates = [selected()];
        window.requestWaterfallObserver = new MutationObserver(() => {
          const request = selected();
          if (request && request !== window.requestWaterfallStates.at(-1)) window.requestWaterfallStates.push(request);
        });
        window.requestWaterfallObserver.observe(capture, {subtree:true,attributes:true,attributeFilter:["aria-pressed"]});
      });
    }
    if (slug === "media-story-deck") {
      await page.locator("section").evaluate(carousel => {
        const current = () => carousel.querySelector('[aria-roledescription="slide"]')?.getAttribute("aria-label");
        window.storyDeckStates = [current()];
        window.storyDeckObserver = new MutationObserver(() => {
          const label = current();
          if (label && label !== window.storyDeckStates.at(-1)) window.storyDeckStates.push(label);
        });
        window.storyDeckObserver.observe(carousel, {childList:true,subtree:true});
      });
    }
    if (slug === "cards-event-ticket") {
      await page.locator('[data-demo="ticket-details"]').evaluate(node => {
        window.ticketExpandedStates = [node.getAttribute("aria-expanded")];
        window.ticketObserver = new MutationObserver(() => {
          window.ticketExpandedStates.push(node.getAttribute("aria-expanded"));
        });
        window.ticketObserver.observe(node, {attributes:true,attributeFilter:["aria-expanded"]});
      });
    }
    if (slug === "chart-bullet-targets") {
      await page.locator('[aria-label="Reporting period"]').evaluate(group => {
        const selected = () => group.querySelector('[aria-pressed="true"]')?.getAttribute("data-demo");
        window.bulletPeriodStates = [selected()];
        window.bulletObserver = new MutationObserver(() => window.bulletPeriodStates.push(selected()));
        window.bulletObserver.observe(group, {subtree:true,attributes:true,attributeFilter:["aria-pressed"]});
      });
    }
    await page.evaluate((steps) => window.play(steps), steps);
    await page.waitForTimeout(100);
    const last = steps
      .filter((s) => s.startsWith("click:@"))
      .at(-1)
      ?.slice(7);
    const target = page.locator('[data-demo="' + last + '"]');
    const notice = await page.getByRole("status").allTextContents();
    if (slug === "input-shortcut-recorder") {
      assert.deepEqual(await page.evaluate(() => window.shortcutStates), [
        [["Control","Shift","K"],"Record shortcut. Current: Control plus Shift plus K","Click the keycaps to change the combination."],
        [[],"Recording shortcut. Escape to cancel.","Escape cancels. Tab leaves without changing the shortcut."],
        [["F8"],"Record shortcut. Current: F8","Shortcut recorded."],
        [["Control","Shift","K"],"Record shortcut. Current: Control plus Shift plus K","Shortcut reset."]
      ], "The replay deliberately records F8, then resets the actual chord");
      assert.deepEqual(await page.locator("kbd").allTextContents(), ["Control","Shift","K"]);
      assert.equal(await page.locator('[data-demo="record-shortcut"]').evaluate(node => node === document.activeElement), true);
      assert.ok(notice.includes("Shortcut reset."));
      await page.evaluate(() => window.shortcutObserver.disconnect());
    }
    if (slug === "input-file-dropzone") {
      assert.deepEqual(await page.evaluate(() => window.dropzoneStates), [[[],"0 of 5 files selected."], [["product-brief.md"],"1 of 5 files selected."]], "The sample action selects one actual document and retains its selection receipt");
      assert.equal(await page.getByRole("button", {name:"Remove product-brief.md",exact:true}).isVisible(), true);
      assert.equal(await page.locator('[data-demo="sample-file"]').evaluate(node => node === document.activeElement), true);
      assert.ok(notice.includes("1 of 5 files selected."));
      await page.evaluate(() => window.dropzoneObserver.disconnect());
    }
    if (slug === "date-booking-slots") {
      assert.deepEqual(await page.evaluate(() => window.bookingStates), [["day-0",null,"Choose an available time to continue."], ["day-0","10:30","Mon 12, 10:30 selected"], ["day-1",null,"Mon 12, 10:30 selected"], ["day-1","10:00","Tue 13, 10:00 selected"]], "Day browsing retains Monday's actual choice until Tuesday's time is selected");
      assert.equal(await page.getByRole("radio", {checked:true}).count(), 1);
      const slot = page.getByRole("radio", {name:"10:00",exact:true});
      assert.equal(await slot.isChecked(), true);
      assert.equal(await slot.evaluate(node => node === document.activeElement), true);
      assert.equal(await page.locator('[data-demo="day-1"]').getAttribute("aria-pressed"), "true");
      assert.ok(notice.includes("Tue 13, 10:00 selected"));
      await page.evaluate(() => window.bookingObserver.disconnect());
    }
    if (slug === "onboarding-setup-checklist") {
      assert.deepEqual(await page.evaluate(() => window.setupStates), [["1 of 3 steps complete","true","false"], ["2 of 3 steps complete","true","false"], ["2 of 3 steps complete","false","true"], ["3 of 3 steps complete","false","true"]], "The replay completes the source, opens question instructions and completes the last task");
      assert.deepEqual(await page.getByRole("checkbox").evaluateAll(inputs => inputs.map(input => input.checked)), [true,true,true]);
      assert.equal(await page.locator('[data-demo="complete-2"]').evaluate(node => node === document.activeElement), true);
      assert.ok(notice.includes("Everything on your list is complete."));
      assert.equal(await page.getByText("Try something you would otherwise search for manually.", {exact:true}).isVisible(), true);
      await page.evaluate(() => window.setupObserver.disconnect());
    }
    if (slug === "date-week-agenda") {
      assert.deepEqual(await page.evaluate(() => window.agendaStates), [["Mon","Design critique","false"], ["Mon","Design critique","true"], ["Tue","Research playback","false"]], "The replay reads Monday's notes before moving to Tuesday");
      const day = page.getByRole("button", {name:"Tue",exact:true});
      assert.equal(await day.getAttribute("aria-pressed"), "true");
      assert.equal(await day.evaluate(node => node === document.activeElement), true);
      assert.equal(await page.getByRole("button", {name:/Design critique/}).count(), 0);
      assert.equal(await page.locator('button[aria-expanded="true"]').count(), 0);
      assert.equal(await page.getByText("13 October", {exact:true}).count(), 1);
      await page.evaluate(() => window.agendaObserver.disconnect());
    }
    if (slug === "forms-preference-center") {
      assert.deepEqual(await page.evaluate(() => window.preferenceChoices), [[true,true,false], [true,true,true]], "The replay selects product notes before saving");
      assert.deepEqual(await page.evaluate(() => window.preferenceBusy), [false,true,false], "The save enters and leaves its pending state");
      assert.deepEqual(await page.getByRole("checkbox").evaluateAll(inputs => inputs.map(input => input.checked)), [true,true,true]);
      assert.equal(await page.getByRole("checkbox").first().isDisabled(), true);
      assert.equal(await page.locator('[data-demo="save-preferences"]').getAttribute("aria-busy"), "false");
      assert.equal(await page.locator('[data-demo="save-preferences"]').evaluate(node => node === document.activeElement), true);
      assert.ok(notice.includes("Preferences saved."));
      await page.evaluate(() => window.preferenceObserver.disconnect());
    }
    if (slug === "data-file-explorer") {
      assert.deepEqual(await page.evaluate(() => window.fileExplorerStates), [["README.md", "true"], ["button.tsx", "true"], ["button.tsx", "false"]], "The explorer selects a file before closing its containing folder");
      const folder = page.locator('[data-demo="node-components"]');
      assert.equal(await folder.getAttribute("aria-expanded"), "false");
      assert.equal(await folder.evaluate(node => node === document.activeElement), true);
      const id = await folder.getAttribute("aria-controls");
      assert.equal(await page.locator('[id='+JSON.stringify(id)+']').evaluate(node => node.hidden), true);
      assert.equal(await page.getByRole("button", {name:"button.tsx",exact:true}).count(), 0);
      assert.equal(await page.getByRole("region", {name:"button.tsx",exact:true}).count(), 1);
      assert.equal(await page.locator('[data-demo="node-button"]').getAttribute("aria-pressed"), "true");
      await page.evaluate(() => window.fileExplorerObserver.disconnect());
    }
    if (slug === "data-kanban-compact") {
      assert.deepEqual(await page.evaluate(() => window.kanbanStates), [["ready", "working"], ["working", "working"], ["working", "done"]], "The sprint replay moves DS-14 to In progress before DS-18 reaches Done");
      assert.deepEqual(await page.locator('[data-kanban-column="working"] [data-kanban-card]:not([inert])').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-kanban-card"))), ["DS-14"]);
      assert.deepEqual(await page.locator('[data-kanban-column="done"] [data-kanban-card]:not([inert])').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-kanban-card"))), ["DS-09", "DS-18"]);
      assert.equal(await page.locator('[data-kanban-column="ready"] [data-kanban-card]').count(), 0);
      assert.equal(await page.locator('[data-kanban-card]').count(), 3, "Exiting task copies leave the layout");
      assert.equal(await page.locator('[data-demo="move-ds-18"]').evaluate(node => node === document.activeElement), true);
      await page.evaluate(() => window.kanbanObserver.disconnect());
    }
    if (slug === "chart-slope-comparison") {
      assert.equal(await page.locator('[data-demo="slope-1"]').getAttribute("aria-pressed"), "true");
      assert.equal(await page.getByRole("img").getAttribute("aria-label"), "Editor: 58% in September, 70% in October");
      assert.equal(await page.locator('[data-demo="slope-before-value"]').innerText(), "58");
      assert.equal(await page.locator('[data-demo="slope-after-value"]').innerText(), "70");
      assert.equal(await page.locator('button[aria-pressed="true"]').count(), 1);
    }
    if (slug === "content-release-notes") {
      assert.equal(await page.getByRole("button", {name:"Features",exact:true}).getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator("section article").count(), 2);
      assert.deepEqual(await page.locator("section article li .sr-only").allTextContents(), ["Feature: ", "Feature: "], "The demo leaves only feature changes in both visible releases");
      assert.equal(await page.getByRole("button", {name:"Fixes",exact:true}).getAttribute("aria-pressed"), "false");
    }
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
    } else if (slug === "media-before-after") {
      const states = await page.evaluate(() => window.beforeAfterStates);
      assert.equal(states.length, 4, "The comparison replay makes three deliberate changes");
      assert.equal(states[0], 48);
      assert.ok(states[1] >= 68 && states[1] <= 72, "The pointer step reveals approximately seventy percent of the wireframe");
      assert.deepEqual(states.slice(2), [100, 0], "End reveals the complete wireframe before Home reveals the finished cover");
      const slider = page.getByRole("slider");
      assert.equal(await slider.inputValue(), "0");
      assert.equal(await slider.getAttribute("aria-valuetext"), "0 percent Wireframe");
      assert.equal(await slider.evaluate(node => node === document.activeElement), true);
      assert.equal(await page.locator('figure > div > div[style*="clip-path"]').evaluate(node => parseFloat(node.style.clipPath.split(" ")[1])), 100);
      assert.equal(await page.locator('figure > div > div[style*="left"]').evaluate(node => parseFloat(node.style.left)), 0);
      await slider.evaluate(node => node.removeEventListener("input", window.beforeAfterInput));
    } else if (slug === "devtools-json-inspector") {
      assert.deepEqual(await page.evaluate(() => window.jsonFoldStates), [["true", "true"], ["false", "true"], ["false", "false"]], "The JSON replay folds usage before tools");
      for (const id of ["json-root-3", "json-root-4"]) {
        const button = page.locator('[data-demo="'+id+'"]');
        assert.equal(await button.getAttribute("aria-expanded"), "false");
        const target = await button.getAttribute("aria-controls");
        assert.equal(await page.locator('[id='+JSON.stringify(target)+']').evaluate(node => node.hidden), true);
      }
      assert.equal(await page.getByText("input_tokens", {exact:true}).count(), 0);
      assert.equal(await page.getByText('"search_docs"', {exact:true}).count(), 0);
      assert.equal(await page.getByText("error", {exact:true}).count(), 1);
      assert.equal(await page.getByRole("region", {name:"JSON contents",exact:true}).getAttribute("tabindex"), "0");
      await page.evaluate(() => window.jsonFoldObserver.disconnect());
    } else if (slug === "devtools-request-waterfall") {
      assert.deepEqual(await page.evaluate(() => window.requestWaterfallStates), ["request-2", "request-3", "request-0"], "The waterfall replay inspects the document request before the initial HTML response");
      assert.equal(await page.locator('button[aria-pressed="true"]').count(), 1);
      assert.equal(await page.locator('[data-demo="request-0"]').getAttribute("aria-pressed"), "true");
      const details = page.locator("section > div:last-child");
      assert.deepEqual(await details.locator("div > p:last-child").allTextContents(), ["HTTP 200", "0 ms", "124 ms"]);
      assert.equal(await page.getByText("538 ms", {exact:true}).count(), 1);
      const fraction = await page.locator('[data-demo="request-0"] > span[aria-hidden="true"] > span').evaluate(node => node.getBoundingClientRect().width / node.parentElement.getBoundingClientRect().width);
      assert.ok(Math.abs(fraction - 124/538) < 0.005, "The selected request retains the shared capture scale");
      await page.evaluate(() => window.requestWaterfallObserver.disconnect());
    } else if (slug === "media-story-deck") {
      assert.deepEqual(await page.evaluate(() => window.storyDeckStates), [
        "1 of 3: Start with the quiet details.",
        "2 of 3: Give one idea room to grow.",
        "3 of 3: Make the last ten percent count.",
      ], "The story replay reads all three studies in order");
      const slide = page.getByRole("group", {name:"3 of 3: Make the last ten percent count.",exact:true});
      assert.equal(await slide.count(), 1);
      assert.equal(await page.locator('[aria-roledescription="slide"]').count(), 1);
      assert.equal(await page.getByRole("button", {name:"Next story",exact:true}).isDisabled(), true);
      assert.equal(await page.getByRole("button", {name:"Previous story",exact:true}).isEnabled(), true);
      assert.equal(await slide.locator("svg rect").count(), 7);
      assert.equal(await slide.getByRole("heading").innerText(), "Make the last ten percent count.");
      assert.equal(await slide.locator(".font-display").innerText(), "01");
      await page.evaluate(() => window.storyDeckObserver.disconnect());
    } else if (slug === "chart-bullet-targets") {
      assert.deepEqual(await page.evaluate(() => window.bulletPeriodStates), ["bullet-period-0", "bullet-period-1", "bullet-period-0"], "The bullet replay visits September before returning to October");
      assert.deepEqual(await page.getByRole("img").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label"))), ["Docs published: 42 docs, target 50, scale 0 to 70", "Reviews completed: 28 reviews, target 24, scale 0 to 40", "First reply within 1h: 86 %, target 90, scale 0 to 100"]);
      assert.deepEqual(await page.locator('[data-demo^="bullet-value-"]').allTextContents(), ["42", "28", "86"]);
      const fractions = await page.getByRole("img").evaluateAll(nodes => nodes.map(node => node.children[1].getBoundingClientRect().width / node.getBoundingClientRect().width));
      for (const [i, expected] of [42/70, 28/40, 86/100].entries()) assert.ok(Math.abs(fractions[i]-expected)<0.005, "The settled bars match October's actual values");
      await page.evaluate(() => window.bulletObserver.disconnect());
    } else if (slug === "cards-event-ticket") {
      assert.deepEqual(await page.evaluate(() => window.ticketExpandedStates), ["false", "true", "false"], "The ticket replay opens the programme before closing it");
      assert.equal(await page.getByRole("button", {name:"View programme",exact:true}).getAttribute("aria-expanded"), "false");
      assert.equal(await page.getByRole("list").count(), 0, "The programme is inaccessible after the closing action");
      const id = await target.getAttribute("aria-controls");
      assert.equal(await page.locator('[id='+JSON.stringify(id)+']').evaluate(node => node.getBoundingClientRect().height), 0, "The programme is visually collapsed");
      await page.evaluate(() => window.ticketObserver.disconnect());
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
  try {
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
    })).catch(diagnosticError => ({ unavailable: true, error: String(diagnosticError) }));
    const file = `${folder}/${replay?.slug ?? "mount"}-failed`;
    let screenshotError;
    try { await page.screenshot({ path: `${file}.png`, fullPage: true }); }
    catch (diagnosticError) { screenshotError = String(diagnosticError); }
    const evidence = {
      ...replay, errors, error: String(error?.stack ?? error), state,
      ...(screenshotError ? { screenshotError } : {}),
    };
    fs.writeFileSync(`${file}.json`, JSON.stringify(evidence, null, 2));
    console.error(`Replay failure evidence: ${file}.json`);
    if (screenshotError) console.error("Replay screenshot unavailable:", screenshotError);
  } catch (diagnosticError) {
    console.error("Replay evidence unavailable:", diagnosticError);
  }
  throw error;
} finally {
  await browser.close();
}
