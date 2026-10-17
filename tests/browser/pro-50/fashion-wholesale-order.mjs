export async function check({ page, mount, assert }) {
  const sheet = () => page.locator("section").first().innerText();
  const submit = () => page.locator('[data-demo="submit"]');
  const packs = (name) => page.getByRole("textbox", { name, exact: true });
  await mount(
    `window.orders=[];window.fail=true;createRoot(document.getElementById('root')).render(` +
      `<Subject.WholesaleOrder onSubmit={async d=>{window.orders.push(d);if(window.fail)throw Error('Connection lost')}} onRecall={async()=>{}}/>);`,
  );
  // The coat is below its style minimum, so the order can't go yet.
  assert.equal(await submit().isDisabled(), true);
  assert.match(await sheet(), /needs 1 more pack/);
  await page.getByRole("button", { name: "One more pack, Camel packs, Double-breasted overcoat", exact: true }).click();
  assert.equal(await packs("Camel packs, Double-breasted overcoat").inputValue(), "2");
  assert.match(await sheet(), /2 of 2 packs min/);
  assert.match(await sheet(), /£2,820\.00/);
  assert.match(await sheet(), /to reach the order minimum/);
  // Keyboard: ArrowUp on the trouser field adds a pack and clears the minimum.
  await packs("Stone packs, Pleated wide trouser").focus();
  await page.keyboard.press("ArrowUp");
  assert.equal(await packs("Stone packs, Pleated wide trouser").inputValue(), "1");
  assert.match(await sheet(), /£3,332\.00/);
  assert.match(await sheet(), /Order minimum met/);
  // Typing commits on Enter.
  await packs("Forest packs, Lambswool crew").fill("3");
  await page.keyboard.press("Enter");
  assert.match(await sheet(), /£4,028\.00/);
  await packs("Forest packs, Lambswool crew").fill("1");
  await page.keyboard.press("Enter");
  // A rejected submit keeps every pack and offers a retry.
  await submit().click();
  await page.getByRole("alert").filter({ hasText: "Connection lost." }).waitFor();
  assert.match(await page.getByRole("alert").innerText(), /packs are kept/);
  assert.equal(await packs("Camel packs, Double-breasted overcoat").inputValue(), "2");
  assert.equal(await submit().innerText(), "Send again");
  await page.evaluate(() => (window.fail = false));
  await submit().click();
  await page.getByText("Order WO-4417 sent to Ferne").waitFor();
  const draft = await page.evaluate(() => window.orders.at(-1));
  assert.equal(draft.totalMinor, 333200);
  assert.equal(draft.totalUnits, 38);
  assert.deepEqual(draft.lines.find((l) => l.colourwayId === "camel").unitsBySize, { S: 2, M: 4, L: 4, XL: 2 });
  // Recall reopens the draft.
  await page.getByRole("button", { name: "Recall order" }).click();
  await submit().waitFor();
  assert.equal(await submit().innerText(), "Submit order");
  // Over stock: one Oxblood pack needs two M against one available.
  await page.getByRole("button", { name: "One more pack, Oxblood packs, Lambswool crew", exact: true }).click();
  assert.match(await sheet(), /Oxblood lambswool crew in M is over available stock/);
  assert.equal(await submit().isDisabled(), true);

  // Missing stock data counts as none available.
  const style = { id: "tee", name: "Merino tee", sku: "T1", fabric: "Merino", garment: "tee", unitMinor: 2000, sizes: ["S", "M"], packRatio: [1, 1], minimumPacks: 1, colourways: [{ id: "ink", name: "Ink", hex: "#23262d", available: {} }] };
  await mount(`createRoot(document.getElementById('root')).render(<Subject.WholesaleOrder styles={[${JSON.stringify(style)}]} initialPacks={{}} minimumOrderMinor={0}/>);`);
  assert.match(await sheet(), /Add a pack to start the order/);
  await page.getByRole("button", { name: "One more pack, Ink packs, Merino tee", exact: true }).click();
  assert.match(await sheet(), /over available stock/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.WholesaleOrder styles={[]}/>);`);
  assert.match(await sheet(), /No styles in this order book yet/);
}
