export async function check({ page, mount, assert }) {
  const envelopes = [{ id: "food", name: "Groceries", icon: "basket", budgeted: 200, spent: 100, lastPeriod: 250 }];
  const setup = `<Subject.MobileBudgetEnvelope envelopes={${JSON.stringify(envelopes)}} income={500} openId="food" onBudgetChange={async p=>{window.changes.push(p);if(window.fail)throw Error('offline')}}/>`;
  await mount(`window.changes=[];window.fail=true;createRoot(document.getElementById('root')).render(${setup});`);
  const ruler = page.getByRole("slider", { name: "Budget", exact: true });
  await ruler.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("button", { name: "Budget $205.00", exact: true }).count(), 1);
  await page.keyboard.press("PageUp");
  await page.getByRole("button", { name: "Budget $255.00", exact: true }).waitFor();
  await page.getByRole("button", { name: "Budget $255.00", exact: true }).press("Enter");
  const amount = page.getByRole("textbox", { name: "Budget amount", exact: true });
  await amount.fill("abc");
  await amount.press("Enter");
  await page.getByText("Enter an amount like 260 or 260.50.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Budget $255.00", exact: true }).press("Enter");
  await amount.fill("275.50");
  await amount.press("Enter");
  await page.getByRole("button", { name: "Assign $275.50", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Couldn’t save. Your $275.50 is still here; try again." }).waitFor();
  await page.getByRole("button", { name: "Budget $275.50", exact: true }).waitFor();
  await page.evaluate(() => window.fail = false);
  await page.getByRole("button", { name: "Assign $275.50", exact: true }).click();
  await page.waitForFunction(() => window.changes.length === 2);
  assert.deepEqual(await page.evaluate(() => window.changes[1]), { envelopeId: "food", name: "Groceries", from: 200, to: 275.5, readyToAssign: 224.5 });
  await page.getByRole("button", { name: "Saved", exact: true }).waitFor();

  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileBudgetEnvelope envelopes={${JSON.stringify(envelopes)}} income={220} openId="food"/>);`);
  await page.getByRole("button", { name: "Budget $200.00", exact: true }).press("Enter");
  await amount.fill("500");
  await amount.press("Enter");
  await page.getByText("Only $220.00 fits. The rest isn’t ready to assign.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Budget $220.00", exact: true }).waitFor();
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileBudgetEnvelope envelopes={[]} income={0}/>);`);
  assert.equal(await page.getByRole("slider").count(), 0);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
}
