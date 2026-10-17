export async function check({ page, mount, assert }) {
  const footer = () => page.locator("footer").innerText();
  const publish = page.locator('[data-demo="publish"]');
  await mount(`window.bundles=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.BundleBuilder onCreate={async d=>{window.bundles.push(d);if(window.fail)throw Error('offline')}}/>);`);
  assert.match(await footer(), /4 items for £77\.00 · 68\.6% margin · 64 available/);
  // Sold-out products can't be added.
  assert.equal(await page.locator('[data-demo="add-bottle"]').isDisabled(), true);
  await page.locator('[data-demo="add-tote"]').click();
  assert.match(await footer(), /5 items for £134\.00/);
  assert.match(await footer(), /18 available/);
  // The margin guardrail blocks a discount below the floor and names the deepest one that clears it.
  await page.locator('[data-demo="discount-30"]').click();
  assert.match(await footer(), /56\.6% margin is under the 60% floor\. Go to 23% off or less\./);
  assert.equal(await publish.isDisabled(), true);
  await page.locator('[data-demo="discount-20"]').click();
  assert.equal(await publish.isDisabled(), false);
  // Stepper keyboard path.
  const mugs = page.getByRole("textbox", { name: "Field mug per bundle" });
  await mugs.focus();
  await page.keyboard.press("ArrowUp");
  assert.equal(await mugs.inputValue(), "3");
  assert.match(await footer(), /6 items for £144\.00/);
  // A failed publish keeps the draft; the retry goes live.
  await page.getByRole("textbox", { name: "Bundle name" }).fill("Slow Sunday");
  await publish.click();
  await page.getByRole("alert").filter({ hasText: "offline" }).waitFor();
  assert.match(await page.getByRole("alert").innerText(), /Your bundle is kept as a draft/);
  assert.equal(await page.getByRole("textbox", { name: "Bundle name" }).inputValue(), "Slow Sunday");
  await page.evaluate(() => (window.fail = false));
  await publish.click();
  await page.getByText(/Slow Sunday is live at £144\.00/).waitFor();
  assert.deepEqual(await page.evaluate(() => window.bundles[1]), {
    name: "Slow Sunday",
    items: [
      { productId: "mug", quantity: 3 },
      { productId: "candle", quantity: 1 },
      { productId: "notebook", quantity: 1 },
      { productId: "tote", quantity: 1 },
    ],
    priceMinor: 14400,
    compareAtMinor: 18000,
    discountPercent: 20,
    marginPercent: 62,
    capacity: 18,
  });
  // Search with no match.
  await page.getByRole("searchbox", { name: "Search products" }).fill("zzz");
  assert.match(await page.getByRole("region", { name: "Catalogue" }).innerText(), /No products match/);

  // Invalid money is left out; an empty box can't publish.
  const bad = [{ id: "x", name: "Odd mug", sku: "X", priceMinor: 10.5, costMinor: 1, stock: 3 }];
  await mount(`createRoot(document.getElementById('root')).render(<Subject.BundleBuilder products={${JSON.stringify(bad)}} defaultItems={[]}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /Left out: Odd mug/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.BundleBuilder defaultItems={[]}/>);`);
  assert.match(await footer(), /A bundle needs at least two units/);
  assert.equal(await page.locator('[data-demo="publish"]').isDisabled(), true);
}
