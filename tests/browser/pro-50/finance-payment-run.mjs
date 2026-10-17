const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");
const spoken = (locator) =>
  locator.evaluate((el) => {
    const copy = el.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll("*").forEach((n) => n.append(" "));
    return copy.textContent.replace(/\s+/g, " ").trim();
  });

export async function check({ page, mount, assert }) {
  await mount(`window.runs=[];window.picks=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.PaymentRun onSelectionChange={ids=>window.picks.push(ids)} onSubmitRun={async r=>{window.runs.push(r);if(window.fail)throw Error('');return {returned:[{id:'BILL-4805',reason:'Account closed'}]}}}/>);`);
  const root = page.locator("section").first();
  const toolbar = root.locator("header").first();
  const bills = page.getByRole("list", { name: "Bills to pay" });
  const meter = page.getByRole("meter");
  const pay = page.locator('[data-demo="pay"]');
  const footer = () => spoken(root.locator(":scope > div").last());
  const box = (label) => page.getByRole("checkbox", { name: label });
  const all = page.getByRole("checkbox", { name: "Select every payable bill" });
  const order = () => bills.locator("li").evaluateAll((els) => els.map((e) => e.textContent.match(/BILL-\d+/)?.[0]));

  // Due first; held bills stay visible but can't be picked.
  assert.match(await txt(toolbar), /PR-1016 · Fri 16 Oct Draft/);
  assert.deepEqual(await order(), ["BILL-4797", "BILL-4801", "BILL-4802", "BILL-4804", "BILL-4805", "BILL-4806", "BILL-4808"]);
  assert.match(await txt(root), /Vendor · 5 payable/);
  const atlas = box("Pay Atlas Research, £4,120.00, due 13 Oct");
  assert.equal(await atlas.isDisabled(), true);
  assert.equal(await page.locator(`[id="${await atlas.getAttribute("aria-describedby")}"]`).innerText(), "Bank details changed");
  assert.match(await txt(bills.locator("li").nth(0)), /3 days late/);
  assert.match(await txt(bills.locator("li").nth(1)), /Due today/);
  assert.match(await txt(bills.locator("li").nth(2)), /In 3 days/);
  assert.equal(await pay.isDisabled(), true);
  assert.match(await footer(), /No bills in this run yet/);

  // Keyboard: tick bills with Space; the meter and the footer follow.
  const northline = box("Pay Northline Freight, £12,480.00, due 16 Oct");
  await northline.focus();
  await page.keyboard.press("Space");
  await box("Pay Fieldwork Contractors, £8,950.00, due 19 Oct").check();
  assert.equal(await meter.getAttribute("aria-label"), "This run uses £21,430.00 of £71,840.25 in Operating");
  assert.match(await spoken(root), /This run £21,430\.00 of £46,840\.25 you can spend before the reserve/);
  assert.match(await spoken(root), /Left in Operating after £50,410\.25 £25,410\.25 to spare/);
  assert.match(await footer(), /2 bills · £21,430\.00 Paid Fri 16 Oct from Operating •••• 4021/);
  assert.equal(await all.evaluate((el) => el.indeterminate), true);
  assert.deepEqual(await page.evaluate(() => window.picks.at(-1)), ["BILL-4801", "BILL-4802"]);

  // Select every payable bill: the run dips into the reserve.
  await all.check();
  assert.equal(await all.evaluate((el) => el.indeterminate), false);
  assert.equal(await atlas.isChecked(), false);
  assert.match(await spoken(root), /£6,651\.75 into the reserve/);
  assert.match(await footer(), /5 bills · £53,492\.00/);

  // Paying never moves money on one click: it asks first.
  await pay.click();
  assert.match(await txt(toolbar), /Ready to send/);
  assert.match(await footer(), /Send £53,492\.00 to 5 vendors\? Leaves £18,348\.25 in Operating, below the £25,000\.00 reserve\./);
  assert.equal(await page.evaluate(() => window.runs.length), 0);
  assert.equal(await northline.isDisabled(), true);
  await root.getByRole("button", { name: "Back" }).click();
  assert.match(await txt(toolbar), /Draft/);
  assert.equal(await northline.isDisabled(), false);
  await pay.click();

  // The bank rejects first: nothing is sent and the selection is kept.
  await page.locator('[data-demo="confirm"]').click();
  await root.filter({ hasText: "Nothing was sent" }).waitFor();
  assert.match(await footer(), /The bank didn’t answer in time\. Your selection is kept\./);
  assert.match(await txt(toolbar), /Failed/);
  assert.equal(await northline.isChecked(), true);
  assert.match(await txt(pay), /Try again/);
  const run = { runId: "PR-1016", payDate: "2026-10-16", currency: "GBP", accountMask: "4021", billIds: ["BILL-4801", "BILL-4802", "BILL-4804", "BILL-4805", "BILL-4808"], totalMinor: 5349200 };
  assert.deepEqual(await page.evaluate(() => window.runs[0]), run);

  // Then it settles; a returned payment stays ticked with the bank's reason.
  await page.evaluate(() => (window.fail = false));
  await pay.click();
  await root.filter({ hasText: "4 of 5 payments sent" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.runs[1]), run);
  assert.match(await txt(toolbar), /Partly sent/);
  assert.match(await footer(), /£53,492\.00 from Operating •••• 4021 · arrives by Wed 21 Oct · 1 returned, kept for the next run/);
  assert.match(await txt(bills.locator("li").filter({ hasText: "BILL-4805" })), /Account closed/);
  assert.match(await txt(bills.locator("li").filter({ hasText: "BILL-4801" })), /Paid/);

  // Start the next run: paid bills leave; the returned one is still in it.
  await page.locator('[data-demo="new-run"]').click();
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Bills to pay"] > li').length === 3);
  assert.deepEqual(await order(), ["BILL-4797", "BILL-4805", "BILL-4806"]);
  assert.equal(await box("Pay Oakridge Lettings, £28,500.00, due 23 Oct").isChecked(), true);
  assert.match(await footer(), /1 bill · £28,500\.00/);
  assert.match(await txt(toolbar), /Draft/);
  assert.deepEqual(await page.evaluate(() => window.picks.at(-1)), ["BILL-4805"]);

  // Sorting by amount.
  await page.getByRole("button", { name: "Sort by amount" }).click();
  assert.deepEqual(await order(), ["BILL-4797", "BILL-4806", "BILL-4805"]);
  await page.getByRole("button", { name: "Sort by amount" }).click();
  assert.deepEqual(await order(), ["BILL-4805", "BILL-4806", "BILL-4797"]);

  // More than the account holds can't be paid.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PaymentRun account={{name:'Payroll',mask:'0099',balanceMinor:100000,minimumMinor:0}} bills={[{id:'B1',vendor:'Big Vendor',dueDate:'2026-10-20',amountMinor:150000,method:'BACS',settlementDays:3,accountMask:'1111'}]} defaultSelected={['B1']}/>);`);
  const over = page.locator("section").first();
  assert.match(await spoken(over), /More than the account holds/);
  assert.match(await spoken(over.locator(":scope > div").last()), /£500\.00 more than Payroll holds\./);
  assert.equal(await page.locator('[data-demo="pay"]').isDisabled(), true);

  // A held bill can't be pre-selected; an empty list is a designed state.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PaymentRun defaultSelected={['BILL-4797','missing']}/>);`);
  assert.equal(await page.getByRole("checkbox", { name: /^Pay Atlas Research/ }).isChecked(), false);
  assert.match(await spoken(page.locator("section").first().locator(":scope > div").last()), /No bills in this run yet/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PaymentRun bills={[]}/>);`);
  await page.getByText("Every bill is paid").waitFor();
  assert.equal(await page.getByRole("checkbox", { name: "Select every payable bill" }).isDisabled(), true);
}
