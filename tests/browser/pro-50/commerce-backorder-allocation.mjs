export async function check({ page, mount, assert }) {
  const footer = () => page.locator("footer").innerText();
  await mount(`window.plans=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.BackorderAllocation onReserve={async p=>{window.plans.push(p);if(window.fail)throw Error('offline');return 'RSV-1'}}/>);`);
  assert.match(await footer(), /120 of 120 units allocated · 5 promises slip/);
  // Each rule shows what it would miss before it is chosen.
  assert.match(await page.locator('[data-demo="rule-promise"]').innerText(), /2/);
  await page.locator('[data-demo="rule-promise"]').click();
  assert.match(await footer(), /2 promises slip/);
  // Arrow keys move along the rules.
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator('[data-demo="rule-vip"]').getAttribute("aria-checked"), "true");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.locator('[data-demo="rule-promise"]').getAttribute("aria-checked"), "true");
  // Slider keyboard: Home empties an order, End takes back what's free; the rule becomes custom.
  const ark = page.locator('[data-demo="slider-4640"]');
  assert.equal(await ark.getAttribute("aria-valuetext"), "24 of 60 units");
  await ark.focus();
  await page.keyboard.press("Home");
  assert.equal(await ark.getAttribute("aria-valuenow"), "0");
  assert.match(await footer(), /96 of 120 units allocated/);
  assert.match(await page.locator("section").first().innerText(), /Custom split/);
  await page.keyboard.press("ArrowRight");
  assert.equal(await ark.getAttribute("aria-valuenow"), "1");
  await page.keyboard.press("End");
  assert.equal(await ark.getAttribute("aria-valuenow"), "24");
  assert.match(await footer(), /120 of 120 units allocated/);
  // A failed reservation keeps the allocation; the retry shows the receipt and locks the sliders.
  await page.locator('[data-demo="reserve"]').click();
  await page.getByRole("alert").filter({ hasText: "offline" }).waitFor();
  assert.match(await page.getByRole("alert").innerText(), /Your allocation is kept/);
  assert.equal(await ark.getAttribute("aria-valuenow"), "24");
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="reserve"]').click();
  await page.getByText(/Reserved 120 units on PO-3318 · RSV-1/).waitFor();
  assert.equal(await ark.getAttribute("aria-disabled"), "true");
  const plan = await page.evaluate(() => window.plans[1]);
  assert.equal(plan.allocated, 120);
  assert.equal(plan.unallocated, 0);
  assert.equal(plan.rule, "custom");
  assert.deepEqual(plan.lines.find((l) => l.orderNumber === "#4640"), { requestId: "4640", orderNumber: "#4640", units: 24 });
  await page.locator('[data-demo="edit"]').click();
  assert.equal(await ark.getAttribute("aria-disabled"), null);

  // Bad quantities and duplicate IDs are left out; nothing waiting is designed.
  const base = { customer: "Ada Park", channel: "Online", orderedOn: "2026-10-01", promisedOn: "2026-10-20" };
  const bad = [
    { ...base, id: "a", orderNumber: "#1", units: 2 },
    { ...base, id: "a", orderNumber: "#2", units: 3 },
    { ...base, id: "b", orderNumber: "#3", units: 1.5 },
  ];
  await mount(`createRoot(document.getElementById('root')).render(<Subject.BackorderAllocation requests={${JSON.stringify(bad)}}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /Left out: #2, #3/);
  assert.match(await footer(), /2 of 120 units allocated/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.BackorderAllocation requests={[]}/>);`);
  assert.match(await page.locator("section").first().innerText(), /Nothing is waiting on MC-CHR-L/);
  assert.equal(await page.locator('[data-demo="reserve"]').isDisabled(), true);
}
