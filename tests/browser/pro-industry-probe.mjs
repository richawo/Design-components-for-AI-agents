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
  await page.waitForFunction(
    () =>
      document.activeElement?.matches("button") &&
      document.activeElement.textContent?.includes("Add condition"),
  );
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
  await page.getByRole("combobox", { name: /column 3/ }).click();
  await page.getByRole("option", { name: "Skip column", exact: true }).click();
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
  await fixture(
    "commerce-variant-stock",
    `window.saves=[];window.attempt=0;createRoot(document.getElementById('root')).render(<Subject.VariantStock onSave={async rows=>{window.saves.push(rows);if(window.attempt++===0)throw Error('offline')}}/>);`,
  );
  const stock = page.getByRole("spinbutton", {
    name: "Ink / XL stock",
    exact: true,
  });
  await stock.fill("12");
  await page.getByRole("button", { name: "Save stock" }).click();
  await page.waitForTimeout(100);
  assert.match(
    await page.getByRole("status").innerText(),
    /could not be saved/,
  );
  assert.equal(await stock.inputValue(), "12");
  await page.getByRole("button", { name: "Save stock" }).click();
  await page.waitForTimeout(100);
  assert.match(await page.getByRole("status").innerText(), /levels saved/);
  assert.equal(await page.evaluate(() => window.saves[1][0].stock.xl), 12);
  assert.equal(
    await page.getByRole("button", { name: "Save stock" }).isDisabled(),
    true,
  );
  await stock.fill("1.5");
  assert.equal(
    await page.getByRole("button", { name: "Save stock" }).isDisabled(),
    true,
  );
  assert.match(await page.getByRole("alert").innerText(), /whole number/);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  assert.equal(
    await stock.inputValue(),
    "12",
    "reset returns to the last acknowledged save",
  );
  await fixture(
    "finance-reconciliation",
    `window.matches=[];window.attempt=0;createRoot(document.getElementById('root')).render(<Subject.Reconciliation onMatch={async match=>{window.matches.push(match);if(window.attempt++===0)throw Error('offline')}}/>);`,
  );
  // A manual split match is made by picking a statement line and its ledger entries.
  await page.locator('[data-demo="statement-s6"]').click();
  await page.locator('[data-demo="ledger-l6"]').click();
  const match = page.getByRole("button", { name: "Match", exact: true });
  assert.equal(await match.isDisabled(), true, "A partial amount cannot be matched");
  await page.locator('[data-demo="ledger-l7"]').click();
  assert.equal(await match.isEnabled(), true);
  await match.click();
  await page.getByText("Nothing was saved", { exact: true }).waitFor();
  assert.match(await page.locator("section").innerText(), /offline Your selection is kept/);
  assert.equal(await page.locator('[data-demo="statement-s6"]').getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator('[data-demo="ledger-l6"]').getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator('[data-demo="ledger-l7"]').getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.waitForFunction(() => window.matches.length === 2);
  assert.deepEqual(await page.evaluate(() => window.matches[1]), {
    statementId: "s6", ledgerIds: ["l6", "l7"], source: "manual",
  });
  await page.waitForFunction(() => document.querySelector('[data-demo="statement-s6"]')?.getAttribute("aria-label")?.startsWith("Matched statement"));
  assert.match(await page.locator('[data-demo="ledger-l6"]').getAttribute("aria-label"), /^Matched ledger/);
  await fixture(
    "finance-reconciliation",
    `createRoot(document.getElementById('root')).render(<Subject.Reconciliation statement={[{id:'max',description:'Exact large amount',date:'2026-09-30',amountMinor:9007199254740991}]} ledger={[]} defaultMatches={[]}/>);`,
  );
  assert.match(await page.locator("section").innerText(), /90,071,992,547,409.91/);
  for (const [currency, amountMinor, major] of [["JPY", 1234, 1234], ["BHD", 1234, 1.234], ["GBP", -5, 0.05]]) {
    await fixture("finance-reconciliation", `createRoot(document.getElementById('root')).render(<Subject.Reconciliation currency="${currency}" statement={[{id:'unit',description:'Currency unit check',date:'2026-09-30',amountMinor:${amountMinor}}]} ledger={[]} defaultMatches={[]}/>);`);
    const expected = await page.evaluate(({currency,major}) => new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(major), {currency,major});
    assert.ok((await page.locator("section").innerText()).includes(expected), `${currency} respects its own minor units`);
    if (amountMinor < 0) assert.ok((await page.locator("section").innerText()).includes(`−${expected}`));
  }
  await fixture(
    "hr-capacity-planner",
    `window.plans=[];createRoot(document.getElementById('root')).render(<Subject.CapacityPlanner onSave={async value=>{window.plans.push(value);throw Error('offline')}}/>);`,
  );
  await page.getByRole("button", { name: "Add 2 hours" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Save plan" }).isEnabled(),
    true,
  );
  await page.getByRole("button", { name: "Add 2 hours" }).click();
  assert.match(await page.getByRole("alert").innerText(), /over-capacity/);
  assert.equal(
    await page.getByRole("button", { name: "Save plan" }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Remove allocation 4" }).click();
  await page.getByRole("button", { name: "Save plan" }).click();
  await page.waitForTimeout(100);
  assert.match(
    await page.getByRole("status").innerText(),
    /could not be saved/,
  );
  assert.equal(await page.evaluate(() => window.plans[0].length), 8);
  await page
    .getByRole("spinbutton", { name: "Hours for allocation 1" })
    .fill("0.1");
  assert.equal(
    await page.getByRole("button", { name: "Save plan" }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  assert.equal(await page.getByRole("spinbutton").count(), 2);
  await fixture(
    "legal-version-history",
    `window.diff=Subject.compareRevisions;window.restored=[];createRoot(document.getElementById('root')).render(<Subject.VersionHistory onRestore={async revision=>{window.restored.push(revision.id);throw Error('offline')}}/>);`,
  );
  const lines = await page.evaluate(() => window.diff("A\nB\nA", "A\nA\nC"));
  assert.equal(
    lines
      .filter((line) => line.kind !== "added")
      .map((line) => line.text)
      .join("\n"),
    "A\nB\nA",
  );
  assert.equal(
    lines
      .filter((line) => line.kind !== "removed")
      .map((line) => line.text)
      .join("\n"),
    "A\nA\nC",
  );
  assert.equal(
    await page.evaluate(() => window.diff("x".repeat(100001), "x")),
    null,
  );
  assert.equal(
    await page.evaluate(() =>
      window.diff(Array(401).fill("x").join("\n"), "x"),
    ),
    null,
  );
  await page.getByRole("button", { name: "Restore this revision" }).click();
  assert.deepEqual(await page.evaluate(() => window.restored), []);
  await page.getByRole("button", { name: "Confirm restore" }).click();
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => window.restored), ["r2"]);
  assert.match(
    await page.getByRole("status").innerText(),
    /Restoration failed/,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.activeElement?.matches("button") &&
      document.activeElement.textContent?.includes("Restore this revision"),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Restore this revision" })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: /Revision 3 CURRENT/ }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Restore this revision" })
      .isDisabled(),
    true,
  );
  await fixture(
    "app-permission-matrix",
    `window.policies=[];createRoot(document.getElementById('root')).render(<Subject.PermissionMatrix onSave={async grants=>{window.policies.push(grants);throw Error('offline')}}/>);`,
  );
  await page
    .getByRole("checkbox", {
      name: "Approve revisions for Reviewer",
      exact: true,
    })
    .check();
  assert.equal(
    await page
      .getByRole("checkbox", {
        name: "View documents for Reviewer",
        exact: true,
      })
      .isChecked(),
    true,
  );
  assert.equal(
    await page
      .getByRole("checkbox", {
        name: "Edit documents for Reviewer",
        exact: true,
      })
      .isChecked(),
    true,
  );
  await page.getByRole("button", { name: "Save policy" }).click();
  await page.waitForTimeout(100);
  assert.match(
    await page.getByRole("status").innerText(),
    /could not be saved/,
  );
  assert.deepEqual(
    (await page.evaluate(() => window.policies[0].reviewer)).sort(),
    ["approve", "edit", "view"],
  );
  await page
    .getByRole("checkbox", { name: "View documents for Reviewer", exact: true })
    .uncheck();
  assert.equal(
    await page
      .getByRole("checkbox", {
        name: "Edit documents for Reviewer",
        exact: true,
      })
      .isChecked(),
    false,
  );
  assert.equal(
    await page
      .getByRole("checkbox", {
        name: "Approve revisions for Reviewer",
        exact: true,
      })
      .isChecked(),
    false,
  );
  assert.equal(
    await page
      .getByRole("checkbox", { name: "View documents for Owner", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("checkbox", { name: "View documents for Owner", exact: true })
      .isChecked(),
    true,
  );
  await fixture(
    "app-permission-matrix",
    `createRoot(document.getElementById('root')).render(<Subject.PermissionMatrix permissions={[{id:'a',name:'A',group:'Test',description:'A',requires:['b']},{id:'b',name:'B',group:'Test',description:'B',requires:['a']}]}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /cycle/);
  assert.equal(
    await page.getByRole("button", { name: "Save policy" }).isDisabled(),
    true,
  );
  // Rebuilt workflow: commerce-return-desk. The dedicated case retains the original edge checks.
  await page.setViewportSize({ width: 390, height: 844 });
  await (await import('./pro-50/commerce-return-desk.mjs')).check({ page, assert, mount: code => fixture('commerce-return-desk', code) });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.deepEqual(errors, []);
  console.log("Pro industry workflows: behavioral regression checks passed.");
} finally {
  await browser.close();
}
