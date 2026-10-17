export async function check({ page, mount, assert }) {
  const footer = () => page.locator("footer").innerText();
  const lane = (id) => page.locator(`[data-demo="service-${id}"]`);
  await mount(`window.quotes=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.ShippingEstimator onSelect={async q=>{window.quotes.push(q);if(window.fail)throw Error('offline')}}/>);`);
  // Thursday 13:40: the fastest option nothing beats on price is recommended.
  assert.match(await footer(), /Parcelline Tracked 24 · £5\.85 · arrives Fri,? 16 Oct/);
  assert.match(await lane("pl-48").getAttribute("aria-label"), /arrives Mon,? 19 Oct, free/);
  // Packing after the 15:00 collection pushes Tracked 24 past the weekend; Swift delivers Saturday.
  await page.locator('[data-demo="after-1500"]').click();
  assert.match(await lane("pl-24").getAttribute("aria-label"), /arrives Mon,? 19 Oct/);
  assert.match(await footer(), /Swift Next day by 1pm · £10\.45 · arrives Sat,? 17 Oct/);
  // Arrow keys move through the lanes.
  await lane("sw-1pm").focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.getByRole("radio", { checked: true }).getAttribute("data-demo"), await page.locator("[role=radio]").nth(1).getAttribute("data-demo"));
  // Weight changes the price; destination changes the services.
  await page.getByRole("button", { name: "Heavier" }).click();
  assert.equal(await page.getByRole("textbox", { name: "Parcel weight in kilograms" }).inputValue(), "1.5");
  await page.getByRole("combobox", { name: "Deliver to" }).selectOption("lyo");
  assert.match(await footer(), /Northpost/);
  assert.match(await page.getByRole("region", { name: "Services" }).innerText(), /3 more services don’t deliver to Lyon/);
  // A failed booking keeps the choice; the retry shows the receipt.
  await lane("np-std").click();
  await page.locator('[data-demo="use-rate"]').click();
  await page.getByRole("alert").filter({ hasText: "offline" }).waitFor();
  assert.match(await page.getByRole("alert").innerText(), /Your choice is kept/);
  assert.equal(await lane("np-std").getAttribute("aria-checked"), "true");
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="use-rate"]').click();
  await page.getByText(/Northpost International booked for #4788/).waitFor();
  const q = await page.evaluate(() => window.quotes[1]);
  assert.equal(q.serviceId, "np-std");
  assert.equal(q.destinationId, "lyo");
  assert.equal(q.weightKg, 1.5);
  assert.equal(q.costMinor, 1295 + 300);
  assert.equal(q.dispatchOn, "2026-10-16");
  assert.equal(q.deliverOn, "2026-10-22");

  // Holidays are skipped like weekends; no service is designed.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ShippingEstimator holidays={["2026-10-16"]}/>);`);
  assert.match(await lane("pl-24").getAttribute("aria-label"), /arrives Mon,? 19 Oct/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ShippingEstimator services={[]}/>);`);
  assert.match(await page.getByRole("region", { name: "Services" }).innerText(), /No service takes this parcel/);
  assert.equal(await page.locator('[data-demo="use-rate"]').isDisabled(), true);
}
