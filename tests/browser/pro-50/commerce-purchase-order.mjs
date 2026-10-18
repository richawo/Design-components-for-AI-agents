export async function check({ page, mount, assert, choose, capture = async () => {} }) {
  const totals = () => page.locator("dl").innerText();
  const review = () => page.getByRole("button", { name: "Review purchase order", exact: true });
  const save = () => page.getByRole("button", { name: "Save purchase order", exact: true });
  await mount(
    `window.orders=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.PurchaseOrder onSubmit={async order=>{window.orders.push(order);if(window.fail)throw Error('The buying service is offline.');await new Promise(resolve=>window.finishOrder=resolve)}}/>);`,
  );
  assert.match(await totals(), /£738.00/);
  const pickerBox = await page.getByRole("combobox", { name: "Product 1", exact: true }).boundingBox();
  const removeBox = await page.getByRole("button", { name: "Remove product 1", exact: true }).boundingBox();
  assert.equal(
    Math.max(
      0,
      Math.min(pickerBox.x + pickerBox.width, removeBox.x + removeBox.width) - Math.max(pickerBox.x, removeBox.x),
    ) *
      Math.max(
        0,
        Math.min(pickerBox.y + pickerBox.height, removeBox.y + removeBox.height) - Math.max(pickerBox.y, removeBox.y),
      ),
    0,
    "Product selection and removal have separate hit targets",
  );
  assert.equal(
    await page.getByRole("combobox", { name: "Product 1", exact: true }).innerText(),
    "Merino crew · MC-CHR-L",
  );

  const quantity = page.getByRole("textbox", { name: "Quantity 1", exact: true });
  await quantity.press("Shift+ArrowUp");
  assert.equal(await quantity.inputValue(), "22");
  await quantity.press("Shift+ArrowDown");
  assert.equal(await quantity.inputValue(), "12");
  await quantity.fill("0");
  assert.equal(await review().isDisabled(), true);
  await capture("invalid-quantity", { audit: true });
  await quantity.fill("3");
  await page.getByRole("textbox", { name: "Unit cost 1", exact: true }).fill("0.10");
  await page.getByRole("textbox", { name: "Shipping cost", exact: true }).fill("0.01");
  assert.match(await totals(), /£216.31/);
  await review().press("Enter");
  assert.equal(await page.getByRole("textbox", { name: "Unit cost 1", exact: true }).count(), 0);
  assert.match(await totals(), /£216.31/);
  await capture("review", { audit: true });
  await save().press("Enter");
  await page.getByRole("alert").filter({ hasText: "The buying service is offline." }).waitFor();
  assert.match(await page.locator("section").innerText(), /PO-3342/);
  assert.match(await totals(), /£216.31/);
  await capture("save-failed", { audit: true });
  await page.evaluate(() => (window.fail = false));
  await save().click();
  assert.equal(await page.getByRole("button", { name: "Edit draft", exact: true }).isDisabled(), true);
  await page.locator('[data-demo="save"]').evaluate((element) => element.click());
  assert.equal(await page.evaluate(() => window.orders.length), 2);
  const expected = {
    supplierId: "holm",
    reference: "PO-3342",
    lines: [
      { productId: "crew", quantity: 3, unitCostMinor: 10 },
      { productId: "beanie", quantity: 12, unitCostMinor: 1800 },
    ],
    shippingMinor: 1,
    totalMinor: 21631,
  };
  assert.deepEqual(await page.evaluate(() => window.orders), [expected, expected]);
  await capture("save-pending", { audit: true });
  await page.evaluate(() => window.finishOrder());
  await page.getByText("PO-3342 draft saved · 2 lines", { exact: true }).waitFor();
  await capture("saved", { audit: true });
  assert.equal(await page.getByRole("button", { name: "Saved", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Edit draft", exact: true }).click();
  assert.equal(await page.getByRole("textbox", { name: "Quantity 1", exact: true }).inputValue(), "3");
  await choose(page.getByRole("combobox", { name: "Supplier", exact: true }), "field");
  assert.match(await page.locator("section").innerText(), /Add a product to begin/);
  await page.getByRole("button", { name: "Add product", exact: true }).press("Enter");
  assert.equal(await page.getByRole("combobox", { name: "Product 1", exact: true }).getAttribute("data-value"), "mug");
  await choose(page.getByRole("combobox", { name: "Supplier", exact: true }), "holm");
  assert.equal(await page.getByRole("textbox", { name: "Quantity 1", exact: true }).inputValue(), "3");
  const remove = page.getByRole("button", { name: "Remove product 2", exact: true });
  await remove.focus();
  await remove.press("Enter");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Product 1");
  assert.equal(await page.getByRole("combobox", { name: "Product 2", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  assert.equal(await page.getByRole("textbox", { name: "Quantity 2", exact: true }).inputValue(), "1");

  // Review is a real document state, while persistence requires the host callback.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PurchaseOrder selectMode="native"/>);`);
  assert.equal(
    await page.getByRole("combobox", { name: "Supplier", exact: true }).evaluate((element) => element.tagName),
    "SELECT",
  );
  await review().click();
  assert.equal(await save().isDisabled(), true);
  assert.match(await page.locator("section").innerText(), /Saving is currently unavailable/);

  const supplier = `{id:'exact',name:'Holm Knitwear',leadTime:'18 days',products:[{id:'one',name:'Merino crew',sku:'MC-CHR-L',unitCostMinor:9007199254740991}]}`;
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.PurchaseOrder suppliers={[${supplier}]} defaultDraft={{supplierId:'exact',reference:'PO-EXACT',shippingMinor:0,lines:[{productId:'one',quantity:1,unitCostMinor:9007199254740991}]}}/>);`,
  );
  assert.equal(await page.getByRole("textbox", { name: "Unit cost 1", exact: true }).inputValue(), "90071992547409.91");
  assert.match(await totals(), /£90,071,992,547,409.91/);
  await capture("exact-boundary", { audit: true });
  assert.equal(await review().isDisabled(), false);
  await page.getByRole("textbox", { name: "Quantity 1", exact: true }).fill("2");
  assert.equal(await review().isDisabled(), true);
  assert.match(await page.getByRole("status").first().innerText(), /supported order limit/);

  for (const [currency, minor, text] of [
    ["JPY", 123, "123"],
    ["KWD", 1234, "1.234"],
  ]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.PurchaseOrder currency=${JSON.stringify(currency)} suppliers={[{id:'one',name:'Fieldwork',leadTime:'Today',products:[{id:'p',name:'Product',sku:'P',unitCostMinor:${minor}}]}]} defaultDraft={{shippingMinor:0,lines:[{productId:'p',quantity:1,unitCostMinor:${minor}}]}}/>);`,
    );
    assert.equal(await page.getByRole("textbox", { name: "Unit cost 1", exact: true }).inputValue(), text);
    assert.equal(await review().isDisabled(), false);
  }
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PurchaseOrder suppliers={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /Select a supplier to begin/);
  assert.equal(await review().isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Add product", exact: true }).isDisabled(), true);

  // A late write cannot mark a replacement currency context as saved.
  await mount(
    `function Fixture(){const [currency,setCurrency]=React.useState('GBP');window.replaceCurrency=()=>setCurrency('JPY');return <Subject.PurchaseOrder currency={currency} onSubmit={()=>new Promise(resolve=>window.finishOldOrder=resolve)}/>};createRoot(document.getElementById('root')).render(<Fixture/>);`,
  );
  await review().click();
  await save().click();
  await page.evaluate(() => window.replaceCurrency());
  await page.getByRole("button", { name: "Review purchase order", exact: true }).waitFor();
  await page.evaluate(() => window.finishOldOrder());
  assert.doesNotMatch(await page.locator("section").innerText(), /draft saved/);
}
