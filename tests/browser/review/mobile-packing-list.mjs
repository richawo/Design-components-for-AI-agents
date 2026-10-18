export async function check({ page, mount, assert }) {
  const items = [
    { id: "shirt", name: "Linen shirt", group: "Clothes", qty: 1, grams: 300, packed: false },
    { id: "book", name: "Notebook", group: "Carry-on", qty: 1, grams: 200, packed: false },
  ];
  const trip = { destination: "Lisbon", dates: "24–28 October", bag: "Carry-on", limitKg: 2, tareKg: 0.5 };
  const props = `items={${JSON.stringify(items)}} trip={${JSON.stringify(trip)}}`;
  await mount(
    `window.changes=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.MobilePackingList ${props} onChange={async(items,change)=>{window.changes.push({items,change});if(window.fail)throw Error('Packing not synced')}}/>);`,
  );
  const shirt = page.getByRole("checkbox", { name: "Linen shirt", exact: true });
  await shirt.press("Space");
  await page.getByRole("alert").filter({ hasText: "Packing not synced" }).waitFor();
  assert.equal(await shirt.isChecked(), false);
  await page.evaluate(() => (window.fail = false));
  await shirt.press("Enter");
  await page.waitForFunction(
    () => document.querySelector('[data-demo="check-shirt"]').getAttribute("aria-checked") === "true",
  );
  assert.equal(await page.getByRole("alert").count(), 0, "An accepted retry retires its previous failure");
  assert.deepEqual(await page.evaluate(() => window.changes[1].change), { type: "pack", id: "shirt" });
  await page.locator('[data-demo="row-shirt"]').press("Enter");
  await page.getByRole("button", { name: "One more Linen shirt", exact: true }).press("Enter");
  await page.waitForFunction(() => window.changes.at(-1)?.change.qty === 2);
  assert.deepEqual(await page.evaluate(() => window.changes.at(-1).items.find((i) => i.id === "shirt")), {
    ...items[0],
    packed: true,
    qty: 2,
  });

  const quantity = page.getByRole("spinbutton", { name: "Linen shirt quantity", exact: true });
  assert.equal(await quantity.getAttribute("aria-valuenow"), "2");
  await quantity.press("End");
  await page.waitForFunction(
    () => document.querySelector('[role="spinbutton"]').getAttribute("aria-valuenow") === "99",
  );
  assert.equal(await page.getByRole("button", { name: "One more Linen shirt", exact: true }).isDisabled(), true);
  await quantity.press("ArrowUp");
  assert.equal(await quantity.getAttribute("aria-valuenow"), "99");
  await quantity.press("Home");
  assert.equal(await page.getByRole("button", { name: "One fewer Linen shirt", exact: true }).isDisabled(), true);
  await quantity.press("ArrowDown");
  assert.equal(await quantity.getAttribute("aria-valuenow"), "1");
  await quantity.press("ArrowUp");
  await page.waitForFunction(() => document.querySelector('[role="spinbutton"]').getAttribute("aria-valuenow") === "2");
  await page.getByRole("button", { name: "Remove Linen shirt", exact: true }).press("Enter");
  await shirt.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Undo", exact: true }).press("Enter");
  await shirt.waitFor();
  assert.equal(await shirt.isChecked(), true);
  assert.deepEqual(await page.evaluate(() => window.changes.at(-1).change), { type: "restore", id: "shirt" });
  await mount(
    `window.rejectFirst=null;window.calls=0;window.queued=[];createRoot(document.getElementById('root')).render(<Subject.MobilePackingList ${props} onChange={async(items,change)=>{window.calls++;window.queued.push({items,change});if(window.calls===1)await new Promise((resolve,reject)=>window.rejectFirst=reject)}}/>);`,
  );
  await page.getByRole("checkbox", { name: "Linen shirt", exact: true }).press("Enter");
  await page.getByRole("checkbox", { name: "Notebook", exact: true }).press("Enter");
  assert.equal(
    await page.evaluate(() => window.calls),
    1,
    "Whole-list writes are serialized while optimistic edits remain visible",
  );
  await page.evaluate(() => window.rejectFirst(Error("First change declined")));
  await page.getByRole("alert").filter({ hasText: "First change declined" }).waitFor();
  await page.waitForFunction(() => window.calls === 2);
  assert.deepEqual(
    await page.evaluate(() => window.queued[1].items.map(({ id, packed }) => ({ id, packed }))),
    [
      { id: "shirt", packed: false },
      { id: "book", packed: true },
    ],
    "The next whole-list write excludes the refused change",
  );
  assert.equal(
    await page.getByRole("checkbox", { name: "Notebook", exact: true }).isChecked(),
    true,
    "A failed mark preserves another item's accepted change",
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobilePackingList items={[]} trip={${JSON.stringify(trip)}}/>);`,
  );
  await page.getByRole("heading", { name: "Nothing to pack yet", exact: true }).waitFor();
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  assert.equal(await page.getByRole("checkbox").count(), 0);
}
