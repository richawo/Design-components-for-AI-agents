export async function check({ page, mount, assert }) {
  await mount(`window.proposals=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.CompensationReview onSubmit={async p=>{window.proposals.push(p);if(window.fail)throw Error('offline')}}/>);`);
  const kofi = page.getByLabel("Kofi Mensah increase percent", { exact: true });
  const review = page.getByRole("button", { name: "Review changes" });
  await kofi.fill("20");
  assert.equal(await kofi.getAttribute("aria-invalid"), "true");
  assert.match(await page.getByRole("alert").innerText(), /above the 12% policy cap/);
  assert.equal(await review.isDisabled(), true);
  await kofi.fill("3.001");
  assert.equal(await kofi.getAttribute("aria-invalid"), "true");
  await kofi.fill("5");
  await kofi.blur();
  assert.match(await page.getByRole("alert").innerText(), /1 change needs a rationale/);
  await page.locator('[data-demo="employee-1"]').click();
  await page.getByLabel("Adjustment rationale", { exact: true }).fill("Below the band midpoint after a strong year; market correction.");
  assert.equal(await review.isDisabled(), false);
  await review.click();
  await page.getByRole("button", { name: "Submit pay proposal" }).click();
  await page.getByRole("status").filter({ hasText: "Couldn’t send" }).waitFor();
  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "Submit pay proposal" }).click();
  await page.getByText("In approval").first().waitFor();
  const value = await page.evaluate(() => window.proposals[1]);
  assert.equal(value.adjustments.length, 2);
  const k = value.adjustments.find((a) => a.employeeId === "kofi");
  assert.equal(k.toMinor, 6195000);
  assert.equal(k.increaseBasisPoints, 500);
  assert.equal(value.totalIncreaseMinor, 407500 + 295000);

  // Keyboard on the band handle.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CompensationReview/>);`);
  const hana = page.getByRole("slider", { name: "Hana Sato proposed salary" });
  await hana.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  assert.match(await hana.getAttribute("aria-valuetext"), /\+1%/);

  // Rounding happens once, on the minor unit.
  await mount(`window.penny=null;createRoot(document.getElementById('root')).render(<Subject.CompensationReview employees={[{id:'p',name:'Penny Lane',role:'Reviewer',grade:'A',salaryMinor:101,rangeMinMinor:1,rangeMaxMinor:1000}]} budgetMinor={1000} maxIncreaseBps={6000} onSubmit={p=>window.penny=p}/>);`);
  await page.getByLabel("Penny Lane increase percent", { exact: true }).fill("50");
  await page.locator('[data-demo="employee-0"]').click();
  await page.getByLabel("Adjustment rationale", { exact: true }).fill("A specific approved role adjustment.");
  await page.getByRole("button", { name: "Review changes" }).click();
  await page.getByRole("button", { name: "Submit pay proposal" }).click();
  await page.waitForFunction(() => window.penny);
  assert.equal(await page.evaluate(() => window.penny.totalIncreaseMinor), 51);

  await mount(`createRoot(document.getElementById('root')).render(<Subject.CompensationReview employees={[{id:'x',name:'Bad Data',role:'R',grade:'A',salaryMinor:-5,rangeMinMinor:1,rangeMaxMinor:2}]}/>);`);
  assert.match(await page.getByRole("alert").first().innerText(), /isn’t a valid amount/);
}
