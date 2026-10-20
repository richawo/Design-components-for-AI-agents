import { checkTable as checkCompactTable } from './review/financial-compact-values.mjs';
import { check as checkPhoneHeading } from './review/table-phone-heading.mjs';
import { checkTable } from './review/financial-number-formats.mjs';
import { check as checkReducedFigures } from './review/table-reduced-figures.mjs';
import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const b = await launchChromium();
const p = await b.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await mountFixture(
  p,
  "data-table-sortable",
  "free",
  `window.events=[];createRoot(document.getElementById('root')).render(<Subject.DataTableSortable columns={[{key:'name',header:'Name',kind:'entity',sortable:true},{key:'amount',header:'Amount',kind:'number',sortable:true}]} data={[{id:'a',name:'Alpha',amount:8},{id:'b',name:'Beta',amount:2}]} onSortChange={v=>window.events.push(['sort',v])} onSelectionChange={v=>window.events.push(['select',v])} />);`,
);
await p.locator('[data-demo="sort-amount"]').click();
assert.equal(
  (await p.evaluate(() => window.events)).filter((e) => e[0] === "sort").length,
  1,
);
await p.locator('[data-demo="select-all"]').click();
assert.deepEqual(
  (await p.evaluate(() => window.events))
    .filter((e) => e[0] === "select")
    .at(-1)[1]
    .sort(),
  ["a", "b"],
);
assert.deepEqual(errors, []);
console.log(
  "Typed custom rows, column sorting and select-all callback passed.",
);
try {
  await checkTable({page:p,assert,mount:code=>mountFixture(p,"data-table-sortable","free",code)});
  await checkCompactTable({page:p,assert,mount:code=>mountFixture(p,"data-table-sortable","free",code)});
  await checkReducedFigures({page:p,assert,mount:code=>mountFixture(p,"data-table-sortable","free",code)});
  const phone = await b.newPage({viewport:{width:320,height:1100},reducedMotion:'reduce',hasTouch:true,isMobile:true});
  phone.on('pageerror',error=>errors.push(error.message));
  try {
    for (const width of [320,390]) {
      await phone.setViewportSize({width,height:1100});
      for (const theme of ['dark','light']) {
        await checkPhoneHeading({page:phone,assert,mount:code=>mountFixture(phone,'data-table-sortable','free',
          code.replaceAll('<Subject.DataTableSortable',`<Subject.DataTableSortable theme="${theme}" `))});
      }
    }
  } finally { await phone.close(); }
  assert.deepEqual(errors, []);
} finally {
  await b.close();
}
