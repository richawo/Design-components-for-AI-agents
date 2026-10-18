export async function check({ page, mount, assert, capture = async () => {} }) {
  const review = () => page.getByRole("button", { name: "Review action", exact: true });
  const record = () => page.getByRole("button", { name: "Record recovery", exact: true });
  await mount(
    `window.recoveries=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.FulfilmentDesk onResolve={async action=>{window.recoveries.push(action);if(window.fail)throw Error('The carrier desk is offline.');await new Promise(resolve=>window.finishRecovery=resolve)}}/>);`,
  );
  assert.match(
    await page.getByRole("list", { name: "Parcel route", exact: true }).innerText(),
    /Picked[\s\S]+Address check[\s\S]+Collection/,
  );
  assert.equal(await review().isDisabled(), true);
  const first = page.getByRole("radio").first();
  await first.press("End");
  assert.equal(await page.getByRole("radio").last().getAttribute("aria-checked"), "true");
  await page.getByRole("radio").last().press("Home");
  assert.equal(await first.getAttribute("aria-checked"), "true");
  await page.getByRole("textbox", { name: "Action note", exact: true }).fill("Address verified with Maya.");
  await review().press("Enter");
  assert.match(await page.locator("section").innerText(), /Address verified with Maya\./);
  assert.equal(await page.getByRole("textbox", { name: "Action note", exact: true }).count(), 0);
  await capture("review", { audit: true });
  await record().click();
  await page.getByRole("alert").filter({ hasText: "The carrier desk is offline." }).waitFor();
  assert.match(await page.locator("section").innerText(), /Address verified with Maya\./);
  await capture("record-failed", { audit: true });
  await page.evaluate(() => (window.fail = false));
  await record().click();
  assert.equal(await page.locator('[data-demo="shipment-1"]').isDisabled(), true);
  assert.equal(await page.getByRole("searchbox", { name: "Find a shipment", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Edit decision", exact: true }).isDisabled(), true);
  await page.locator('[data-demo="confirm"]').evaluate((element) => element.click());
  assert.equal(await page.evaluate(() => window.recoveries.length), 2);
  const expected = { shipmentId: "s1", actionId: "label", note: "Address verified with Maya." };
  assert.deepEqual(await page.evaluate(() => window.recoveries), [expected, expected]);
  await capture("record-pending", { audit: true });
  await page.evaluate(() => window.finishRecovery());
  await page.getByText("Request a new label recorded for #4788", { exact: true }).waitFor();
  await capture("recorded", { audit: true });
  assert.doesNotMatch(await page.locator("section").innerText(), /Parcel delivered|Label replaced|Collection booked/);
  await page.getByRole("button", { name: "Record another action", exact: true }).click();
  await page.locator('[data-demo="shipment-1"]').click();
  await page.getByRole("textbox", { name: "Action note", exact: true }).fill("Stockroom is checking the second mug.");
  await page.locator('[data-demo="shipment-0"]').click();
  assert.equal(
    await page.getByRole("textbox", { name: "Action note", exact: true }).inputValue(),
    "Address verified with Maya.",
  );
  await page.locator('[data-demo="shipment-1"]').click();
  assert.equal(
    await page.getByRole("textbox", { name: "Action note", exact: true }).inputValue(),
    "Stockroom is checking the second mug.",
  );
  await page.getByRole("searchbox", { name: "Find a shipment", exact: true }).fill("not an order");
  assert.match(await page.getByRole("status").first().innerText(), /No shipments match/);
  await page.getByRole("searchbox", { name: "Find a shipment", exact: true }).fill("");

  await mount(`createRoot(document.getElementById('root')).render(<Subject.FulfilmentDesk/>);`);
  await page.getByRole("radio").first().click();
  await review().click();
  assert.equal(await record().isDisabled(), true);
  assert.match(await page.locator("section").innerText(), /Recording is currently unavailable/);
  const empty = `{id:'x',customer:'Aiko Tanaka',order:'#4800',destination:'Leeds',promise:'Today',issue:'Check stock',detail:'Review the pick.',items:[],actions:[]}`;
  await mount(`createRoot(document.getElementById('root')).render(<Subject.FulfilmentDesk shipments={[${empty}]}/>);`);
  assert.match(await page.locator("section").innerText(), /No recovery actions are available/);
  assert.match(await page.locator("section").innerText(), /No carrier events/);
  assert.equal(await review().isDisabled(), true);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.FulfilmentDesk shipments={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /No shipments need attention/);

  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.FulfilmentDesk shipments={[${empty},${empty}]}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /2 invalid or duplicate/);
  assert.match(await page.locator("section").innerText(), /No valid shipments/);
  assert.doesNotMatch(await page.locator("section").innerText(), /All clear/);

  // Duplicate action ids are not ambiguous targets; ordinary prototype-named ids remain valid.
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.FulfilmentDesk shipments={[{...${empty},id:'constructor',actions:[{id:'same',label:'Hold',detail:'Keep packed'},{id:'same',label:'Collect',detail:'Request collection'}]}]}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /2 invalid or duplicate/);
  assert.equal(await page.getByRole("radio").count(), 0);

  // Refreshing another parcel preserves the current parcel's unsaved note.
  await mount(
    `function Fixture(){const [revision,setRevision]=React.useState(1);window.refreshOther=()=>setRevision(2);return <Subject.FulfilmentDesk shipments={[{...${empty},id:'first',actions:[{id:'hold',label:'Hold parcel',detail:'Keep packed'}]},{...${empty},id:'constructor',order:'#4801',detail:'Revision '+revision}]}/>};createRoot(document.getElementById('root')).render(<Fixture/>);`,
  );
  await page
    .getByRole("textbox", { name: "Action note", exact: true })
    .fill("Keep the verified address with this parcel.");
  await page.evaluate(() => window.refreshOther());
  assert.equal(
    await page.getByRole("textbox", { name: "Action note", exact: true }).inputValue(),
    "Keep the verified address with this parcel.",
  );
  await page.locator('[data-demo="shipment-1"]').click();
  assert.match(await page.locator("section").innerText(), /Revision 2/);
  await page.getByRole("textbox", { name: "Action note", exact: true }).fill("Stock check requested.");
  await page.locator('[data-demo="shipment-0"]').click();
  assert.equal(
    await page.getByRole("textbox", { name: "Action note", exact: true }).inputValue(),
    "Keep the verified address with this parcel.",
  );

  const action = `{id:'hold',label:'Hold parcel',detail:'Keep packed at Leeds DC'}`;
  await mount(
    `function Fixture(){const [revision,setRevision]=React.useState(1);window.replaceShipment=()=>setRevision(2);return <Subject.FulfilmentDesk shipments={[{...${empty},detail:'Revision '+revision,actions:[${action}]}]} onResolve={()=>new Promise(resolve=>window.finishOldRecovery=resolve)}/>};createRoot(document.getElementById('root')).render(<Fixture/>);`,
  );
  await page.getByRole("radio").first().click();
  await review().click();
  await record().click();
  await page.evaluate(() => window.replaceShipment());
  await page.getByRole("button", { name: "Review action", exact: true }).waitFor();
  await page.evaluate(() => window.finishOldRecovery());
  assert.doesNotMatch(await page.locator("section").innerText(), /recorded for/);
  assert.match(await page.locator("section").innerText(), /Revision 2/);
}
