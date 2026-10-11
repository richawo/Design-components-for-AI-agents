import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";

const browser = await launchChromium();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  await mountFixture(page, "input-tag-editor", "free", `
    import { DemoPlayer } from './lib/demo/player';
    import { parseSteps } from './lib/demo/schema.mjs';
    function Fields() {
      const [value,setValue]=useState('10');
      return <><input aria-label="Editable" data-demo="edit" value={value} onChange={event=>{setValue(event.target.value);window.changed=event.target.value}}/>
        <input aria-label="Read only" readOnly value="fixed"/>
        <input aria-label="Prevented" defaultValue="stay" onKeyDown={event=>event.preventDefault()}/>
        <input aria-label="Bounded" defaultValue="abc" maxLength={3}/>
        <textarea aria-label="Multiline" defaultValue={'First\\nSecond'}/></>;
    }
    createRoot(document.getElementById('root')).render(<Fields/>);
    window.play=steps=>new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},new AbortController().signal).play(parseSteps(steps));
  `);
  const editable = page.getByRole("textbox", { name: "Editable", exact: true });
  await editable.focus();
  await page.evaluate(() => window.play(["key:End", "key:Backspace", "key:Backspace", "type:20"]));
  assert.equal(await editable.inputValue(), "20");
  assert.equal(await page.evaluate(() => window.changed), "20", "React receives the same editing input as the recorded demo");
  await editable.evaluate(el => el.setSelectionRange(0, 2));
  await page.evaluate(() => window.play(["key:Delete", "type:abc", "key:Home", "key:Delete"]));
  assert.equal(await editable.inputValue(), "bc");
  for (const [label, expected] of [["Read only", "fixed"], ["Prevented", "stay"]]) {
    const field = page.getByRole("textbox", { name: label, exact: true });
    await field.focus();
    await page.evaluate(() => window.play(["key:End", "key:Backspace", "type:x"]));
    assert.equal(await field.inputValue(), expected);
  }
  await editable.focus();
  await editable.evaluate(el => el.addEventListener("beforeinput", event => event.preventDefault()));
  await page.evaluate(() => window.play(["key:End", "key:Backspace", "type:x"]));
  assert.equal(await editable.inputValue(), "bc");
  const bounded = page.getByRole("textbox", { name: "Bounded", exact: true });
  await bounded.focus();
  await page.evaluate(() => window.play(["key:End", "type:x"]));
  assert.equal(await bounded.inputValue(), "abc");
  const multiline = page.getByRole("textbox", { name: "Multiline", exact: true });
  await multiline.focus();
  await multiline.evaluate(el => el.setSelectionRange(el.value.length, el.value.length));
  await page.evaluate(() => window.play(["key:Home", "key:Delete", "key:End", "key:Backspace"]));
  assert.equal(await multiline.inputValue(), "First\necon");
  assert.deepEqual(errors, []);
  console.log("Demo editing: controlled values, selections, readonly fields, cancellation and length limits passed.");
} finally {
  await browser.close();
}
