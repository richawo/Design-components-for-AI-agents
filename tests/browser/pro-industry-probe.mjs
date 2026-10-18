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
const choose = async (locator, value) => {
  if (await locator.evaluate(node => node.tagName === 'SELECT')) return locator.selectOption(value);
  await locator.click();
  const id = await locator.getAttribute('aria-controls');
  const options = page.locator(`[id=${JSON.stringify(id)}] [role=option]`);
  const index = await options.evaluateAll((nodes, value) => nodes.findIndex(node => node.dataset.value === value), value);
  assert.ok(index >= 0, 'The destination field is available');
  await options.nth(index).click();
};
try {
  // Rebuilt workflow: data-query-builder. The dedicated case retains the original edge checks.
  await page.setViewportSize({width:390,height:900});
  await (await import('./review/data-query-builder.mjs')).check({page,assert,choose,mount:code=>fixture('data-query-builder',code)});
  await fixture(
    "data-query-builder",
    `createRoot(document.getElementById('root')).render(<Subject.QueryBuilder fields={[{id:'constructor',label:'Reserved key',type:'text'}]} records={[{id:'1',label:'No inherited values',values:{}}]} defaultValue={{match:'all',rules:[{id:'r',field:'constructor',operator:'contains',value:'function'}]}}/>);`,
  );
  assert.match(
    await page.getByRole("status").first().innerText(),
    /0 matching records/,
  );
  // Rebuilt workflow: commerce-catalog-import. The dedicated case retains the original edge checks.
  await page.setViewportSize({ width: 390, height: 844 });
  await (await import('./pro-50/commerce-catalog-import.mjs')).check({ page, assert, mount: code => fixture('commerce-catalog-import', code), choose });
  await page.setViewportSize({ width: 390, height: 844 });
  // Rebuilt workflow: commerce-variant-stock. The dedicated case retains the original edge checks.
  await page.setViewportSize({ width: 390, height: 844 });
  await (await import('./pro-50/commerce-variant-stock.mjs')).check({ page, assert, mount: code => fixture('commerce-variant-stock', code) });
  await page.setViewportSize({ width: 390, height: 844 });
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
  // Rebuilt workflow: hr-capacity-planner. The dedicated case retains the original edge checks.
  await page.setViewportSize({width:390,height:900});
  await (await import('./pro-50/hr-capacity-planner.mjs')).check({page,assert,choose,mount:code=>fixture('hr-capacity-planner',code)});
  // Rebuilt workflow: legal-version-history. The dedicated case retains the original edge checks.
  await page.setViewportSize({width:390,height:900});
  await (await import('./pro-50/legal-version-history.mjs')).check({page,assert,choose,mount:code=>fixture('legal-version-history',code)});
  // Rebuilt workflow: app-permission-matrix. The dedicated case retains the original edge checks.
  await page.setViewportSize({ width: 390, height: 844 });
  await (await import('./pro-50/app-permission-matrix.mjs')).check({ page, assert, mount: code => fixture('app-permission-matrix', code) });
  await page.setViewportSize({ width: 390, height: 844 });
  // Rebuilt workflow: commerce-return-desk. The dedicated case retains the original edge checks.
  await page.setViewportSize({ width: 390, height: 844 });
  await (await import('./pro-50/commerce-return-desk.mjs')).check({ page, assert, mount: code => fixture('commerce-return-desk', code) });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.deepEqual(errors, []);
  console.log("Pro industry workflows: behavioral regression checks passed.");
} finally {
  await browser.close();
}
