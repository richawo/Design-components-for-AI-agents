import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const specs = [
  ["block-saas-dashboard", "Trial signups per day"],
  ["block-workspace-settings", "Preferences saved."],
  ["block-financial-report", "September 2026 exported."],
  ["block-fashion-workspace", "Line plan saved"],
  ["block-people-workspace", "Step recorded"],
  ["block-legal-workspace", "Completion evidence recorded for Deliver the quarterly service report."],
  ["block-commerce-workspace", "RET-ORD-1042 · Return request recorded"],
  ["block-saas-landing", "Your Studio workspace request is received."],
  ["block-meetings-workspace", "Studio review"],
  ["block-music-workspace", "Paper Lanterns"],
  ["block-team-workspace", "Phone pass ready, @Noor"],
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
    if (slug === "block-people-workspace") {
      await page.evaluate(() => {
        window.peopleReplay = { actions: [], notes: [], confirmations: [] };
        document.addEventListener("click", event => {
          const name = event.target.closest?.("[data-demo]")?.dataset.demo;
          if (["nav-onboarding", "task-access", "completion-note", "completion-confirm", "record"].includes(name)) {
            window.peopleReplay.actions.push(name);
          }
        }, true);
        document.addEventListener("input", event => {
          if (event.target.dataset?.demo === "completion-note") window.peopleReplay.notes.push(event.target.value);
        });
        document.addEventListener("change", event => {
          if (event.target.dataset?.demo === "completion-confirm") window.peopleReplay.confirmations.push(event.target.checked);
        });
      });
    }
    if (slug === "block-music-workspace") {
      await page.evaluate(() => {
        window.musicReplay = [];
        document.addEventListener("click", event => {
          const name = event.target.closest?.("[data-demo]")?.dataset.demo;
          if (!["music-listen", "queue-blue", "nav-queue", "track-lanterns"].includes(name)) return;
          const audio = document.querySelector("audio");
          window.musicReplay.push({ name, paused: audio?.paused, time: audio?.currentTime, duration: audio?.duration });
        }, true);
      });
    }
    if (slug === "block-saas-landing") {
      await page.evaluate(() => {
        window.landingReplay = { clicks: [], emails: [], submissions: [] };
        document.addEventListener("click", event => {
          const target = event.target.closest?.("[data-demo]")?.dataset.demo;
          if (["plan-studio", "email", "submit"].includes(target)) window.landingReplay.clicks.push(target);
        }, true);
        document.addEventListener("input", event => {
          if (event.target.dataset?.demo === "email") window.landingReplay.emails.push(event.target.value);
        });
        document.addEventListener("submit", event => {
          window.landingReplay.submissions.push({ email: event.target.querySelector("input")?.value, title: event.target.closest("footer")?.querySelector("h2")?.textContent });
        }, true);
      });
    }
    if (slug === "block-team-workspace") {
      await page.evaluate(() => {
        window.teamReplay = { actions: [], inputs: [], sends: [] };
        document.addEventListener("click", event => {
          const name = event.target.closest?.("[data-demo]")?.dataset.demo;
          if (["reply-m1", "close-thread", "editor", "send-studio"].includes(name)) window.teamReplay.actions.push(name);
          if (name === "send-studio") {
            const editor = document.querySelector('[data-composer="studio"] [role="textbox"]');
            window.teamReplay.sends.push({ text: editor?.innerText.replace(/\u00a0/g, " ").trim(), tokens: [...(editor?.querySelectorAll('[data-token="person"]') ?? [])].map(node => node.dataset.id) });
          }
        }, true);
        document.addEventListener("input", event => {
          if (event.target.matches?.('[data-composer="studio"] [role="textbox"]')) window.teamReplay.inputs.push(event.target.innerText.replace(/\u00a0/g, " "));
        });
      });
    }
    let dashboardDownload;
    if (slug === "block-saas-dashboard") {
      dashboardDownload = page.waitForEvent('download');
      await page.evaluate(() => {
        window.dashboardReplay = { clicks: [], dailyReads: [] };
        document.addEventListener('click', event => {
          const name = event.target.closest?.('[data-demo]')?.dataset.demo;
          if (['card-signups','range-7d','export'].includes(name)) window.dashboardReplay.clicks.push(name);
        }, true);
        new MutationObserver(() => {
          const text = document.querySelector('[data-demo="plot"] [aria-live="polite"]')?.textContent?.trim();
          if (text && window.dashboardReplay.dailyReads.at(-1) !== text) window.dashboardReplay.dailyReads.push(text);
        }).observe(document.getElementById('root'), {subtree:true,childList:true,characterData:true});
      });
    }
    await page.evaluate((steps) => window.play(steps), meta.demo.steps);
    assert.ok(
      (await page.locator("#root").innerText()).includes(final),
      slug + " intended end",
    );
    if (slug === "block-team-workspace") {
      const trace = await page.evaluate(() => window.teamReplay);
      assert.deepEqual(trace.actions, ["reply-m1", "close-thread", "editor", "send-studio"]);
      assert.equal(trace.inputs.at(-1), "Phone pass ready, @no");
      assert.deepEqual(trace.sends, [{ text: "Phone pass ready, @Noor", tokens: ["noor"] }]);
      assert.equal(meta.demo.loop, false);
      assert.equal(await page.getByRole("log").getByText("Phone pass ready, @Noor", { exact: true }).count(), 1);
      assert.equal(await page.locator('[data-composer="studio"] [role="textbox"]').innerText(), "");
      assert.equal(await page.getByRole("button", { name: "Close message thread", exact: true }).count(), 0);
      assert.equal(await page.getByRole("alert").count(), 0);
    }
    if (slug === "block-saas-landing") {
      const trace = await page.evaluate(() => window.landingReplay);
      assert.deepEqual(trace.clicks, ["plan-studio", "email", "submit"]);
      assert.equal(trace.emails.at(-1), "hello@studio.test");
      assert.equal(trace.submissions.length, 1);
      assert.equal(trace.submissions[0].email, "hello@studio.test");
      assert.match(trace.submissions[0].title, /Your Studio workspace\./);
      assert.equal(await page.getByRole("button", { name: "Use a different email", exact: true }).isVisible(), true);
    }
    if (slug === "block-saas-dashboard") {
      const trace = await page.evaluate(() => window.dashboardReplay);
      assert.deepEqual(trace.clicks, ['card-signups','range-7d','export']);
      assert.ok(trace.dailyReads.some(text => /9 Oct: 48, previous 58/.test(text)), 'Replay inspects the actual daily signup comparison');
      const download = await dashboardDownload;
      assert.equal(await download.failure(), null);
      assert.equal(download.suggestedFilename(), 'signups-7d.csv');
      const lines = fs.readFileSync(await download.path(), 'utf8').split('\r\n');
      assert.equal(lines[0], 'date,value');
      assert.equal(lines.length, 8);
      const points = lines.slice(1).map(line => { const match = /^"([^"]+)","(\d+)"$/.exec(line); assert.ok(match); return [match[1],Number(match[2])]; });
      assert.deepEqual(points.map(point => point[0]), Array.from({length:7},(_,i)=>`2026-10-${String(i+6).padStart(2,'0')}`));
      assert.equal(points.reduce((sum,point)=>sum+point[1],0),345);
      assert.equal(await page.getByRole('radio',{name:'7D',exact:true}).getAttribute('aria-checked'),'true');
      assert.equal(await page.getByRole('status').filter({hasText:'Exported trial signups for 7d.'}).isVisible(),true);
    }
    if (slug === "block-people-workspace") {
      const trace = await page.evaluate(() => window.peopleReplay);
      assert.deepEqual(trace.actions, ["nav-onboarding", "task-access", "completion-note", "completion-confirm", "record"]);
      assert.equal(trace.notes.at(-1), "Access checked. IT-208.");
      assert.deepEqual(trace.confirmations, [true]);
      const pane = page.getByRole("tabpanel", { name: "Onboarding", exact: true });
      assert.equal(await page.getByRole("tab", { name: "Onboarding", exact: true }).getAttribute("aria-selected"), "true");
      assert.equal(await pane.getByRole("status").filter({ hasText: "Step recorded · Workspace and account access" }).isVisible(), true);
      assert.equal(await pane.getByText("2 of 4 required steps complete", { exact: true }).count(), 1);
      assert.equal(await pane.getByRole("checkbox", { name: "Mark “Workspace and account access” not done for Noor Ali", exact: true }).isChecked(), true);
      assert.equal(await pane.getByRole("button", { name: "Record completion", exact: true }).count(), 0);
    }
    if (slug === "block-music-workspace") {
      const trace = await page.evaluate(() => window.musicReplay);
      assert.deepEqual(trace.map(step => step.name), ["music-listen", "queue-blue", "nav-queue", "track-lanterns"]);
      assert.equal(trace.at(-1).paused, false, "The final row action pauses actual playing audio");
      assert.ok(trace.at(-1).time < trace.at(-1).duration - 2, "Pause is exercised before natural ending");
      const pane = page.getByRole("tabpanel", { name: "Up next", exact: true });
      assert.equal(await page.getByRole("tab", { name: "Up next", exact: true }).getAttribute("aria-selected"), "true");
      assert.equal(await pane.getByRole("button", { name: "Play Paper Lanterns by Mara Vale", exact: true }).isVisible(), true);
      assert.equal(await pane.getByRole("button", { name: "Remove Before the city wakes", exact: true }).isVisible(), true);
      assert.equal(await pane.locator('ol[aria-label="Up next"] > li').count(), 3);
      assert.equal(await page.locator("audio").evaluate(audio => audio.paused && !audio.ended), true);
    }
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
