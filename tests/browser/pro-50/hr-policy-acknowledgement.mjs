export async function check({ page, mount, assert, choose }) {
  // A short policy fits without scrolling, so it reads as read; a new revision starts clear.
  await mount(`window.acks=[];window.fail=true;function App(){const [version,setVersion]=React.useState('1');window.revise=()=>setVersion('2');return <Subject.PolicyAcknowledgement policies={[{id:'work',name:'Work policy',version,effective:'2026-10-01',owner:'People',summary:'Approved working guidance.',sections:[{id:'one',heading:'Working arrangements',paragraphs:['Discuss changes with your manager.']}],statements:[{id:'read',text:'I read this exact revision.'}]}]} acknowledgements={[{policyId:'work',version:'0',employeeId:'EMP-104'}]} onAcknowledge={async p=>{window.acks.push(p);if(window.fail)throw Error('offline')}}/>}createRoot(document.getElementById('root')).render(<App/>);`);
  const sign = (v) => page.getByRole("button", { name: `Sign revision ${v}`, exact: true });
  assert.equal(await sign(1).isDisabled(), true);
  await page.getByRole("checkbox", { name: "I read this exact revision." }).check();
  await sign(1).click();
  await page.getByRole("status").filter({ hasText: "request failed" }).waitFor();
  assert.equal(await page.getByRole("checkbox").isChecked(), true);
  await page.evaluate(() => (window.fail = false));
  await sign(1).click();
  await page.getByRole("status").filter({ hasText: "Your acknowledgement of this revision is recorded" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.acks[1]), { policyId: "work", version: "1", employeeId: "EMP-104" });
  assert.match(await page.getByRole("region", { name: "Work policy, revision 1" }).innerText(), /Acknowledged\s+Maya Chen\s+EMP-104 · Revision 1/i);
  await page.evaluate(() => window.revise());
  await sign(2).waitFor();
  assert.equal(await page.getByRole("checkbox").isChecked(), false);
  assert.equal(await sign(2).isDisabled(), true);

  // The demo policy is long: signing stays locked until the reader reaches the end.
  await mount(`window.acks=[];window.reminders=[];window.failRemind=true;createRoot(document.getElementById('root')).render(<Subject.PolicyAcknowledgement onAcknowledge={p=>{window.acks.push(p)}} onRemind={async r=>{window.reminders.push(r);if(window.failRemind)throw Error('offline')}}/>);`);
  const team = page.getByRole("region", { name: "Team acknowledgements" });
  await team.filter({ hasText: /Team signed\s*7 \/ 12/ }).waitFor();
  const first = page.locator('[data-demo="statement-0"]');
  assert.equal(await first.isDisabled(), true);
  assert.equal(await sign("2.1").isDisabled(), true);
  // Keyboard reading: the document scrolls with End like any page.
  const doc = page.getByRole("region", { name: "Hybrid working, revision 2.1" });
  await doc.focus();
  await page.keyboard.press("End");
  await page.waitForFunction(() => !document.querySelector('[data-demo="statement-0"]').disabled);
  await first.check();
  await page.locator('[data-demo="statement-1"]').check();
  await sign("2.1").click();
  await page.getByText("Your acknowledgement of this revision is recorded").waitFor();
  assert.deepEqual(await page.evaluate(() => window.acks[0]), { policyId: "hybrid", version: "2.1", employeeId: "EMP-104" });
  await team.filter({ hasText: /Team signed\s*8 \/ 12/ }).waitFor();
  assert.match(await page.locator("section").first().innerText(), /Signed · v2\.1/);

  // Reminders go to everyone outstanding; a failure can be retried.
  await page.getByRole("button", { name: "Remind 4 people" }).click();
  await team.getByRole("status").filter({ hasText: "didn’t send" }).waitFor();
  await page.evaluate(() => (window.failRemind = false));
  await page.getByRole("button", { name: "Remind 4 people" }).click();
  await page.getByRole("button", { name: "Reminded 4 people" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.reminders[1]), {
    policyId: "hybrid",
    version: "2.1",
    employeeIds: ["EMP-071", "EMP-139", "EMP-118", "EMP-099"],
  });

  // Another policy, already signed in a previous session.
  await choose(page.locator('[data-demo="policy"]'), "security");
  assert.match(await page.locator("section").first().innerText(), /Signed · v4\.0/);
  await team.filter({ hasText: /Team signed\s*9 \/ 12/ }).waitFor();

  // Bad data is named; nothing to sign shows an empty state.
  const p = { name: "Leave", version: "1", effective: "2026-10-01", owner: "People", summary: "", sections: [], statements: [] };
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PolicyAcknowledgement policies={${JSON.stringify([{ ...p, id: "x" }, { ...p, id: "x" }])}}/>);`);
  const alert = await page.getByRole("alert").innerText();
  assert.match(alert, /appears twice/);
  assert.match(alert, /needs a version, at least one section and a statement/);
  assert.equal(await sign(1).isDisabled(), true);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PolicyAcknowledgement policies={[]}/>);`);
  assert.match(await page.locator("section").first().innerText(), /No policies to acknowledge/);
}
