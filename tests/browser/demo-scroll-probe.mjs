import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";

const evidence = process.env.DFA_DEMO_SCROLL_EVIDENCE;
if (evidence) {
  assert.match(evidence, /^test-results\/[a-z0-9/-]+$/);
  assert.ok(!fs.existsSync(evidence), "Preserve previous scroll evidence");
  fs.mkdirSync(evidence, { recursive: true });
}
const browser = await launchChromium({ args: [] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
const errors = [], cases = [], captures = [];
let currentCase, failure;
page.on("pageerror", error => errors.push(error.message));
await page.exposeFunction("saveDemoScrollFrame", async suffix => {
  if (!evidence) return;
  const file = `${evidence}/${currentCase}-${suffix}.png`;
  await page.screenshot({ path: file });
  captures.push(file);
});
async function mount(slug, content) {
  await mountFixture(page, slug, "pro", `
    import {DemoPlayer} from './lib/demo/player';
    import {parseSteps} from './lib/demo/schema.mjs';
    import {gallerySteps} from './scripts/lib/recording-quality.mjs';
    createRoot(document.getElementById('root')).render(${content});
    const state=()=>({windowY:scrollY,
      panelY:document.querySelector('[data-demo="outline-passage"]')?.scrollTop,
      progress:Number(document.querySelector('.tof-root')?.getAttribute('data-progress')),
      resetDisabled:document.querySelector('[data-demo="outline-reset"]')?.disabled,
      innerY:document.querySelector('[data-demo="inner"]')?.scrollTop,
      outerY:document.querySelector('[data-demo="outer"]')?.scrollTop});
    window.playScrollDemo=async steps=>{
      window.scrollReplay=[];
      const player=new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},new AbortController().signal);
      const run=player.run.bind(player);let scrolls=0;
      player.run=async step=>{const before=state();await run(step);window.scrollReplay.push({step,before,after:state()});
        if(step.cmd==='scroll')await window.saveDemoScrollFrame('scroll-'+(++scrolls));};
      await player.play(gallerySteps(parseSteps(steps)));return {states:window.scrollReplay,ending:state()};
    };
  `, { frameStyle: "width:100%;min-height:100vh" });
  await page.waitForTimeout(3200);
}
const metadata = slug => JSON.parse(fs.readFileSync(`registry/pro/${slug}/meta.json`)).demo.steps;
try {
  currentCase = "window-control";
  await mount("scroll-background-wipe", "<Subject.default/>");
  const windowReplay = await page.evaluate(steps => window.playScrollDemo(steps), metadata("scroll-background-wipe"));
  cases.push({ name: currentCase, ...windowReplay });
  assert.ok(windowReplay.states.some(state => state.step.cmd === "scroll" && state.after.windowY > 400), "Window scrolling still advances the actual page demo");

  for (const theme of ["dark", "light"]) {
    currentCase = "outline-" + theme;
    await mount("text-outline-fill", `<Subject.default theme="${theme}"/>`);
    const replay = await page.evaluate(steps => window.playScrollDemo(steps), metadata("text-outline-fill"));
    cases.push({ name: currentCase, ...replay });
    const scrolls = replay.states.filter(state => state.step.cmd === "scroll");
    assert.equal(scrolls.length, 2);
    for (const state of scrolls) {
      assert.ok(state.after.panelY > state.before.panelY, `${theme} metadata scroll advances its essay panel`);
      assert.ok(state.after.progress > state.before.progress, `${theme} ink fill follows reading progress`);
      assert.equal(state.after.windowY, 0, "The document stays fixed around its scrolling panel");
    }
    const reset = replay.states.find(state => state.step.target?.name === "outline-reset");
    assert.equal(reset.before.resetDisabled, false, "The scripted return action is enabled after reading");
    // The component retires its return action within four pixels of the top.
    assert.ok(replay.ending.panelY <= 4);
    assert.ok(Math.abs(replay.ending.progress - replay.states[0].before.progress) <= 1);
    assert.equal(replay.ending.resetDisabled, true, "Return to top completes and retires its action");
    await page.evaluate(() => window.saveDemoScrollFrame("ending"));
  }

  for (const scenario of ["inner-down", "inner-up", "chain-at-boundary", "contain-at-boundary"]) {
    currentCase = scenario;
    const containment = scenario === "contain-at-boundary" ? "contain" : "auto";
    await mount("text-outline-fill", `<div style={{minHeight:1900}}>
      <div data-demo="outer" style={{position:'absolute',top:80,left:100,width:320,height:200,overflowY:'auto'}}>
        <div data-demo="inner" style={{height:120,overflowY:'auto',overscrollBehaviorY:'${containment}'}}>
          <div style={{height:600}}>Essay detail</div>
        </div><div style={{height:600}}>Outer content</div>
      </div></div>`);
    await page.locator('[data-demo="inner"]').evaluate((node, scenario) => {
      node.scrollTop = scenario.includes("boundary") ? node.scrollHeight - node.clientHeight : scenario === "inner-up" ? 180 : 0;
    }, scenario);
    const replay = await page.evaluate(steps => window.playScrollDemo(steps), ["hover:@inner", `scroll:${scenario === "inner-up" ? -120 : 120}`]);
    cases.push({ name: currentCase, ...replay });
    assert.equal(replay.ending.windowY, 0);
    if (scenario === "chain-at-boundary") assert.ok(replay.ending.outerY > 0, "An exhausted panel chains to its scrollable parent");
    else {
      assert.equal(replay.ending.outerY, 0);
      assert.equal(replay.ending.innerY, scenario === "inner-up" ? 60 : scenario === "inner-down" ? 120 : 480);
    }
  }
  assert.deepEqual(errors, []);
  console.log("PASS demo scrolling: window, both essay themes, nested panels and containment");
} catch (error) {
  failure = error.stack;
  if (evidence) await page.screenshot({ path: `${evidence}/failure.png` });
  throw error;
} finally {
  if (evidence) fs.writeFileSync(`${evidence}/proof.json`, JSON.stringify({ passed: !failure, failure, currentCase, errors, cases, captures }, null, 2) + "\n");
  await browser.close();
}
