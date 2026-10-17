const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");

export async function check({ page, mount, assert }) {
  await mount(`window.done=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.ObligationTracker referenceDate="2026-10-17" onComplete={async p=>{const c={obligationId:p.obligationId,evidence:p.evidence,keys:Object.keys(p)};if(p.file)c.file={name:p.file.name,size:p.file.size,isFile:p.file instanceof File};window.done.push(c);if(window.fail)throw Error('offline')}}/>);`);
  const root = page.getByRole("region", { name: "Obligations, Contracts · Q4 2026" });
  const figures = root.locator("dl").first();
  const group = (name) => page.getByRole("region", { name, exact: true });
  const pin = (id) => page.locator(`[data-demo="pin-${id}"]`);
  const row = (id) => page.locator(`[data-demo="obligation-${id}"]`);
  const evidence = page.getByLabel("Completion evidence", { exact: true });
  const record = page.locator('[data-demo="record"]');
  const announced = (re) => page.getByRole("status").filter({ hasText: re }).waitFor();

  // Buckets from the reference date; the most urgent open duty is selected.
  assert.match(await txt(figures), /Overdue 1 Due in 7 days 2 Done 1/);
  assert.match(await txt(group("Overdue")), /Deliver the quarterly service report 2 days overdue/);
  assert.match(await txt(group("Due in 7 days")), /Give notice of the data migration 21 Oct · 4 days/);
  assert.match(await txt(group("Due in 7 days")), /Send the renewed insurance certificate 23 Oct · 6 days/);
  assert.match(await txt(group("Later")), /Review the permitted user list/);
  assert.match(await txt(group("Done")), /Provide the signed handover record Done 8 Oct/);
  assert.equal(await pin("ob-014").getAttribute("aria-label"), "Deliver the quarterly service report, 2 days overdue");
  assert.equal(await pin("ob-014").getAttribute("aria-pressed"), "true");
  assert.equal(await row("ob-014").getAttribute("aria-current"), "true");
  assert.match(await txt(root), /Today · 17 Oct/);

  // Keyboard: choose a pin on the timeline; its clause is set on paper with the duty marked.
  await pin("ob-017").focus();
  await page.keyboard.press("Enter");
  assert.equal(await pin("ob-017").getAttribute("aria-pressed"), "true");
  assert.equal(await pin("ob-014").getAttribute("aria-pressed"), "false");
  const clause = page.getByRole("article", { name: "Meridian Cloud · Hosting, Clause 8.2" });
  await clause.waitFor();
  assert.equal(await clause.locator("mark").innerText(), "give the Supplier not less than 30 days’ written notice");
  assert.match(await txt(clause), /Owner Avery Kim Due 21 Oct 2026 Recurs Once/i);
  assert.equal(await row("ob-017").getAttribute("aria-current"), "true");

  // Evidence needs 8 characters; the hint is tied to the field.
  const hintId = await evidence.getAttribute("aria-describedby");
  assert.match(await page.locator(`[id="${hintId}"]`).innerText(), /Say what was done and where it’s filed/);
  await evidence.fill("  Sent  ");
  assert.equal(await record.isDisabled(), true);
  await evidence.fill("Notice served by recorded delivery, ref RD-2291.");
  assert.equal(await record.isDisabled(), false);
  await page.locator('input[type="file"]').setInputFiles({ name: "meridian-migration-notice.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(3000, 1) });
  await page.getByRole("button", { name: "Remove meridian-migration-notice.pdf" }).waitFor();

  // The host rejects first: evidence and file are kept.
  await record.click();
  await page.getByRole("alert").filter({ hasText: "Couldn’t record it. Your evidence and file are kept." }).waitFor();
  await announced(/Give notice of the data migration wasn’t recorded\. Your evidence is kept\./);
  assert.match(await txt(record), /Try again/);
  assert.equal(await evidence.inputValue(), "Notice served by recorded delivery, ref RD-2291.");
  await page.getByRole("button", { name: "Remove meridian-migration-notice.pdf" }).waitFor();
  assert.match(await txt(group("Due in 7 days")), /Give notice of the data migration/);
  // The draft survives selecting another obligation.
  await row("ob-015").click();
  await page.getByRole("article", { name: /Clause 12\.3/ }).waitFor();
  assert.equal(await evidence.inputValue(), "");
  await row("ob-017").click();
  await clause.waitFor();
  assert.equal(await evidence.inputValue(), "Notice served by recorded delivery, ref RD-2291.");
  await page.getByRole("button", { name: "Remove meridian-migration-notice.pdf" }).waitFor();

  await page.evaluate(() => (window.fail = false));
  await record.click();
  await announced(/Completion evidence recorded for Give notice of the data migration\./);
  assert.equal(await page.evaluate(() => window.done.length), 2);
  assert.deepEqual(await page.evaluate(() => window.done[1]), {
    obligationId: "OB-017",
    evidence: "Notice served by recorded delivery, ref RD-2291.",
    keys: ["obligationId", "evidence", "file"],
    file: { name: "meridian-migration-notice.pdf", size: 3000, isFile: true },
  });
  // Stamped done, with the evidence slip; the row moves into Done and the pin turns done.
  await root.filter({ hasText: /Evidence · recorded 17 Oct/i }).waitFor();
  assert.match(await txt(clause), /Done 17 Oct/i);
  assert.match(await txt(root), /meridian-migration-notice\.pdf/);
  assert.equal(await evidence.count(), 0);
  assert.match(await txt(group("Done")), /Give notice of the data migration Done 17 Oct/);
  assert.doesNotMatch(await txt(group("Due in 7 days")), /data migration/);
  assert.equal(await pin("ob-017").getAttribute("aria-label"), "Give notice of the data migration, Done 17 Oct");
  assert.match(await txt(figures), /Overdue 1 Due in 7 days 1 Done 2/);

  // Keyboard-only completion without a file: the payload has no file.
  await row("ob-014").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("article", { name: /Schedule 2, paragraph 4/ }).waitFor();
  await evidence.focus();
  await page.keyboard.type("Q3 report emailed to the contract manager on 16 Oct.");
  await record.focus();
  await page.keyboard.press("Enter");
  await announced(/Completion evidence recorded for Deliver the quarterly service report\./);
  assert.deepEqual(await page.evaluate(() => window.done.at(-1)), {
    obligationId: "OB-014",
    evidence: "Q3 report emailed to the contract manager on 16 Oct.",
    keys: ["obligationId", "evidence"],
  });
  assert.equal(await group("Overdue").count(), 0);

  // Scopes: nothing overdue now, and Show all recovers.
  await page.getByRole("radio", { name: "Overdue" }).click();
  await root.filter({ hasText: "Nothing is overdue." }).waitFor();
  await root.getByRole("button", { name: "Show all" }).click();
  await page.getByRole("radio", { name: "All", checked: true }).waitFor();
  await page.getByRole("radio", { name: /^Open/ }).click();
  assert.match(await txt(page.getByRole("radio", { name: /^Open/ })), /Open 3/);
  assert.equal(await group("Done").count(), 0);
  await page.getByRole("radio", { name: "Done" }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-demo^="obligation-"]').length === 3);

  // Invalid dates stay explicit and get no pin; a duty that isn't in the wording isn't marked.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ObligationTracker referenceDate="2026-10-17" obligations={[{id:'X1',contract:'Acme · MSA',title:'Annual audit',owner:'Ada Park',due:'2026-02-30',clause:'Clause 9',detail:'Allow the annual audit.',duty:'not in the text',complete:false}]}/>);`);
  const bad = page.getByRole("region", { name: /Obligations/ });
  assert.match(await txt(bad), /Annual audit No due date/);
  assert.match(await txt(page.getByRole("article")), /Allow the annual audit\./);
  assert.match(await txt(page.getByRole("article")), /Due Not recorded/i);
  assert.equal(await page.getByRole("article").locator("mark").count(), 0);
  assert.equal(await page.locator('[data-demo^="pin-"]').count(), 0);

  // No obligations.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ObligationTracker referenceDate="2026-10-17" obligations={[]}/>);`);
  await page.getByText("No obligations recorded yet.").waitFor();
}
