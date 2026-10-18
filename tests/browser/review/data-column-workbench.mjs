export async function check({ page, mount, assert }) {
  await page.setViewportSize({ width: 900, height: 1000 });
  const columns = [
    { id: "name", label: "Name", required: true, width: 140, minWidth: 120 },
    { id: "status", label: "Status", kind: "status", width: 140 },
    { id: "amount", label: "Amount", kind: "number", width: 160 },
  ];
  const rows = [
    { id: "a", cells: { name: "Shipment A", status: "Ready", amount: "12" } },
    { id: "b", cells: { name: "Shipment B", status: "Due", amount: "8" } },
  ];
  const props = `columns={${JSON.stringify(columns)}} rows={${JSON.stringify(rows)}}`;
  await mount(
    `window.changes=[];createRoot(document.getElementById('root')).render(<Subject.DataColumnWorkbench ${props} onChange={(value,change)=>window.changes.push({value,change})}/>);`,
  );
  assert.equal(await page.getByRole("button", { name: "Hide Name", exact: true }).count(), 0);
  await page.locator('[data-demo="grip-status"]').press("ArrowLeft");
  assert.deepEqual(await page.evaluate(() => window.changes.at(-1).value.map((c) => c.id)), [
    "status",
    "name",
    "amount",
  ]);
  await page.getByRole("button", { name: "Pin Amount to the left", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.changes.at(-1).change), { type: "pin", columnId: "amount" });
  assert.equal(await page.evaluate(() => window.changes.at(-1).value[0].id), "amount");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "pin-amount");
  await page.getByRole("button", { name: "Hide Status", exact: true }).press("Space");
  await page.getByRole("button", { name: "Show Status", exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "show-status");
  await page.getByRole("button", { name: "Show Status", exact: true }).press("Enter");
  assert.equal(
    await page.getByRole("button", { name: "Show Status", exact: true }).count(),
    0,
    "Retired shelf controls leave immediately",
  );
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "grip-status");
  const resize = page.getByRole("separator", { name: "Resize Amount", exact: true });
  await resize.press("ArrowRight");
  assert.equal(await resize.getAttribute("aria-valuenow"), "176");
  assert.deepEqual(await page.evaluate(() => window.changes.at(-1).change), { type: "resize", columnId: "amount" });
  await resize.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const el = document.querySelector('[role="separator"][aria-label="Resize Amount"]');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[role="separator"]') === el;
  });
  const box = await resize.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 48, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  assert.equal(Number(await resize.getAttribute("aria-valuenow")), 224);
  await page.locator('[data-demo="reset"]').press("Enter");
  assert.deepEqual(await page.evaluate(() => window.changes.at(-1).change), { type: "reset" });
  assert.deepEqual(
    await page.evaluate(() => window.changes.at(-1).value),
    columns.map((c) => ({ id: c.id, visible: true, pinned: false, width: c.width })),
  );
  // The complete column follows a real drag, and publishes only once on release.
  await mount(
    `window.changes=[];createRoot(document.getElementById('root')).render(<Subject.DataColumnWorkbench ${props} onChange={(value,change)=>window.changes.push({value,change})}/>);`,
  );
  const grip = page.locator('[data-demo="grip-amount"]');
  const from = await grip.boundingBox(),
    to = await page.locator('[data-demo="grip-name"]').boundingBox();
  const cell = page.getByRole("cell", { name: "12", exact: true }),
    before = await cell.boundingBox();
  assert.ok(from && to && before);
  await page.mouse.move(from.x + from.width * 0.7, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width * 0.7 - 32, from.y + from.height / 2, { steps: 5 });
  await page.waitForTimeout(80);
  const held = await grip.boundingBox(),
    riding = await cell.boundingBox();
  assert.ok(Math.abs(held.x - from.x - (riding.x - before.x)) < 3, "The header and its cells travel together");
  assert.deepEqual(await page.evaluate(() => window.changes), [], "Dragging previews without publishing");
  await page.mouse.move(to.x + 12, from.y + from.height / 2, { steps: 16 });
  await page.mouse.up();
  await page.waitForFunction(() => window.changes.length === 1);
  assert.deepEqual(await page.evaluate(() => window.changes[0].change), { type: "move", columnId: "amount" });
  assert.deepEqual(await page.evaluate(() => window.changes[0].value.map((c) => c.id)), ["amount", "name", "status"]);
  await page.waitForTimeout(450);
  assert.deepEqual(await page.getByRole("row").nth(1).getByRole("cell").allTextContents(), [
    "12",
    "Shipment A",
    "Ready",
  ]);
  // Cancelling a resize discards its local preview.
  const amountResize = page.getByRole("separator", { name: "Resize Amount", exact: true });
  const handle = await amountResize.boundingBox();
  assert.ok(handle);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2, { steps: 6 });
  await amountResize.dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse" });
  await page.mouse.up();
  assert.equal(await amountResize.getAttribute("aria-valuenow"), "160");
  assert.equal(await page.evaluate(() => window.changes.length), 1, "Cancelled resize does not publish");
  // Controlled arrangements wait for the host and then retain the accepted layout.
  await mount(
    `window.changes=[];function Host(){const [value,setValue]=useState(${JSON.stringify(columns.map((c) => ({ id: c.id, visible: true, pinned: false, width: c.width })))});window.accept=()=>setValue(window.changes.at(-1).value);return <Subject.DataColumnWorkbench ${props} value={value} onChange={(value,change)=>window.changes.push({value,change})}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.locator('[data-demo="grip-status"]').press("ArrowLeft");
  assert.deepEqual(await page.getByRole("columnheader").locator('button[data-demo^="grip-"]').allTextContents(), [
    "Name",
    "Status",
    "Amount",
  ]);
  await page.evaluate(() => window.accept());
  await page.waitForFunction(
    () =>
      document.querySelector('[role="columnheader"] button[data-demo^="grip-"]')?.getAttribute("data-demo") ===
      "grip-status",
  );
  assert.deepEqual(await page.getByRole("columnheader").locator('button[data-demo^="grip-"]').allTextContents(), [
    "Status",
    "Name",
    "Amount",
  ]);
  await mount(
    `window.changes=[];createRoot(document.getElementById('root')).render(<Subject.DataColumnWorkbench ${props} disabled onChange={(...p)=>window.changes.push(p)}/>);`,
  );
  assert.equal(await page.locator('[data-demo="pin-amount"]').isDisabled(), true);
  assert.equal(await resize.getAttribute("aria-disabled"), "true");
  await resize.press("ArrowRight");
  assert.deepEqual(await page.evaluate(() => window.changes), []);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.DataColumnWorkbench columns={[]} rows={[]}/>);`,
  );
  assert.equal(await page.getByRole("columnheader").count(), 0);
  await page.getByText("No columns to arrange.", { exact: true }).waitFor();
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  // Invalid ids and impossible dimensions have a written state, rather than corrupting a table.
  for (const invalid of [
    "columns={[{id:'x',label:'First'},{id:'x',label:'Duplicate'}]} rows={[]}",
    "columns={[{id:'',label:'Missing id'}]} rows={[]}",
    "columns={[{id:'x',label:'X',width:NaN}]} rows={[]}",
    "columns={[{id:'x',label:'X',minWidth:500}]} rows={[]}",
    `${props} value={[{id:'name',visible:true,pinned:false,width:NaN}]}`,
    `columns={${JSON.stringify(columns)}} rows={[{id:'a',cells:{}},{id:'a',cells:{}}]}`,
  ]) {
    await mount(`createRoot(document.getElementById('root')).render(<Subject.DataColumnWorkbench ${invalid}/>);`);
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByRole("table").count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  }
  // Bounds, required visibility and safe ids also hold for host-provided arrangements.
  await mount(
    `window.changes=[];createRoot(document.getElementById('root')).render(<Subject.DataColumnWorkbench ${props} defaultValue={[{id:'name',visible:false,pinned:false,width:10},{id:'status',visible:true,pinned:false,width:900},{id:'name',visible:true,pinned:true,width:300},{id:'foreign',visible:true,pinned:true,width:200}]} onChange={(value,change)=>window.changes.push({value,change})}/>);`,
  );
  assert.equal(
    await page.getByRole("separator", { name: "Resize Name", exact: true }).getAttribute("aria-valuenow"),
    "120",
  );
  assert.equal(
    await page.getByRole("separator", { name: "Resize Status", exact: true }).getAttribute("aria-valuenow"),
    "420",
  );
  assert.equal(await page.getByRole("columnheader").count(), 3);
  const strange = 'id"[]';
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.DataColumnWorkbench columns={[{id:${JSON.stringify(strange)},label:'Strange'},{id:'second',label:'Second'}]} rows={[]}/>);`,
  );
  await page.getByRole("button", { name: "Move Strange. Arrow keys move it left or right.", exact: true }).press("End");
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Move Strange. Arrow keys move it left or right.",
  );
}
