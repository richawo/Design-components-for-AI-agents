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
const fixture = async (slug, code) => mountFixture(page, slug, "pro", code);
try {
  await fixture(
    "data-query-builder",
    `window.applied=[];createRoot(document.getElementById('root')).render(<Subject.QueryBuilder onApply={async(q,ids)=>{window.applied.push(ids);throw Error('offline')}}/>);`,
  );
  assert.match(
    await page.getByRole("status").first().innerText(),
    /3 matching records/,
  );
  await page.getByRole("textbox", { name: "Value for condition 2" }).fill("20");
  assert.match(
    await page.getByRole("status").first().innerText(),
    /2 matching records/,
  );
  await page.getByRole("button", { name: "Use segment" }).click();
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => window.applied), [
    ["cedar", "orbit"],
  ]);
  assert.match(
    await page.getByRole("status").last().innerText(),
    /could not be applied/,
  );
  await page
    .getByRole("textbox", { name: "Value for condition 2" })
    .fill("Infinity");
  assert.equal(
    await page.getByRole("button", { name: "Use segment" }).isDisabled(),
    true,
  );
  assert.equal(await page.getByText("Enter a finite number.").count(), 1);
  await page.getByRole("textbox", { name: "Value for condition 2" }).fill("");
  assert.match(
    await page.getByRole("status").first().innerText(),
    /Complete the conditions/,
  );
  await page.getByRole("button", { name: "Remove condition 2" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: /Add condition/ })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Remove condition 1" }).click();
  assert.match(
    await page.getByRole("status").first().innerText(),
    /5 matching records/,
  );
  await fixture(
    "data-query-builder",
    `createRoot(document.getElementById('root')).render(<Subject.QueryBuilder fields={[{id:'constructor',label:'Reserved key',type:'text'}]} records={[{id:'1',label:'No inherited values',values:{}}]} defaultValue={{match:'all',rules:[{id:'r',field:'constructor',operator:'contains',value:'function'}]}}/>);`,
  );
  assert.match(
    await page.getByRole("status").first().innerText(),
    /0 matching records/,
  );
  assert.deepEqual(errors, []);
  console.log("Pro industry workflows: behavioral regression checks passed.");
} finally {
  await browser.close();
}
