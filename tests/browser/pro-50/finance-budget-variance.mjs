export async function check({ page, mount, assert }) {
  const section = () => page.locator("section").first();
  await mount(
    `window.notes=[];window.fail=true;window.failPack=true;window.packs=[];createRoot(document.getElementById('root')).render(<Subject.BudgetVariance onSaveNote={async(id,text)=>{window.notes.push([id,text]);if(window.fail){window.fail=false;throw Error('Notes are offline.')}}} onSubmit={async p=>{window.packs.push(p);if(window.failPack)throw Error('Review queue is offline.')}}/>);`,
  );
  assert.match(await section().innerText(), /2 to explain/);
  const spines = await page.locator('[data-demo="variance-spine"]').evaluateAll(nodes => nodes.flatMap(node => {
    const box = node.getBoundingClientRect();
    if (!box.width) return [];
    const bar = node.querySelector('[data-demo="variance-bar"]');
    return [{width:bar.getBoundingClientRect().width,available:box.width}];
  }));
  assert.equal(spines.length, 5);
  assert.ok(spines.every(spine => spine.width > 0), "Every non-zero department variance must draw its bar");
  assert.ok(spines[4].width / spines[4].available > 0.45, "People's +55.5% variance nearly reaches the 60% cap");
  const send = page.getByRole("button", { name: /Send to Priya/ });
  assert.equal(await send.isDisabled(), true);

  // Keyboard drill: Enter opens a department and focus lands on the way back.
  await page.getByRole("button", { name: /^Engineering:/ }).focus();
  await page.keyboard.press("Enter");
  const back = page.getByRole("button", { name: "All departments" });
  await back.waitFor();
  await page.waitForFunction(() => document.activeElement?.textContent?.includes("All departments"));

  // Cloud hosting is a material miss with no note: the editor asks the question.
  const editor = page.getByLabel("Why is cloud hosting £3,780.00 over?");
  await editor.fill("Load tests for the Northstar launch ran for nine days.");
  await editor.press("Control+Enter");
  await page.getByText("Notes are offline. Your note is still here.").waitFor();
  assert.equal(await editor.inputValue(), "Load tests for the Northstar launch ran for nine days.");
  await page.getByRole("button", { name: /Try again/ }).click();
  await page.getByText("Load tests for the Northstar launch ran for nine days.").waitFor();
  assert.deepEqual(await page.evaluate(() => window.notes[1]), ["eng-cloud", "Load tests for the Northstar launch ran for nine days."]);
  assert.match(await section().innerText(), /1 to explain/);

  // Back out from the keyboard; focus returns to the first department.
  await back.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "dept-eng");

  // Favourable is about the line, not the sign: under on paid social is good news.
  await page.getByRole("button", { name: /^Sales and marketing:/ }).click();
  await page.getByText("Paid social", { exact: true }).waitFor();
  assert.match(await section().innerText(), /−64\.3%\s*,? ?favourable/);
  await back.click();
  await page.getByRole("button", { name: /^People:/ }).waitFor();
  await page.getByRole("button", { name: /^People:/ }).click();
  await page.getByLabel("Why is recruiting £4,800.00 over?").fill("Agency fee for the senior engineer hire.");
  await page.getByRole("button", { name: "Save note" }).click();
  await page.getByText("Agency fee for the senior engineer hire.").waitFor();
  assert.match(await section().innerText(), /Ready for review/);
  await send.click();
  await page.getByText("Review queue is offline. Every note is kept.").waitFor();
  await page.evaluate(() => window.failPack = false);
  await page.getByRole("button", {name:"Try again", exact:true}).click();
  await page.getByText(/September 2026 variances sent to Priya Shah/).waitFor();
  assert.deepEqual(await page.evaluate(() => window.packs[1]), await page.evaluate(() => window.packs[0]));
  const pack = await page.evaluate(() => window.packs[1]);
  assert.equal(pack.notes.length, 4);
  assert.equal(pack.notes.every((n) => n.text.length > 0), true);

  // An edited material note must finish saving before the pack can be submitted.
  await mount(`window.packs=[];createRoot(document.getElementById('root')).render(<Subject.BudgetVariance defaultDepartmentId="a" materiality={{percent:10,minimumMinor:100}} departments={[{id:'a',name:'A',owner:'Ada',lines:[{id:'x',name:'Hosting',budgetMinor:10000,actualMinor:20000,note:{author:'Ada',text:'Original explanation.',date:'2026-10-16'}}]}]} onSaveNote={()=>new Promise(resolve=>window.finishNote=resolve)} onSubmit={p=>window.packs.push(p)}/>);`);
  await page.getByRole("button", {name:"Edit the note by Ada"}).click();
  const pendingNote = page.getByRole("textbox", {name:"Why is hosting £100.00 over?"});
  await pendingNote.fill("Revised explanation.");
  await page.getByRole("button", {name:"Save note",exact:true}).click();
  assert.equal(await page.getByRole("button", {name:"Send to Priya"}).isDisabled(), true);
  assert.equal(await pendingNote.isDisabled(), true);
  await page.evaluate(() => window.finishNote());
  await page.getByText("Revised explanation.", {exact:true}).waitFor();
  await page.getByRole("button", {name:"Send to Priya"}).click();
  await page.getByText(/variances sent to Priya Shah/).waitFor();
  assert.deepEqual(await page.evaluate(() => window.packs[0].notes), [{lineId:'x',text:'Revised explanation.'}]);

  // Invalid and empty data.
  const line = (id, budgetMinor, actualMinor) => ({ id, name: "Line " + id, budgetMinor, actualMinor });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.BudgetVariance departments={${JSON.stringify([{ id: "a", name: "A", owner: "Ada", lines: [line("x", 100, 100), line("x", 100, 200)] }])}}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /share the id/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.BudgetVariance departments={[]}/>);`);
  assert.match(await section().innerText(), /No budget for September 2026/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.BudgetVariance defaultDepartmentId="a" departments={${JSON.stringify([{ id: "a", name: "A", owner: "Ada", lines: [line("x", 0, 450000)] }])}}/>);`);
  assert.match(await section().innerText(), /Unbudgeted/);
  assert.doesNotMatch(await section().innerText(), /NaN|Infinity/);
}
