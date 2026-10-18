export async function check({ page, mount, assert, capture = async () => {} }) {
  await mount(
    `window.returns=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.ReturnDesk onSubmit={async request=>{window.returns.push(request);if(window.fail)throw Error('The return service is offline.');return new Promise(resolve=>window.finishReturn=resolve)}}/>);`,
  );
  assert.match(await page.getByLabel("Return slip").innerText(), /£0.00/);
  assert.equal(await page.getByRole("button", { name: "Review return", exact: true }).isDisabled(), true);
  await page.getByRole("checkbox", { name: "Return Merino crew", exact: true }).check();
  await page.getByRole("checkbox", { name: "Return Field mug", exact: true }).check();
  const itemTarget = await page.getByRole("checkbox", { name: "Return Field mug", exact: true }).evaluate((node) => {
    const bounds = node.labels[0].getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  });
  assert.ok(itemTarget.width >= 44 && itemTarget.height >= 44, "Item selection has a 44px labelled target");
  assert.equal(
    await page.getByRole("button", { name: "Review return", exact: true }).isDisabled(),
    true,
    "A reason is required",
  );
  await page.getByRole("radio", { name: "The fit was not right", exact: true }).check();
  const mugQuantity = page.getByRole("spinbutton", { name: "Return quantity for Field mug", exact: true });
  const more = page.getByRole("button", { name: "More of Field mug", exact: true });
  const fewer = page.getByRole("button", { name: "Fewer of Field mug", exact: true });
  for (const target of [more, fewer, mugQuantity]) {
    const bounds = await target.boundingBox();
    assert.ok(bounds.width >= 44 && bounds.height >= 44, "Quantity controls have 44px mobile targets");
  }
  await more.click();
  assert.equal(await mugQuantity.inputValue(), "2");
  await fewer.press("Enter");
  assert.equal(await mugQuantity.inputValue(), "1");
  for (const invalid of ["3", "1.5", "0"]) {
    await mugQuantity.fill(invalid);
    assert.equal(await page.getByRole("button", { name: "Review return", exact: true }).isDisabled(), true);
    assert.equal(await mugQuantity.getAttribute("aria-invalid"), "true");
  }
  await mugQuantity.fill("1");
  await page.getByRole("spinbutton", { name: "Return quantity for Field mug", exact: true }).press("ArrowUp");
  assert.equal(
    await page.getByRole("spinbutton", { name: "Return quantity for Field mug", exact: true }).inputValue(),
    "2",
  );
  assert.match(await page.getByLabel("Return slip").innerText(), /£128.00/);
  await page.getByRole("radio", { name: "The fit was not right", exact: true }).check();
  await page.getByRole("textbox", { name: /Internal note/ }).fill("  Size checked with Ines.  ");
  await capture("selected", { audit: true });
  await page.getByRole("button", { name: "Review return", exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.textContent === "Review selected items");
  assert.equal(await page.getByRole("checkbox").count(), 0, "Review retires editable controls");
  await capture("review", { audit: true });
  await page.getByRole("button", { name: "Submit return", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "The return service is offline." }).waitFor();
  assert.match(await page.locator("section").innerText(), /Size checked with Ines/);
  await capture("submit-failed", { audit: true });
  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "Submit return", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Submitting…", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Edit return", exact: true }).isDisabled(), true);
  await page.locator('[data-demo="return-next"]').evaluate((node) => node.click());
  assert.equal(await page.evaluate(() => window.returns.length), 2);
  assert.deepEqual(await page.evaluate(() => window.returns[1]), {
    orderId: "#4726",
    lines: [
      { itemId: "crew", quantity: 1 },
      { itemId: "mug", quantity: 2 },
    ],
    reasonId: "fit",
    resolution: "refund",
    note: "Size checked with Ines.",
    expectedAmountMinor: "12800",
  });
  await capture("pending", { audit: true });
  await page.evaluate(() => window.finishReturn({ reference: "RET-CHECKED" }));
  await page.getByText("RET-CHECKED · Return request recorded", { exact: true }).waitFor();
  await capture("recorded", { audit: true });
  assert.equal(await page.getByRole("button", { name: "Recorded", exact: true }).isDisabled(), true);
  assert.doesNotMatch(await page.locator("section").innerText(), /refund (sent|issued)|exchange (sent|issued)/i);

  await mount(
    `window.order={id:'large',customer:'Aiko Tanaka',date:'Delivered 10 Oct',currency:'GBP',minorUnitDigits:2,items:[{id:'large',name:'Exact value',variant:'One',sku:'EXACT',returnableQuantity:2,unitRefundMinor:9007199254740991}]};function Host(){const [order,setOrder]=React.useState(window.order);window.replaceLarge=()=>setOrder({...window.order,id:'second'});return <Subject.ReturnDesk order={order} onSubmit={request=>{window.largePayload=request;return new Promise(resolve=>window.finishLarge=resolve)}}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.getByRole("checkbox", { name: "Return Exact value", exact: true }).check();
  const quantity = page.getByRole("spinbutton", { name: "Return quantity for Exact value", exact: true });
  await quantity.press("ArrowUp");
  assert.match(await page.getByLabel("Return slip").innerText(), /£180,143,985,094,819.82/);
  await quantity.fill("0");
  assert.equal(await page.getByRole("button", { name: "Review return", exact: true }).isDisabled(), true);
  assert.match(await page.getByRole("alert").innerText(), /whole quantities/);
  await capture("invalid-quantity", { audit: true });
  await quantity.fill("2");
  await page.getByRole("radio", { name: "The fit was not right", exact: true }).check();
  await page.getByRole("button", { name: "Review return", exact: true }).click();
  await page.getByRole("button", { name: "Submit return", exact: true }).click();
  assert.equal(await page.evaluate(() => window.largePayload.expectedAmountMinor), "18014398509481982");
  await page.evaluate(() => window.replaceLarge());
  await page.getByRole("checkbox", { name: "Return Exact value", exact: true }).waitFor();
  await page.evaluate(() => window.finishLarge({ reference: "RET-LARGE-OLD" }));
  assert.equal(await page.getByRole("checkbox", { name: "Return Exact value", exact: true }).isChecked(), false);
  assert.doesNotMatch(await page.locator("section").innerText(), /RET-LARGE-OLD/);

  await mount(`createRoot(document.getElementById('root')).render(<Subject.ReturnDesk/>);`);
  await page.getByRole("checkbox", { name: "Return Merino crew", exact: true }).check();
  await page.getByRole("radio", { name: "The fit was not right", exact: true }).check();
  await page.getByRole("button", { name: "Review return", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Submit return", exact: true }).isDisabled(), true);
  assert.match(await page.locator("section").innerText(), /Return requests are unavailable/);

  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ReturnDesk order={{id:'empty',customer:'Maya Okonkwo',date:'Today',currency:'GBP',minorUnitDigits:2,items:[]}} reasons={[]} resolutions={[]}/>);`,
  );
  assert.match(await page.locator("section").innerText(), /no valid returnable items/i);
  assert.match(await page.locator("section").innerText(), /No return reasons/);
  assert.match(await page.locator("section").innerText(), /No resolution options/);
  assert.equal(await page.getByRole("button", { name: "Review return", exact: true }).isDisabled(), true);
  await capture("empty", { audit: true });

  await mount(
    `window.oldOrder={id:'same',customer:'Ines Moreau',date:'Delivered 10 Oct',currency:'GBP',minorUnitDigits:2,items:[{id:'crew',name:'Merino crew',variant:'Charcoal / L',sku:'MC-CHR-L',returnableQuantity:1,unitRefundMinor:8400}]};function Host(){const [order,setOrder]=React.useState(window.oldOrder);window.swapReturn=()=>setOrder({...window.oldOrder,items:[{...window.oldOrder.items[0],unitRefundMinor:7900}]});return <Subject.ReturnDesk order={order} onSubmit={()=>new Promise(resolve=>window.oldReturn=resolve)}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.getByRole("checkbox", { name: "Return Merino crew", exact: true }).check();
  await page.getByRole("radio", { name: "The fit was not right", exact: true }).check();
  await page.getByRole("button", { name: "Review return", exact: true }).click();
  await page.getByRole("button", { name: "Submit return", exact: true }).click();
  await page.evaluate(() => window.swapReturn());
  await page.getByRole("checkbox", { name: "Return Merino crew", exact: true }).waitFor();
  await page.evaluate(() => window.oldReturn({ reference: "RET-OBSOLETE" }));
  assert.doesNotMatch(await page.locator("section").innerText(), /RET-OBSOLETE/);
  assert.equal(await page.getByRole("checkbox", { name: "Return Merino crew", exact: true }).isChecked(), false);
}
