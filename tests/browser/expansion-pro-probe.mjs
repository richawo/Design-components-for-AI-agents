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
async function choose(control) {
  await control.focus();
  await page.keyboard.press("Space");
}
async function fixture(slug, code) {
  await mountFixture(page, slug, "pro", code);
}
try {
  await fixture(
    "input-file-dropzone",
    `window.files=[];createRoot(document.getElementById('root')).render(<Subject.FileDropzone accept=".txt," maxBytes={4} maxFiles={2} onChange={v=>window.files=v.map(f=>f.name)}/>);`,
  );
  await page
    .locator("input[type=file]")
    .setInputFiles([
      { name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("abc") },
    ]);
  assert.deepEqual(await page.evaluate(() => window.files), ["note.txt"]);
  await page
    .locator("input[type=file]")
    .setInputFiles([
      { name: "bad.exe", mimeType: "", buffer: Buffer.from("ab") },
    ]);
  assert.match(await page.getByRole("status").innerText(), /unsupported type/);
  await page.locator("input[type=file]").setInputFiles([
    {
      name: "large.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("abcde"),
    },
  ]);
  assert.match(await page.getByRole("status").innerText(), /too large/);
  assert.deepEqual(await page.evaluate(() => window.files), ["note.txt"]);
  await fixture(
    "input-shortcut-recorder",
    `window.keys=[];createRoot(document.getElementById('root')).render(<Subject.ShortcutRecorder onChange={v=>window.keys=v}/>);`,
  );
  await page.getByRole("button", { name: /Record shortcut/ }).click();
  await page.keyboard.press("Control+Shift+Y");
  assert.deepEqual(await page.evaluate(() => window.keys), [
    "Control",
    "Shift",
    "Y",
  ]);
  await page.getByRole("button", { name: /Record shortcut/ }).click();
  await page.keyboard.press("Escape");
  assert.deepEqual(await page.evaluate(() => window.keys), [
    "Control",
    "Shift",
    "Y",
  ]);
  await fixture(
    "date-booking-slots",
    `function Fixture(){const [props,setProps]=useState({});window.patch=setProps;return <Subject.BookingSlots {...props}/>};createRoot(document.getElementById('root')).render(<Fixture/>);`,
  );
  await choose(page.getByRole("radio", { name: "10:30", exact: true }));
  assert.match(await page.getByRole("status").innerText(), /10:30 selected/);
  await page.evaluate(() =>
    window.patch({
      days: [
        {
          id: "2026-10-12",
          weekday: "Mon",
          day: "12",
          month: "October",
          slots: [{ id: "1030", label: "10:30", available: false }],
        },
      ],
    }),
  );
  await page.waitForTimeout(100);
  assert.equal(
    await page.getByRole("radio").isChecked(),
    false,
    "a newly unavailable slot loses its selection",
  );
  await page.evaluate(() =>
    window.patch({
      days: [
        { id: "new", weekday: "Fri", day: "16", month: "October", slots: [] },
      ],
    }),
  );
  await page.waitForTimeout(100);
  assert.match(
    await page.getByRole("status").innerText(),
    /Choose an available time/,
  );
  assert.equal(await page.getByRole("radio").count(), 0);
  await page.setViewportSize({ width: 320, height: 844 });
  await fixture(
    "date-week-agenda",
    `createRoot(document.getElementById('root')).render(<Subject.WeekAgenda/>);`,
  );
  const weekdayLines = await page
    .locator('[data-demo^="agenda-day-"] > span:last-child')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return range.getClientRects().length;
      }),
    );
  assert.equal(weekdayLines.length, 5);
  assert.ok(
    weekdayLines.every((count) => count === 1),
    "weekday abbreviations stay on one line at 320px",
  );
  await fixture(
    "chart-waterfall-bridge",
    `createRoot(document.getElementById('root')).render(<Subject.WaterfallBridge/>);`,
  );
  const barTops = await page
    .locator('[data-demo^="bridge-"] > span[aria-hidden="true"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().top),
    );
  assert.equal(barTops.length, 6);
  assert.ok(
    Math.max(...barTops) - Math.min(...barTops) < 1,
    "every bar uses the same vertical scale origin",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(
    "forms-preference-center",
    `window.saved=[];createRoot(document.getElementById('root')).render(<Subject.PreferenceCenter onSave={async v=>{window.saved=v;throw Error('offline')}}/>);`,
  );
  assert.equal(await page.getByRole("checkbox").first().isDisabled(), true);
  await choose(page.getByRole("checkbox").nth(2));
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.waitForTimeout(100);
  assert.match(
    await page.getByRole("status").innerText(),
    /could not be saved/,
  );
  assert.deepEqual(await page.evaluate(() => window.saved), [
    "essential",
    "digest",
    "product",
  ]);
  await fixture(
    "data-kanban-compact",
    `window.cards=[];createRoot(document.getElementById('root')).render(<Subject.CompactKanban selectMode="native" defaultItems={[{id:'constructor',title:'Safe object key',description:'Move me',columnId:'ready',owner:'Jo'}]} onChange={v=>window.cards=v}/>);`,
  );
  await page.getByRole("combobox").selectOption("working");
  assert.equal(await page.evaluate(() => window.cards[0].columnId), "working");
  assert.equal(
    await page
      .getByRole("combobox")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await fixture(
    "devtools-json-inspector",
    `const cyclic={name:'cycle'};cyclic.self=cyclic;createRoot(document.getElementById('root')).render(<Subject.JsonInspector data={cyclic}/>);`,
  );
  assert.match(await page.locator("main").innerText(), /Circular/);
  await fixture(
    "devtools-json-inspector",
    `const leaf={a:1,b:2,c:3};const shared=Object.fromEntries(Array.from({length:100},(_,i)=>[i,leaf]));createRoot(document.getElementById('root')).render(<Subject.JsonInspector data={{a:shared,b:shared,c:shared}}/>);`,
  );
  assert.ok((await page.locator("li").count()) <= 501);
  assert.match(
    await page.getByRole("status").innerText(),
    /Display limit reached/,
  );
  await page.getByRole("button", { name: "Collapse a", exact: true }).click();
  await page.getByRole("button", { name: "Collapse b", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Collapse c", exact: true })
      .isVisible(),
    true,
  );
  assert.equal(await page.getByRole("status").count(), 0);

  await fixture(
    "devtools-request-waterfall",
    `createRoot(document.getElementById('root')).render(<Subject.RequestWaterfall/>);`,
  );
  const track = page.locator("[data-demo=request-2] > span[aria-hidden=true]");
  assert.ok(
    (await track.boundingBox()).width > 150,
    "timing track remains full width on mobile",
  );
  await fixture(
    "media-before-after",
    `createRoot(document.getElementById('root')).render(<Subject.BeforeAfter/>);`,
  );
  const slider = page.getByRole("slider");
  await slider.focus();
  await page.keyboard.press("Home");
  assert.equal(await slider.inputValue(), "0");
  await page.keyboard.press("End");
  assert.equal(await slider.inputValue(), "100");
  await fixture(
    "chart-waterfall-bridge",
    `createRoot(document.getElementById('root')).render(<Subject.WaterfallBridge opening={1e308} changes={[{label:'Huge',amount:1e308}]}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /numeric range/);
  await fixture(
    "content-release-notes",
    `createRoot(document.getElementById('root')).render(<Subject.ReleaseNotes/>);`,
  );
  await page.getByRole("button", { name: "Fixes", exact: true }).click();
  assert.equal(
    await page
      .getByText("A focused reading view for longer documents.")
      .count(),
    0,
  );
  await page.getByRole("button", { name: /Show 1 older/ }).click();
  assert.equal(await page.getByRole("article").count(), 3);
  assert.deepEqual(errors, []);
  console.log(
    "File validation, shortcut capture, stale booking data, failed preferences, board focus, circular/bounded JSON, mobile timing tracks, comparison keyboard bounds, chart overflow and release filtering passed.",
  );
} finally {
  await browser.close();
}
