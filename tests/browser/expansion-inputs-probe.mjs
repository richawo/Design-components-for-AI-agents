import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await mountFixture(
    page,
    "input-number-stepper",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={1} step={0.1} defaultValue={0.9}/>);`,
  );
  const spin = page.getByRole("spinbutton");
  await spin.focus();
  await page.keyboard.press("ArrowUp");
  assert.equal(await spin.inputValue(), "1");
  assert.equal(
    await page.getByRole("button", { name: /Increase/ }).isDisabled(),
    true,
  );
  await spin.fill("not a number");
  await page.keyboard.press("Enter");
  assert.equal(await spin.inputValue(), "1");
  await spin.fill("-99");
  await page.keyboard.press("Enter");
  assert.equal(await spin.inputValue(), "0");
  await page.keyboard.press("End");
  assert.equal(await spin.inputValue(), "1");
  await mountFixture(
    page,
    "input-number-stepper",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={1e-9} step={1e-12} defaultValue={0}/>);`,
  );
  await page.getByRole("spinbutton").focus();
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.getByRole("spinbutton").inputValue(), "1e-12");
  await mountFixture(
    page,
    "input-number-stepper",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={1e308} step={9e307} defaultValue={9e307}/>);`,
  );
  await page.getByRole("spinbutton").focus();
  await page.keyboard.press("ArrowUp");
  assert.equal(Number(await page.getByRole("spinbutton").inputValue()), 1e308);
  await mountFixture(
    page,
    "input-tag-editor",
    "free",
    `window.values=[];createRoot(document.getElementById('root')).render(<Subject.TagEditor defaultValue={[]} maxTags={2} onChange={v=>window.values.push(v)}/>);`,
  );
  const tags = page.getByRole("textbox");
  await tags.fill("Cedar,cedar,River,Overflow");
  await tags.press("Enter");
  assert.deepEqual(await page.evaluate(() => window.values.at(-1)), [
    "Cedar",
    "River",
  ]);
  assert.equal(await tags.isEditable(), false, "The full topic field prevents additional typing");
  await page.getByRole("button", { name: "Remove Cedar", exact: true }).click();
  assert.equal(await tags.evaluate((e) => e === document.activeElement), true);
  assert.equal(await tags.isEditable(), true, "Removing a topic makes room for entry");
  await tags.fill("文");
  await tags.dispatchEvent("keydown", { key: "Enter", isComposing: true });
  assert.equal(await tags.inputValue(), "文");
  assert.deepEqual(await page.evaluate(() => window.values.at(-1)), ["River"]);
  await tags.press("Enter");
  assert.deepEqual(await page.evaluate(() => window.values.at(-1)), ["River", "文"]);
  await mountFixture(
    page,
    "input-password-checklist",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.PasswordChecklist/>);`,
  );
  const password = page.getByLabel("Choose a password", { exact: true });
  await password.fill("Cedar-river42!");
  assert.match(await page.getByRole("status").innerText(), /3 of 3/);
  await page.getByRole("button", { name: "Show password" }).click();
  assert.equal(await password.getAttribute("type"), "text");
  await mountFixture(
    page,
    "feedback-inline-alert",
    "free",
    `window.calls=0;window.finish=null;createRoot(document.getElementById('root')).render(<Subject.InlineAlert onAction={()=>{window.calls++;return new Promise((_,reject)=>{window.finish=reject})}}/>);`,
  );
  await page.getByRole("button", { name: "Open archive" }).click();
  assert.equal(
    await page.getByRole("button", { name: /Working/ }).isDisabled(),
    true,
  );
  await page.evaluate(() => window.finish(new Error("network")));
  await page.waitForTimeout(100);
  assert.match(await page.getByRole("status").innerText(), /could not/);
  assert.equal(await page.evaluate(() => window.calls), 1);
  await mountFixture(
    page,
    "navigation-breadcrumb-fold",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.BreadcrumbFold/>);`,
  );
  await page.getByRole("button", { name: "Show full path" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Collapse path" })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Collapse path" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Show full path" })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await mountFixture(
    page,
    "selects-radio-cards",
    "free",
    `createRoot(document.getElementById('root')).render(<><Subject.RadioCards/><Subject.RadioCards/></>);`,
  );
  const radios = page.getByRole("radio");
  await radios.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await radios.nth(1).isChecked(), true);
  assert.equal(await radios.nth(4).isChecked(), true);
  assert.deepEqual(errors, []);
  console.log(
    "Bounds, invalid edits, tag limits and IME, password reveal, async failure, focus restoration and independent native radio groups passed.",
  );
} finally {
  await browser.close();
}
