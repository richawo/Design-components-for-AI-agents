import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { createRecordTargetResolver } from "../../scripts/lib/record-target.mjs";
import { targetSelector } from "../../lib/demo/schema.mjs";

const out = process.env.RECORDING_TARGET_OUT ?? "test-results/recording-target";
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium({ args: [] });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const problems = [], evidence = [], errors = [];
page.on("pageerror", error => errors.push(error.message));
const pointOf = createRecordTargetResolver({ page, targetSelector, onProblem: problem => problems.push(problem) });
const button = '<button type="button" data-demo="finish" onclick="window.targetClicks++;document.getElementById(\'result\').textContent=\'Completion recorded\'" style="width:160px;height:48px">Record completion</button>';
async function fixture(content) {
  problems.length = 0;
  await page.setContent(`<!doctype html><html lang="en"><head><title>Recording target fixture</title></head><body style="margin:40px;background:#111;color:#fff;font:18px Arial"><h1>Recording target fixture</h1>${content}<p id="result">Waiting for completion</p><script>window.targetClicks=0</script></body></html>`);
}
const vertical = `<section data-scroll style="overflow:auto;width:300px;height:180px;border:1px solid #999"><div style="height:400px"></div>${button}</section>`;
async function click(name, at) {
  const point = await pointOf({ name: "finish", ...(at ? { at } : {}) });
  assert.ok(point, "A visible target resolves before the original deadline");
  await page.mouse.click(...point);
  assert.equal(await page.evaluate(() => window.targetClicks), 1, "Native click must reach the action");
  await page.getByText("Completion recorded", { exact: true }).waitFor();
  const state = await page.evaluate(point => ({ point, hit: document.elementFromPoint(...point)?.getAttribute("data-demo"),
    scrolls: [...document.querySelectorAll("[data-scroll]")].map(node => ({ left: node.scrollLeft, top: node.scrollTop })),
    target: document.elementFromPoint(...point).closest('[data-demo="finish"]').getBoundingClientRect().toJSON() }), point);
  assert.equal(state.hit, "finish"); evidence.push({ name, ...state });
  return state;
}

try {
  await fixture(vertical);
  assert.equal(await page.locator('[data-demo="finish"]').evaluate(node => node.getBoundingClientRect().bottom < innerHeight), true);
  const first = await click("vertical parent clips an in-viewport action");
  assert.ok(first.scrolls[0].top > 0);
  await page.screenshot({ path: path.join(out, "scrolled-completion.png") });

  await fixture('<section data-scroll style="overflow:scroll;width:270px;height:140px;border:1px solid #999"><div style="width:650px;padding-top:20px"><span style="display:inline-block;width:450px"></span>'+button+'</div></section>');
  const horizontal = await click("horizontal clipping", [.25, .7]);
  assert.ok(horizontal.scrolls[0].left > 0);
  assert.ok(Math.abs(horizontal.point[0] - horizontal.target.left - horizontal.target.width * .25) < 1);

  await fixture(`<section data-scroll style="overflow:auto;width:300px;height:200px;border:1px solid #999"><div style="width:700px;height:650px;padding:220px 0 0 250px;box-sizing:border-box"><div data-scroll style="overflow:auto;width:260px;height:160px"><div style="height:220px"></div>${button}</div></div></section>`);
  const nested = await click("nested scrolling parents");
  assert.equal(nested.scrolls.filter(scroll => scroll.top > 0).length, 2);

  await fixture(`<div style="height:1000px"></div>${button}`);
  await click("outside the document viewport");

  await fixture(`<div inert>${button}</div><div hidden>${button}</div>${button}`);
  await click("skip retired duplicate targets");

  // This executes the same native-click assertion with scrolling deliberately blocked.
  await fixture(vertical);
  await page.evaluate(() => { window.restoreTargetScroll = Element.prototype.scrollIntoView; Element.prototype.scrollIntoView = () => {}; });
  try { await assert.rejects(() => click("blocked scrolling"), /Native click must reach the action/); }
  finally { await page.evaluate(() => { Element.prototype.scrollIntoView = window.restoreTargetScroll; }); }
  assert.equal(await page.evaluate(() => window.targetClicks), 0);
  await page.screenshot({ path: path.join(out, "blocked-scroll-negative.png") });

  await fixture("<p>The action is unavailable.</p>");
  const missingStart = Date.now();
  assert.equal(await pointOf({ name: "finish" }), null);
  assert.ok(Date.now() - missingStart >= 2300, "Keep the original 2500ms settling deadline");
  assert.equal(problems.length, 1); assert.match(problems[0], /unavailable or still moving/);

  await fixture(button);
  await page.evaluate(() => { let x=0;const move=()=>{ document.querySelector('[data-demo="finish"]').style.transform=`translateX(${x=(x+2)%250}px)`;window.targetMotion=requestAnimationFrame(move); };window.targetMotion=requestAnimationFrame(move); });
  try {
    assert.equal(await pointOf({ name: "finish" }), null, "A continuously moving click target must not pass stability checks");
    assert.equal(problems.length, 1);
    const hover = await pointOf({ name: "finish" }, true);
    assert.ok(hover?.every(Number.isFinite), "Hover retains its explicit moving-target behavior");
  } finally { await page.evaluate(() => cancelAnimationFrame(window.targetMotion)); }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, "proof.json"), JSON.stringify({ evidence, blockedScrollNegativeRejected: true,
    missingAndMovingTargetsRejected: true, originalDeadlineMs: 2500, originalStableFrames: 2, originalTolerancePx: .5, errors }, null, 2) + "\n");
  console.log("PASS recorder targets: nested clipping, real clicks, offsets, retired targets, stability and blocked-scroll negative");
} finally { await browser.close(); }
