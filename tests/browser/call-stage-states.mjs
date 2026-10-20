import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
import { check as checkControlsContrast } from "./review/call-controls-contrast.mjs";
import { check as checkTouchTargets } from "./review/call-stage-touch-targets.mjs";

const browser = await launchChromium();
const results = [],
  errors = [];
const out = process.env.POLISH_OUT;
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await checkControlsContrast({ page, assert, mount: code => mountFixture(page, "collab-call-stage", "pro", code) });
  await checkTouchTargets({ browser, assert });
  await mountFixture(
    page,
    "collab-call-stage",
    "pro",
    `
    const root=createRoot(document.getElementById('root'));
    const people=Array.from({length:12},(_,i)=>({id:i===2?'sam':'p'+i,name:i<4?['Mara Vale','Noor Ali','Sam Chen','Iris Field'][i]:'Guest '+(i+1),role:'Design and engineering',muted:true}));
    let current={count:4,theme:'dark',captions:'A decision worth keeping.',height:640};
    window.renderState=(patch={})=>{current={...current,...patch};root.render(<div style={{height:current.height}}><Subject.CallStage participants={people.slice(0,current.count).map((p,i)=>({...p,stream:i===0?current.stream:undefined}))} currentUserId="sam" theme={current.theme} captions={current.captions} onLeave={()=>{}} onMicrophoneChange={()=>{}} onCameraChange={()=>{}} onHandChange={()=>{}}/></div>);};
    window.startVideo=()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');ctx.fillStyle='#6b6256';ctx.fillRect(0,0,320,180);window.testStream=canvas.captureStream(10);window.renderState({stream:window.testStream});};
    window.stopVideo=()=>window.testStream.getVideoTracks().forEach(t=>t.stop());
    window.renderState();
  `,
  );
  await page.locator("#root").evaluate((el) => {
    el.style.maxWidth = "none";
    el.style.padding = "24px";
  });
  async function geometry(label) {
    await page.waitForTimeout(380);
    const state = await page.evaluate(() => {
      const stage = document.querySelector('[aria-label="Meeting room"]');
      const boxes = [...stage.querySelectorAll("article")].map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      const overlaps = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i],
            b = boxes[j];
          if (
            Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 &&
            Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1
          )
            overlaps.push([i, j]);
        }
      const leave = [...stage.querySelectorAll("button")]
        .find((e) => e.textContent.includes("Leave room"))
        .getBoundingClientRect();
      return {
        boxes,
        overlaps,
        pageWidth: document.documentElement.scrollWidth,
        width: innerWidth,
        controlsReachable:
          leave.bottom <= stage.getBoundingClientRect().bottom + 1,
      };
    });
    if (state.overlaps.length && out) {
      fs.mkdirSync(out, { recursive: true });
      await page.screenshot({ path: `${out}/call-failure.png` });
      fs.writeFileSync(
        `${out}/call-failure.json`,
        JSON.stringify({ label, state }, null, 2),
      );
    }
    assert.deepEqual(
      state.overlaps,
      [],
      `${label}: ${JSON.stringify(state.boxes)}`,
    );
    assert.ok(state.pageWidth <= state.width, label);
    assert.ok(state.controlsReachable, label);
    results.push({ label, ...state });
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const count of [0, 1, 2, 4, 6, 12]) {
      await page.evaluate((count) => window.renderState({ count }), count);
      await geometry(`${width}px, ${count} participants`);
      if (count > 1) {
        await page
          .getByRole("button", {
            name: "Spotlight " + (count > 2 ? "Sam Chen" : "Mara Vale"),
            exact: true,
          })
          .first()
          .click();
        await geometry(`${width}px, ${count} participants, pinned`);
        await page
          .getByRole("button", { name: "Captions", exact: true })
          .click();
        await page.evaluate(() =>
          window.renderState({
            captions: "Keep the controls within reach. ".repeat(45),
          }),
        );
        await geometry(`${width}px, ${count} participants, long captions`);
        await page
          .getByRole("button", { name: "Grid view", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Captions", exact: true })
          .click();
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() =>
    window.renderState({
      count: 4,
      theme: "light",
      height: 360,
      captions: "A long caption. ".repeat(45),
    }),
  );
  await page
    .getByRole("button", { name: "Spotlight Sam Chen", exact: true }).first()
    .click();
  await page.getByRole("button", { name: "Captions", exact: true }).click();
  await geometry("short light room with pinned participant and long captions");
  await page.getByRole("button", { name: "Grid view", exact: true }).click();
  await page.evaluate(() =>
    window.renderState({
      height: 640,
      theme: "dark",
      stream: new MediaStream(),
    }),
  );
  await page.waitForTimeout(200);
  assert.equal(
    await page.locator("video").count(),
    0,
    "An empty media stream stays a camera-off tile",
  );
  await page.evaluate(() => window.startVideo());
  await page.locator("video").waitFor();
  await page.evaluate(() => window.stopVideo());
  await page.locator("video").waitFor({state:"detached",timeout:3000});
  assert.equal(
    await page.locator("video").count(),
    0,
    "Ended host tracks return to camera-off state",
  );
  await page.getByRole("button", { name: "Captions", exact: true }).click();
  await page
    .getByRole("button", { name: "Spotlight Sam Chen", exact: true }).first()
    .click();
  await geometry("final camera-off pinned room");
  assert.deepEqual(errors, []);
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(
      `${out}/call-stage-states.json`,
      JSON.stringify({ results, errors }, null, 2),
    );
    await page.screenshot({ path: `${out}/call-pinned.png` });
  }
  console.log(
    `${results.length} meeting layouts, empty streams and ended video tracks pass.`,
  );
} finally {
  await browser.close();
}
