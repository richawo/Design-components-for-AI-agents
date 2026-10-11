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
  await fixture(
    "commerce-catalog-import",
    `window.parse=Subject.parseCatalogCsv;window.imported=[];createRoot(document.getElementById('root')).render(<Subject.CatalogImport onImport={async rows=>{window.imported.push(rows);throw Error('offline')}}/>);`,
  );
  const parsed = await page.evaluate(() =>
    window.parse(
      '\ufeffName,Note\r\n"Form, Studio","A ""quoted"" note\ncontinued"',
    ),
  );
  assert.deepEqual(parsed, {
    headers: ["Name", "Note"],
    rows: [["Form, Studio", 'A "quoted" note\ncontinued']],
  });
  for (const source of [
    'Name\n"unfinished',
    'Name\n"closed"junk',
    "Name\nextra,column",
  ]) {
    assert.equal(
      await page.evaluate((source) => {
        try {
          window.parse(source);
          return false;
        } catch {
          return true;
        }
      }, source),
      true,
    );
  }
  await page.getByRole("button", { name: "Read CSV" }).click();
  await page.getByRole("button", { name: "Review import" }).click();
  await page.getByRole("button", { name: "Import records" }).click();
  await page.waitForTimeout(100);
  assert.match(await page.getByRole("status").innerText(), /import failed/);
  assert.equal(await page.evaluate(() => window.imported[0][0].price), 89);
  assert.equal(
    await page.getByRole("button", { name: "Import records" }).isEnabled(),
    true,
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("combobox", { name: /column 3/ }).selectOption("");
  assert.match(
    await page.getByRole("alert").innerText(),
    /Map the required Unit price/,
  );
  assert.equal(
    await page.getByRole("button", { name: "Review import" }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page
    .getByRole("textbox")
    .fill("Product,SKU,Unit price,Supplier email\nTest,A,-1,no-email");
  await page.getByRole("button", { name: "Read CSV" }).click();
  assert.match(await page.getByRole("alert").innerText(), /at least 0/);
  assert.match(await page.getByRole("alert").innerText(), /valid email/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page
    .getByRole("textbox")
    .fill("Product,SKU,Unit price\nOne,SAME,10\nTwo,SAME,20");
  await page.getByRole("button", { name: "Read CSV" }).click();
  assert.match(await page.getByRole("alert").innerText(), /SKU must be unique/);
  await fixture("commerce-variant-stock", `window.saves=[];window.attempt=0;createRoot(document.getElementById('root')).render(<Subject.VariantStock onSave={async rows=>{window.saves.push(rows);if(window.attempt++===0)throw Error('offline')}}/>);`);
  const stock = page.getByRole("spinbutton", { name: "Ink / XL stock", exact: true });
  await stock.fill("12");
  await page.getByRole("button", { name: "Save stock" }).click();
  await page.waitForTimeout(100);
  assert.match(await page.getByRole("status").innerText(), /could not be saved/);
  assert.equal(await stock.inputValue(), "12");
  await page.getByRole("button", { name: "Save stock" }).click();
  await page.waitForTimeout(100);
  assert.match(await page.getByRole("status").innerText(), /levels saved/);
  assert.equal(await page.evaluate(() => window.saves[1][0].stock.xl), 12);
  assert.equal(await page.getByRole("button", { name: "Save stock" }).isDisabled(), true);
  await stock.fill("1.5");
  assert.equal(await page.getByRole("button", { name: "Save stock" }).isDisabled(), true);
  assert.match(await page.getByRole("alert").innerText(), /whole number/);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  assert.equal(await stock.inputValue(), "12", "reset returns to the last acknowledged save");
  assert.deepEqual(errors, []);
  console.log("Pro industry workflows: behavioral regression checks passed.");
} finally {
  await browser.close();
}
