export async function check({ page, mount, assert }) {
  const fields = [
    { id: "state", label: "Status", kind: "text" },
    { id: "mrr", label: "MRR", kind: "currency" },
  ];
  const records = [
    { id: "a", label: "Acme", values: { state: "Active", mrr: 12000 } },
    { id: "b", label: "Beacon", values: { state: "At risk", mrr: 5000 } },
  ];
  const history = [
    { id: "all", name: "All accounts", savedAt: "09:00", rules: [] },
    { id: "risk", name: "At risk", savedAt: "09:15", rules: [{ fieldId: "state", operator: "is", value: "At risk" }] },
  ];
  const props = `fields={${JSON.stringify(fields)}} records={${JSON.stringify(records)}}`;
  await mount(
    `window.renames=[];window.restores=[];window.fail=true;function Story(){const [history,setHistory]=useState(${JSON.stringify(history)});return <Subject.DataFilterHistory ${props} history={history} defaultValue={[{fieldId:'state',operator:'is',value:'Active'}]} defaultSnapshotId="risk" onRename={async(id,name)=>{window.renames.push({id,name});if(window.fail)throw Error('offline');await new Promise(r=>window.finishRename=r);setHistory(rows=>rows.map(row=>row.id===id?{...row,name}:row))}} onValueChange={(rules,id)=>window.restores.push({rules,id})}/>};createRoot(document.getElementById('root')).render(<Story/>);`,
  );
  const strip = page.getByRole("slider", { name: "Filter history", exact: true });
  assert.match(await strip.getAttribute("aria-valuetext"), /At risk/);
  await page.locator('[data-demo="rename"]').press("Enter");
  const input = page.getByRole("textbox", { name: "Snapshot name", exact: true });
  await input.fill("Renewal priorities");
  await input.press("Enter");
  await page
    .getByRole("alert")
    .filter({ hasText: /Couldn’t rename/ })
    .waitFor();
  assert.equal(await input.inputValue(), "Renewal priorities");
  await page.evaluate(() => (window.fail = false));
  await input.press("Enter");
  assert.equal(await page.getByRole("button", { name: "Save name", exact: true }).isDisabled(), true);
  assert.equal(await input.isDisabled(), true);
  await page.evaluate(() => window.finishRename());
  await page.getByRole("button", { name: "Rename “Renewal priorities”", exact: true }).waitFor();
  assert.deepEqual(
    await page.evaluate(() => window.renames),
    Array(2).fill({ id: "risk", name: "Renewal priorities" }),
  );
  await page.locator('[data-demo="restore"]').press("Enter");
  assert.deepEqual(await page.evaluate(() => window.restores), [{ rules: history[1].rules, id: "risk" }]);
  assert.match(await strip.getAttribute("aria-valuetext"), /Live view/);
  assert.equal(await page.locator('[data-demo="restore"]').count(), 0, "Retired restore leaves immediately");
  await strip.press("Home");
  assert.match(await strip.getAttribute("aria-valuetext"), /All accounts/);
  await strip.press("End");
  assert.match(await strip.getAttribute("aria-valuetext"), /Live view/);
  const box = await strip.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width - 5, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 5, box.y + box.height / 2, { steps: 15 });
  await page.mouse.up();
  assert.equal(await strip.getAttribute("aria-valuenow"), "0");
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.DataFilterHistory ${props} history={${JSON.stringify(history)}} defaultSnapshotId="risk" disabled/>);`,
  );
  assert.equal(await page.locator('[data-demo="rename"]').count(), 0);
  assert.equal(await page.locator('[data-demo="restore"]').isDisabled(), true);
  await strip.press("End");
  assert.match(await strip.getAttribute("aria-valuetext"), /Live view/);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.DataFilterHistory fields={[]} records={[]} history={[]} defaultValue={[]}/>);`,
  );
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|filters excluded|Step forward/);

  // A late result from one caption cannot close or reject another caption's draft.
  for (const rejected of [false, true]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.DataFilterHistory ${props} history={${JSON.stringify(history)}} defaultSnapshotId="risk" onRename={async()=>await new Promise((resolve,reject)=>{window.finish=()=>${rejected ? "reject(Error('offline'))" : "resolve()"}})}/>);`,
    );
    await page.locator('[data-demo="rename"]').press("Enter");
    await page.getByRole("textbox", { name: "Snapshot name" }).fill("Risk draft");
    await page.getByRole("textbox", { name: "Snapshot name" }).press("Enter");
    assert.equal(await page.getByRole("textbox", { name: "Snapshot name" }).isDisabled(), true);
    await strip.press("Home");
    await page.getByRole("button", { name: "Rename “All accounts”", exact: true }).press("Enter");
    const name = page.getByRole("textbox", { name: "Snapshot name" });
    assert.equal(await name.isDisabled(), false, "Another snapshot owns its own rename state");
    await name.fill("All draft");
    await page.evaluate(() => window.finish());
    await page.waitForTimeout(250);
    assert.equal(await name.inputValue(), "All draft");
    assert.equal(await page.getByRole("alert").count(), 0);
    await name.press("Escape");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "rename");
  }
  await mount(
    `function Host(){const [history,setHistory]=useState(${JSON.stringify(history)});window.prepend=()=>setHistory(h=>[{id:'older',name:'Older',savedAt:'08:00',rules:[]},...h]);window.append=()=>setHistory(h=>[...h,{id:'latest',name:'Latest',savedAt:'10:00',rules:[]}]);window.remove=()=>setHistory(h=>h.filter(s=>s.id!=='risk'));return <Subject.DataFilterHistory ${props} history={history} defaultSnapshotId="risk"/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.evaluate(() => window.prepend());
  await page.waitForFunction(() =>
    document.querySelector('[role="slider"]').getAttribute("aria-valuetext").includes("At risk"),
  );
  assert.equal(await strip.getAttribute("aria-valuenow"), "2");
  await strip.press("End");
  await page.evaluate(() => window.append());
  await page.waitForFunction(() => document.querySelector('[role="slider"]').getAttribute("aria-valuemax") === "4");
  assert.match(await strip.getAttribute("aria-valuetext"), /Live view/, "Live stays live when history grows");
  await strip.press("Home");
  await strip.press("ArrowRight");
  await strip.press("ArrowRight");
  assert.match(await strip.getAttribute("aria-valuetext"), /At risk/);
  await page.evaluate(() => window.remove());
  await page.waitForFunction(() =>
    document.querySelector('[role="slider"]').getAttribute("aria-valuetext").includes("Live view"),
  );
  // Missing values never satisfy is_not. Rules are copied before publication.
  await mount(
    `window.restores=[];createRoot(document.getElementById('root')).render(<Subject.DataFilterHistory fields={${JSON.stringify(fields)}} records={[{id:'missing',label:'Missing',values:{}},{id:'a',label:'Acme',values:{state:'Active',mrr:12000}}]} history={[{id:'filtered',name:'Not at risk',savedAt:'09:00',rules:[{fieldId:'state',operator:'is_not',value:'At risk'}]}]} defaultSnapshotId="filtered" onValueChange={(rules,id)=>{window.restores.push({rules:structuredClone(rules),id});rules[0].value='Host mutation'}}/>);`,
  );
  assert.match(await strip.getAttribute("aria-valuetext"), /1 row$/);
  await page.locator('[data-demo="restore"]').press("Enter");
  assert.deepEqual(await page.evaluate(() => window.restores), [
    { rules: [{ fieldId: "state", operator: "is_not", value: "At risk" }], id: "filtered" },
  ]);
  await strip.press("Home");
  await page.locator('[data-demo="restore"]').press("Enter");
  assert.equal(
    await page.evaluate(() => window.restores[1].rules[0].value),
    "At risk",
    "Host mutation cannot alter a saved rule",
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.DataFilterHistory fields={[{id:'state',label:'Status',kind:'text'}]} records={[{id:'empty',label:'Empty account',values:{state:null}},{id:'text',label:'Text account',values:{state:'null'}}]} history={[{id:'empty-view',name:'Empty status',savedAt:'09:00',rules:[{fieldId:'state',operator:'is',value:null}]}]} defaultValue={[{fieldId:'state',operator:'is',value:'null'}]} defaultSnapshotId="empty-view"/>);`,
  );
  assert.equal(await page.getByText("(a restore adds this rule)", { exact: true }).count(), 1);
  assert.equal(await page.getByText("(a restore removes this rule)", { exact: true }).count(), 1);
  assert.equal(
    await page.getByText("Empty", { exact: true }).count(),
    1,
    "An empty filter is distinct from the string null",
  );
  // Controlled rules without a change handler cannot pretend to restore.
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.DataFilterHistory ${props} history={${JSON.stringify(history)}} value={[]} defaultSnapshotId="risk"/>);`,
  );
  assert.equal(await page.locator('[data-demo="restore"]').isDisabled(), true);
  for (const invalid of [
    `fields={[{id:'state',label:'First',kind:'text'},{id:'state',label:'Duplicate',kind:'text'}]} records={[]} history={[]}`,
    `${props} history={[{id:'same',name:'First',savedAt:'09:00',rules:[]},{id:'same',name:'Duplicate',savedAt:'09:10',rules:[]}]}`,
    `${props} history={[{id:'live',name:'Reserved',savedAt:'09:00',rules:[]}]}`,
    `${props} history={[]} value={[{fieldId:'missing',operator:'is',value:'Active'}]}`,
    `${props} history={[]} value={[{fieldId:'mrr',operator:'gte',value:NaN}]}`,
    `fields={${JSON.stringify(fields)}} records={[{id:'a',label:'First',values:{}},{id:'a',label:'Duplicate',values:{}}]} history={[]}`,
    `${props} history={[]} locale="not_a_locale"`,
    `${props} history={[]} currency="$"`,
  ]) {
    await mount(`createRoot(document.getElementById('root')).render(<Subject.DataFilterHistory ${invalid}/>);`);
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByRole("slider").count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  }
}
