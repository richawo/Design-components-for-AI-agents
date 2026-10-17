const LIABILITY =
  "Each party’s total aggregate liability arising out of or in connection with this Agreement shall " +
  "not exceed the Liability Cap.\n\nNeither party shall be liable for any indirect or consequential " +
  "Losses, or for any loss of profits, revenue or goodwill, whether arising in contract, tort " +
  "(including negligence) or otherwise.";

const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");

export async function check({ page, mount, assert }) {
  await mount(`window.insertions=[];window.undos=[];window.fail=true;window.failUndo=false;createRoot(document.getElementById('root')).render(<Subject.ClauseLibrary onInsert={async p=>{window.insertions.push(p);if(window.fail)throw Error('locked')}} onUndo={async p=>{window.undos.push(p);if(window.failUndo)throw Error('offline')}}/>);`);
  const root = page.locator(".lcl-root");
  const draft = page.getByRole("article", { name: /Master Services Agreement, MSA-2026-114/ });
  const title = () => page.getByRole("heading", { level: 2 }).innerText();
  const insert = page.locator('[data-demo="insert"]');
  const announced = (re) => page.getByRole("status").filter({ hasText: re }).waitFor();
  const header = page.locator("header").first();

  // The playbook gap is counted, and the open section expects the liability clause.
  assert.match(await txt(header), /1 playbook clause missing/);
  assert.equal(await title(), "Limitation of liability");
  assert.match(await txt(draft), /Playbook clause required/);
  assert.match(await insert.innerText(), /Insert as clause 7/);

  // Insert fails first: the selection and the open slot are kept, with a retry.
  await insert.click();
  const alert = page.getByRole("alert");
  await alert.filter({ hasText: /didn’t accept the clause/ }).waitFor();
  await announced(/wasn’t inserted\. Your selection is kept/);
  assert.equal(await title(), "Limitation of liability");
  assert.equal(await insert.isDisabled(), false);
  assert.match(await txt(draft), /Playbook clause required/);
  assert.match(await txt(header), /1 playbook clause missing/);

  // Retry from the alert succeeds and writes the approved wording into section 7.
  await page.evaluate(() => (window.fail = false));
  await alert.getByRole("button", { name: "Try again" }).click();
  await announced(/Inserted Limitation of liability v3\.0 as clause 7/);
  assert.equal(await page.evaluate(() => window.insertions.length), 2);
  assert.deepEqual(await page.evaluate(() => window.insertions[1]), {
    clauseId: "CL-014",
    version: "3.0",
    text: LIABILITY,
    sectionId: "s7",
    number: "7",
  });
  await draft.filter({ hasText: "CL-014 · v3.0 from library" }).waitFor();
  assert.match(await txt(draft), /7\.2\s*Neither party shall be liable/);
  assert.match(await txt(draft), /1 change/i);
  assert.match(await txt(header), /Playbook complete/);
  // The same clause can't go in twice.
  assert.match(await insert.innerText(), /In draft · clause 7/);
  assert.equal(await insert.isDisabled(), true);
  await root.filter({ hasText: /Already in the draft as clause 7\./ }).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);

  // Undo that the host rejects puts the clause back and says so.
  await page.evaluate(() => (window.failUndo = true));
  await page.getByRole("button", { name: "Undo" }).click();
  await announced(/Undo failed\. The clause is still in the draft/);
  assert.match(await txt(draft), /CL-014 · v3\.0 from library/);
  assert.match(await txt(header), /Playbook complete/);
  // A successful undo reopens the slot and reports the same insertion.
  await page.evaluate(() => (window.failUndo = false));
  await page.getByRole("button", { name: "Undo" }).click();
  await announced(/Removed Limitation of liability from clause 7/);
  assert.deepEqual(await page.evaluate(() => window.undos.at(-1)), {
    clauseId: "CL-014",
    version: "3.0",
    text: LIABILITY,
    sectionId: "s7",
    number: "7",
  });
  await header.filter({ hasText: /1 playbook clause missing/ }).waitFor();
  assert.doesNotMatch(await txt(draft), /from library/);

  // A retired revision is refused with a reason; the redline compares it with the previous one.
  await page.getByRole("radio", { name: "v2.1" }).click();
  await root.filter({ hasText: /v2\.1 is retired\. Switch to the approved revision to insert\./ }).waitFor();
  assert.equal(await insert.isDisabled(), true);
  await page.getByRole("radio", { name: "v3.0" }).click();
  assert.equal(await page.getByRole("radio", { name: "v3.0" }).getAttribute("aria-checked"), "true");
  const changes = page.getByRole("switch");
  await changes.check();
  await root.filter({ hasText: /Inserted: / }).waitFor();
  assert.match(await txt(root), /Deleted: /);
  assert.match(await txt(root), /\+\d+\s*−\d+/);
  await changes.uncheck();
  await page.waitForFunction(() => !document.querySelector(".lcl-add"));

  // Keyboard: a defined term explains itself on focus and closes on Escape.
  const term = page.getByRole("button", { name: "Liability Cap", exact: true }).first();
  await term.focus();
  const tip = page.getByRole("tooltip");
  await tip.filter({ hasText: /125% of the Fees/ }).waitFor();
  assert.equal(await term.getAttribute("aria-expanded"), "true");
  await page.keyboard.press("Escape");
  await tip.waitFor({ state: "detached" });

  // Keyboard: choose a clause from the library with Enter.
  const library = page.getByRole("navigation", { name: "Clause library" });
  await page.locator('[data-demo="clause-cl-030"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { level: 2, name: "Termination for convenience" }).waitFor();
  assert.equal(await page.locator('[data-demo="clause-cl-030"]').getAttribute("aria-current"), "true");
  // It opens on the approved revision; the newer draft is refused.
  assert.equal(await page.getByRole("radio", { name: "v1.3" }).getAttribute("aria-checked"), "true");
  await page.getByRole("radio", { name: "v1.4" }).press("Enter");
  await root.filter({ hasText: /v1\.4 is still in review\. Only approved revisions go into an agreement\./ }).waitFor();
  assert.equal(await insert.isDisabled(), true);
  // A draft-only clause can never be inserted.
  await page.locator('[data-demo="clause-cl-047"]').click();
  await page.getByRole("heading", { level: 2, name: "Use of AI tools" }).waitFor();
  assert.equal(await insert.isDisabled(), true);
  assert.match(await txt(root), /v0\.9 is still in review/);

  // Search and category filters, with an empty result that can be cleared.
  const search = page.getByLabel("Search clauses", { exact: true });
  await search.fill("48 hours");
  await page.waitForFunction(() => document.querySelectorAll('nav[aria-label="Clause library"] li').length === 1);
  assert.match(await txt(library), /Data protection/);
  await search.fill("arbitration seat");
  await library.filter({ hasText: /Nothing matches “arbitration seat”/ }).waitFor();
  await library.getByRole("button", { name: "Clear filters" }).click();
  assert.equal(await search.inputValue(), "");
  await page.waitForFunction(() => document.querySelectorAll('nav[aria-label="Clause library"] li').length === 7);
  await library.getByRole("button", { name: "General", exact: true }).click();
  assert.equal(await library.getByRole("button", { name: "General", exact: true }).getAttribute("aria-pressed"), "true");
  await page.waitForFunction(() => document.querySelectorAll('nav[aria-label="Clause library"] li').length === 2);

  // With the playbook slot filled, another clause is added as a new section after the last one.
  await library.getByRole("button", { name: "All", exact: true }).click();
  await page.locator('[data-demo="clause-cl-014"]').click();
  await page.getByRole("heading", { level: 2, name: "Limitation of liability" }).waitFor();
  await insert.click();
  await announced(/as clause 7/);
  await page.locator('[data-demo="clause-cl-041"]').click();
  await page.getByRole("heading", { level: 2, name: "Governing law" }).waitFor();
  assert.match(await insert.innerText(), /Add as clause 10/);
  await insert.click();
  await announced(/Inserted Governing law v1\.0 as clause 10/);
  const added = await page.evaluate(() => window.insertions.at(-1));
  assert.equal(added.sectionId, "added-cl-041");
  assert.equal(added.number, "10");
  assert.equal(added.version, "1.0");
  assert.match(await txt(draft), /10\.\s*Governing law/);
  assert.match(await txt(draft), /2 changes/i);

  // Empty library.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ClauseLibrary clauses={[]}/>);`);
  assert.match(await txt(page.locator(".lcl-root")), /The clause library is empty/);
}
