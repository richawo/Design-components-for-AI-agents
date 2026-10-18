export async function check({ page, mount, assert }) {
  const fields = [
    { id: "time", label: "Time", mine: "19:00", theirs: "20:00" },
    { id: "place", label: "Place", mine: "Home", theirs: "Lune" },
  ];
  const mine = { name: "You", initials: "YA", device: "phone", deviceName: "iPhone", editedAt: "10:00" };
  const theirs = { name: "Mara", initials: "MS", device: "laptop", deviceName: "MacBook", editedAt: "10:02" };
  const props = `fields={${JSON.stringify(fields)}} mine={${JSON.stringify(mine)}} theirs={${JSON.stringify(theirs)}}`;
  await mount(
    `window.choices=[];window.saves=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.MobileSyncConflict ${props} onChoose={v=>window.choices.push(v)} onSave={async v=>{window.saves.push(v);if(window.fail)throw Error('Conflict not synced');await new Promise(r=>window.finish=r)}}/>);`,
  );
  assert.equal(await page.getByRole("button", { name: "Save merged", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Keep yours time", exact: true }).press("Space");
  await page.getByRole("button", { name: "Keep Mara’s place", exact: true }).press("Enter");
  await page.waitForFunction(() => window.choices.length === 2);
  const first = [
    { fieldId: "time", choice: "mine", value: "19:00" },
    { fieldId: "place", choice: "theirs", value: "Lune" },
  ];
  assert.deepEqual(await page.evaluate(() => window.choices), first);
  await page.getByRole("button", { name: "Save merged", exact: true }).press("Enter");
  await page.getByRole("alert").filter({ hasText: "Conflict not synced" }).waitFor();
  await page.getByRole("button", { name: "Time: 19:00", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Keep Mara’s time", exact: true }).press("Enter");
  await page.waitForFunction(() => window.choices.length === 3);
  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "Save merged", exact: true }).press("Enter");
  assert.equal(await page.getByRole("button", { name: "Saving", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Place: Lune", exact: true }).isDisabled(), true);
  const revised = [{ fieldId: "time", choice: "theirs", value: "20:00" }, first[1]];
  assert.deepEqual(await page.evaluate(() => window.saves), [first, revised]);
  await page.evaluate(() => window.finish());
  await page.getByRole("heading", { name: "Conflict resolved", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Synced", exact: true }).isDisabled(), true);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileSyncConflict ${props} defaultChoices={{time:'mine',place:'theirs'}} onSave={()=>{}}/>);`,
  );
  assert.equal(await page.getByRole("button", { name: "Save merged", exact: true }).isEnabled(), true);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileSyncConflict ${props} defaultChoices={{time:'mine',place:'theirs'}}/>);`,
  );
  assert.equal(await page.getByRole("button", { name: "Save merged", exact: true }).isDisabled(), true);
  await page.getByText("Sync unavailable", { exact: true }).waitFor();
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileSyncConflict fields={[]} settled={[]}/>);`,
  );
  assert.equal(await page.getByRole("button", { name: "Save merged", exact: true }).isDisabled(), true);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  await page.getByText("No fields to resolve", { exact: true }).waitFor();
  assert.equal(await page.getByText("Ready to merge", { exact: true }).count(), 0);
  await page.getByText("Nothing to save", { exact: true }).waitFor();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await mount(
    `window.dragChoices=[];window.retired=null;createRoot(document.getElementById('root')).render(<Subject.MobileSyncConflict ${props} onChoose={choice=>{window.dragChoices.push(choice);const inspect=()=>{const old=document.querySelector('[aria-label="Keep Mara’s time"]');if(!old||old.closest('[aria-hidden="true"]')){window.retired={exists:!!old,inert:!!old?.closest('[inert]')};observer.disconnect();}};const observer=new MutationObserver(inspect);observer.observe(document.getElementById('root'),{attributes:true,attributeFilter:['aria-hidden'],childList:true,subtree:true});requestAnimationFrame(inspect)}}/>);`,
  );
  const from = await page.locator('[data-demo="card-theirs"]').boundingBox();
  const to = await page.locator('[data-demo="card-mine"]').boundingBox();
  assert.ok(from && to);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height * 0.35, { steps: 16 });
  await page.mouse.up();
  await page.waitForFunction(() => window.dragChoices.length === 1 && window.retired);
  assert.deepEqual(await page.evaluate(() => window.dragChoices), [
    { fieldId: "time", choice: "theirs", value: "20:00" },
  ]);
  const retired = await page.evaluate(() => window.retired);
  assert.ok(!retired.exists || retired.inert, "Retiring choices are inert as soon as their exit begins");
  await page.getByRole("button", { name: "Keep yours place", exact: true }).waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mount(
    `window.revisionCalls=[];function Host(){const [revision,setRevision]=useState('first');window.nextConflict=()=>setRevision('second');return <Subject.MobileSyncConflict key={revision} title={'Dinner '+revision} ${props} defaultChoices={{time:'mine',place:'theirs'}} onSave={()=>new Promise(resolve=>{window.revisionCalls.push(revision);window.finishPrevious=resolve})}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.getByRole("button", { name: "Save merged", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Saving", exact: true }).waitFor();
  await page.evaluate(() => window.nextConflict());
  await page.getByText("Dinner second", { exact: true }).waitFor();
  await page.evaluate(() => window.finishPrevious());
  assert.equal(await page.getByRole("heading", { name: "Conflict resolved", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Save merged", exact: true }).isEnabled(), true);
  assert.deepEqual(await page.evaluate(() => window.revisionCalls), ["first"]);
}
