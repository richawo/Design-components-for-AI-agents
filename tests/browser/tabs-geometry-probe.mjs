import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";

const base = process.env.PREVIEW_BASE || "http://localhost:3100";
const out = process.env.POLISH_OUT;
if (out) fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

async function aligned() {
  const error = await page.evaluate(() => {
    const tab = document.querySelector("[role=tab][aria-selected=true]");
    const label =
      tab.firstElementChild.firstElementChild.getBoundingClientRect();
    const line = document
      .querySelector("[role=tablist] > span")
      .getBoundingClientRect();
    return Math.max(
      Math.abs(label.left - line.left),
      Math.abs(label.right - line.right),
    );
  });
  assert.ok(error < 0.25, `Underline differs from the label by ${error}px`);
}
try {
  await page.goto(`${base}/preview/tabs-underline-glide`);
  await page.waitForTimeout(1200);
  for (const width of [1000, 390, 320, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const value of ["overview", "deployments", "variables", "logs"]) {
      // Arrow navigation also exercises overflow scrolling without a mouse trying to move the strip.
      await page.locator(`[data-demo="tab-${value}"]`).focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(900);
      await aligned();
    }
  }
  const tab = page.getByRole("tab", { selected: true });
  await tab.hover();
  await page.mouse.down();
  await page.waitForTimeout(150);
  await aligned();
  await page.mouse.up();
  if (out) await page.screenshot({ path: `${out}/tabs-dark.png` });
  await mountFixture(
    page,
    "tabs-underline-glide",
    "free",
    `
    const tabs=[{value:'a',label:'A fractional label',content:<p>First panel</p>},{value:'b',label:'Not available',disabled:true,content:<p>Disabled</p>},{value:'c',label:'A longer destination',count:13,content:<p>Last panel</p>}];
    createRoot(document.getElementById('root')).render(<div style={{transform:'scale(.8)',transformOrigin:'top left',background:'#fff',padding:16}}><Subject.TabsUnderlineGlide theme="light" activation="manual" items={tabs}/></div>);
  `,
  );
  await aligned();
  await page
    .getByRole("tab", { name: "A fractional label", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "A longer destination13",
  );
  assert.equal(
    await page.getByRole("tab", { selected: true }).textContent(),
    "A fractional label",
  );
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  await aligned();
  assert.equal(await page.getByRole("tabpanel").textContent(), "Last panel");
  if (out) await page.screenshot({ path: `${out}/tabs-scaled-light.png` });
  await mountFixture(
    page,
    "tabs-underline-glide",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.TabsUnderlineGlide items={[{value:'short',label:'Short',content:<div style={{height:120}}><button>Short action</button></div>},{value:'tall',label:'Tall',content:<div style={{height:440}}><button>Tall action</button></div>}]}/>);`,
  );
  const heights = [];
  const panelBox = page.getByRole("tabpanel").locator("..");
  const start = (await panelBox.boundingBox()).height;
  await page.getByRole("tab", { name: "Tall", exact: true }).click();
  assert.equal(await page.getByRole("tabpanel").count(), 1);
  assert.equal(
    await page.getByRole("button", { name: "Short action" }).count(),
    0,
  );
  for (let i = 0; i < 10; i++) {
    heights.push((await panelBox.boundingBox()).height);
    await page.waitForTimeout(35);
  }
  assert.ok(
    heights.some((height) => height > start + 2 && height < 458),
    "Panel height must pass through intermediate sizes",
  );
  assert.ok(
    Math.abs(heights.at(-1) - 460) < 1,
    "The panel settles at its measured content height",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mountFixture(
    page,
    "tabs-underline-glide",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.TabsUnderlineGlide activation="manual"/>);`,
  );
  await page.getByRole("tab", { selected: true }).focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  await aligned();
  assert.deepEqual(errors, []);
  console.log(
    "Tab geometry passes across scrolling, resizing, held presses, fractional scale, manual keyboard activation, measured panel heights and inert exits.",
  );
} finally {
  await browser.close();
}
