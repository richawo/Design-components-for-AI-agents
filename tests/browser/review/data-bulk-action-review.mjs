export async function check({ page, mount, assert }) {
  const records = [
    { id: "a", name: "Mara", impact: "Remove one seat" },
    { id: "b", name: "Noor", impact: "Remove one seat" },
    { id: "held", name: "Sam", heldReason: "Workspace owner" },
  ];
  const props = `{...{records:${JSON.stringify(records)}}}`;
  await mount(
    `window.batches=[];window.done=[];window.fail=true;window.partial=true;createRoot(document.getElementById('root')).render(<Subject.DataBulkActionReview ${props} onApply={async ids=>{window.batches.push(ids);if(window.fail)throw Error('offline');if(window.partial)return ids.map(id=>({id,ok:id==='a',message:id==='b'?'Still active':undefined}));await new Promise(r=>window.finish=r);return ids.map(id=>({id,ok:true}))}} onDone={ids=>window.done.push(ids)}/>);`,
  );
  await page.getByRole("checkbox", { name: "Select all members", exact: true }).press("Space");
  await page.locator('[data-demo="review"]').press("Enter");
  await page.locator('[data-demo="confirm"]').press("Enter");
  await page
    .getByRole("alert")
    .filter({ hasText: /request didn’t go through/ })
    .waitFor();
  assert.deepEqual(await page.evaluate(() => window.batches[0]), ["a", "b"]);
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="confirm"]').press("Enter");
  await page.getByRole("button", { name: "Retry 1", exact: true }).waitFor();
  await page.evaluate(() => (window.partial = false));
  await page.getByRole("button", { name: "Retry 1", exact: true }).press("Enter");
  await page.locator('[data-demo="confirm"]').press("Enter");
  assert.equal(await page.locator('[data-demo="confirm"]').isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Back", exact: true }).isDisabled(), true);
  assert.deepEqual(await page.evaluate(() => window.batches), [["a", "b"], ["a", "b"], ["b"]]);
  await page.evaluate(() => window.finish());
  await page.getByRole("button", { name: "Done", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.done), [[]]);
  assert.equal(await page.getByRole("checkbox", { name: "Select Sam", exact: true }).isChecked(), true);
  assert.equal(await page.getByRole("checkbox", { name: "Select Mara", exact: true }).isChecked(), false);
  await mount(
    `window.done=[];createRoot(document.getElementById('root')).render(<Subject.DataBulkActionReview records={${JSON.stringify(records.slice(0, 2))}} defaultSelectedIds={['a','b']} onApply={async()=>[{id:'a',ok:true}]} onDone={ids=>window.done.push(ids)}/>);`,
  );
  await page.locator('[data-demo="review"]').press("Enter");
  await page.locator('[data-demo="confirm"]').press("Enter");
  await page.getByRole("button", { name: "Retry 1", exact: true }).waitFor();
  await page.getByRole("button", { name: "Done", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.done), [["b"]], "An omitted result stays unresolved");
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.DataBulkActionReview records={[]} onApply={async()=>[]}/>);`,
  );
  assert.equal(await page.locator('[data-demo="review"]').isDisabled(), true);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.DataBulkActionReview ${props} defaultSelectedIds={['a']}/>);`,
  );
  await page.locator('[data-demo="review"]').press("Enter");
  assert.equal(
    await page.locator('[data-demo="confirm"]').isDisabled(),
    true,
    "An unavailable host action cannot report success",
  );

  assert.equal(
    await page.getByRole("button", { name: "Done", exact: true }).count(),
    0,
    "No host action cannot produce a success receipt",
  );
  await mount(
    `window.applied=[];createRoot(document.getElementById('root')).render(<Subject.DataBulkActionReview ${props} selectedIds={['a','a','absent']} onApply={async ids=>{window.applied.push(ids);return ids.map(id=>({id,ok:true}))}}/>);`,
  );
  await page.locator('[data-demo="review"]').press("Enter");
  await page.locator('[data-demo="confirm"]').press("Enter");
  await page.getByRole("button", { name: "Done", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.applied), [["a"]]);
  await mount(
    `window.changed=[];window.done=[];createRoot(document.getElementById('root')).render(<Subject.DataBulkActionReview ${props} defaultSelectedIds={['a','b','held']} onSelectionChange={ids=>window.changed.push(ids)} onApply={async()=>[{id:'a',ok:true},{id:'a',ok:true},{id:'b',ok:false,message:'Still active'},{id:'foreign',ok:true}]} onDone={ids=>window.done.push(ids)}/>);`,
  );
  await page.locator('[data-demo="review"]').press("Enter");
  await page.locator('[data-demo="confirm"]').press("Enter");
  await page.getByRole("button", { name: "Done", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.done), [["b"]]);
  assert.deepEqual(
    await page.evaluate(() => window.changed.at(-1)),
    ["b", "held"],
    "Remaining picks keep their original order; held ids are not failed ids",
  );
  await mount(
    `window.done=[];createRoot(document.getElementById('root')).render(<Subject.DataBulkActionReview ${props} defaultSelectedIds={['a','b']} onApply={async()=>[{id:'a',ok:true},{id:'a',ok:false},{id:'b',ok:true}]} onDone={ids=>window.done.push(ids)}/>);`,
  );
  await page.locator('[data-demo="review"]').press("Enter");
  await page.locator('[data-demo="confirm"]').press("Enter");
  await page.getByRole("button", { name: "Done", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.done), [["a"]], "Conflicting reports cannot acknowledge a record");
  for (const extra of [
    "records={[{id:'a',name:'First'},{id:'a',name:'Duplicate'}]}",
    "records={[{id:'',name:'Missing id'}]}",
    "records={[{id:'a',name:''}]}",
  ]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.DataBulkActionReview ${extra} onApply={async()=>[]}/>);`,
    );
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator('[data-demo="confirm"]').count(), 0);
  }
  await mount(
    `window.applied=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.DataBulkActionReview ${props} defaultSelectedIds={['a','b','held']} onApply={async ids=>{window.applied.push(ids);if(window.fail)throw Error('offline');return ids.map(id=>({id,ok:true}))}}/>);`,
  );
  await page.locator('[data-demo="review"]').press("Enter");
  await page.locator('[data-demo="confirm"]').press("Enter");
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "Back", exact: true }).press("Enter");
  await page.getByRole("checkbox", { name: "Select Mara", exact: true }).press("Space");
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="review"]').press("Enter");
  await page.locator('[data-demo="confirm"]').press("Enter");
  await page.getByRole("button", { name: "Done", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.applied), [["a", "b"], ["b"]]);
  await mount(
    `window.done=[];function Host(){const [rows,setRows]=useState(${JSON.stringify(records)});return <Subject.DataBulkActionReview records={rows} defaultSelectedIds={['a','b','held']} onApply={async()=>{setRows(rows=>rows.filter(r=>r.id!=='a'));return [{id:'a',ok:true},{id:'b',ok:false,message:'Still active'}]}} onDone={ids=>window.done.push(ids)}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.locator('[data-demo="review"]').press("Enter");
  await page.locator('[data-demo="confirm"]').press("Enter");
  await page
    .getByRole("status")
    .filter({ hasText: "Confirmed: 1 member removed. 1 member still needs attention." })
    .waitFor();
  assert.equal(await page.getByRole("checkbox", { name: "Select Mara", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Done", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.done), [["b"]]);
  assert.equal(await page.getByRole("checkbox", { name: "Select Noor", exact: true }).isChecked(), true);
  assert.equal(await page.getByRole("checkbox", { name: "Select Sam", exact: true }).isChecked(), true);
}
