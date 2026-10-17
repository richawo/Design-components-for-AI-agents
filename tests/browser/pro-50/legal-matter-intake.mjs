const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");
const SUMMARY =
  "Negotiate a licence for anonymised mobility data from Meridian, including the international transfer " +
  "terms and a DPIA before the pilot starts in January.";
const MERIDIAN = { name: "Meridian Cloud Ltd", aliases: ["Meridian Hosting"], matter: "MAT-207", relation: "counterparty", owner: "Noor Ali", status: "open" };
const HARBOUR = { name: "Harbour Works Ltd", matter: "MAT-205", relation: "client", owner: "Jordan Blake", status: "open" };

export async function check({ page, mount, assert }) {
  await mount(`window.drafts=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.MatterIntake referenceDate="2026-10-17" onSubmit={async d=>{window.drafts.push(d);if(window.fail)throw Error('offline');return {reference:'MAT-2026-221'}}}/>);`);
  const root = page.getByRole("region", { name: "Matter intake, Matters · New matter" });
  const header = root.locator("header").first();
  const form = page.getByRole("form", { name: "Intake details" });
  const sheet = page.getByRole("article", { name: "Matter opening sheet" });
  const runCheck = page.locator('[data-demo="check"]');
  const submit = page.locator('[data-demo="submit"]');
  const announced = (re) => page.getByRole("status").filter({ hasText: re }).waitFor();

  // The sheet is the live review of the pre-filled draft; the check is the one item to go.
  assert.match(await txt(header), /7 of 8 1 to go/);
  assert.match(await txt(sheet), /Matter opening · Draft 17 Oct 2026/i);
  assert.match(await txt(sheet), /Atlas Research Ltd Data protection · England and Wales/);
  assert.match(await txt(sheet), /Responsible Priya Raman Fees Capped fee/i);
  assert.match(await txt(sheet), /Meridian Cloud Ltd Counterparty —/);
  assert.equal(await submit.isDisabled(), true);

  // Keyboard: a new party takes focus.
  await page.locator('[data-demo="add-party"]').focus();
  await page.keyboard.press("Enter");
  const party2 = page.getByLabel("Party 2 name", { exact: true });
  await party2.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Party 2 name");
  assert.equal(await runCheck.isDisabled(), true);
  // The same entity twice, ignoring case and suffixes, is refused.
  await page.keyboard.type("meridian cloud");
  await form.filter({ hasText: "The same party is listed twice." }).waitFor();
  await party2.fill("Harbour Works ");
  assert.doesNotMatch(await txt(form), /listed twice/);
  await sheet.filter({ hasText: "Harbour Works" }).waitFor();

  // Signature: the scan lands verdicts party by party and explains each match.
  await runCheck.click();
  await announced(/^2 potential conflicts, 1 direct\.$/);
  assert.match(await txt(sheet), /Atlas Research Ltd Client Clear/i);
  assert.match(await txt(sheet), /Meridian Cloud Ltd Counterparty Match/i);
  assert.match(await txt(sheet), /Harbour Works Counterparty Conflict/i);
  assert.match(await txt(sheet), /Harbour Works matches Harbour Works Ltd Client in MAT-205 \(open\) · Jordan Blake\. The firm acts for them\./);
  assert.match(await txt(sheet), /Meridian Cloud Ltd matches Meridian Cloud Ltd Counterparty in MAT-207 \(open\) · Noor Ali/);
  assert.match(await txt(runCheck), /Check again/);
  // The form shows each party's verdict too.
  assert.match(await txt(form), /1 match/);
  assert.match(await txt(form), /Atlas Research Ltd Client · checked with the parties Clear/);
  assert.match(await txt(header), /8 of 8 Ready to submit/);
  // A match is flagged, not decided: submitting needs the acknowledgement.
  assert.equal(await submit.isDisabled(), true);
  await form.filter({ hasText: "Confirm you’ve read the matches." }).waitFor();
  const ack = page.getByRole("checkbox", { name: /I’ve read the 2 matches/ });
  await ack.check();
  assert.equal(await submit.isDisabled(), false);

  // Changing any party makes the result stale.
  await page.getByLabel("Party 2 role", { exact: true }).selectOption("adverse");
  await form.filter({ hasText: "The parties changed since the last check. Run it again before submitting." }).waitFor();
  assert.equal(await submit.isDisabled(), true);
  assert.equal(await ack.count(), 0);
  assert.match(await txt(sheet), /Harbour Works Adverse party —/);
  assert.match(await txt(runCheck), /Run conflict check/);
  assert.match(await txt(header), /7 of 8 1 to go/);
  await runCheck.click();
  await announced(/^2 potential conflicts, 1 direct\.$/);
  // A fresh check asks for a fresh acknowledgement.
  assert.equal(await ack.isChecked(), false);
  await ack.check();

  // Submission fails first: everything is kept.
  await submit.click();
  await page.getByRole("alert").filter({ hasText: "Couldn’t submit. Everything you entered is kept." }).waitFor();
  await announced(/The intake wasn’t submitted\. Everything you entered is kept\./);
  assert.match(await txt(submit), /Try again/);
  assert.equal(await party2.inputValue(), "Harbour Works ");
  assert.equal(await ack.isChecked(), true);
  assert.equal(await page.getByLabel("Client or organisation", { exact: true }).inputValue(), "Atlas Research Ltd");

  await page.evaluate(() => (window.fail = false));
  await submit.click();
  await announced(/Intake submitted to the conflicts team\./);
  assert.equal(await page.evaluate(() => window.drafts.length), 2);
  assert.deepEqual(await page.evaluate(() => window.drafts[1]), {
    clientName: "Atlas Research Ltd",
    contactEmail: "legal@atlasresearch.io",
    practiceId: "data",
    ownerId: "priya",
    jurisdiction: "England and Wales",
    feeBasis: "capped",
    summary: SUMMARY,
    parties: [
      { id: "p1", name: "Meridian Cloud Ltd", role: "counterparty" },
      { id: "p2", name: "Harbour Works", role: "adverse" },
    ],
    conflicts: [
      { partyId: "p1", record: MERIDIAN, severity: "review" },
      { partyId: "p2", record: HARBOUR, severity: "conflict" },
    ],
    conflictsReviewed: true,
  });
  await form.filter({ hasText: "With the conflicts team as MAT-2026-221." }).waitFor();
  assert.match(await txt(form), /Priya Raman hears back once conflicts are cleared\./);
  assert.match(await txt(sheet), /^MAT-2026-221 17 Oct 2026/i);
  assert.match(await txt(sheet), /Submitted 17 Oct/i);
  assert.match(await txt(header), /Submitted/);
  assert.equal(await party2.isDisabled(), true);
  assert.equal(await page.locator('[data-demo="add-party"]').isDisabled(), true);

  // A host conflicts search that fails, then returns nothing.
  await mount(`window.checks=[];window.fail=true;window.sent=null;createRoot(document.getElementById('root')).render(<Subject.MatterIntake referenceDate="2026-10-17" defaultDraft={{clientName:'Acme Robotics',contactEmail:'legal@acme.dev',practiceId:'corporate',ownerId:'avery',jurisdiction:'Scotland',feeBasis:'fixed',summary:'Share purchase of a robotics start-up, including disclosure.',parties:[{id:'p1',name:'Volt Labs',role:'counterparty'}]}} onConflictCheck={async parties=>{window.checks.push(parties);if(window.fail)throw Error('timeout');return []}} onSubmit={d=>{window.sent=d}}/>);`);
  await page.locator('[data-demo="check"]').click();
  await page.getByRole("alert").filter({ hasText: "The conflicts register didn’t respond. Try the check again." }).waitFor();
  await page.getByRole("status").filter({ hasText: "The conflict check couldn’t run. Nothing was changed." }).waitFor();
  assert.equal(await page.locator('[data-demo="submit"]').isDisabled(), true);
  // A blank party can't be checked; removing it can.
  await page.locator('[data-demo="add-party"]').click();
  assert.equal(await page.locator('[data-demo="check"]').isDisabled(), true);
  await page.getByRole("button", { name: "Remove party 2" }).click();
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="check"]').click();
  await page.getByRole("status").filter({ hasText: "No conflicts found." }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.checks[1]), [
    { id: "client", name: "Acme Robotics", role: "client" },
    { id: "p1", name: "Volt Labs", role: "counterparty" },
  ]);
  assert.match(await txt(page.getByRole("article")), /Volt Labs Counterparty Clear/i);
  // No matches: no acknowledgement needed.
  assert.equal(await page.getByRole("checkbox").count(), 0);
  await page.locator('[data-demo="submit"]').click();
  await page.waitForFunction(() => window.sent);
  assert.equal(await page.evaluate(() => window.sent.conflictsReviewed), true);
  assert.deepEqual(await page.evaluate(() => window.sent.conflicts), []);
  await page.getByText("With the conflicts team.").waitFor();

  // An empty intake: nothing is ready, invalid input is called out.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MatterIntake referenceDate="2026-10-17" defaultDraft={{}}/>);`);
  const empty = page.getByRole("region", { name: /Matter intake/ });
  assert.match(await txt(empty.locator("header").first()), /0 of 8 8 to go/);
  assert.match(await txt(page.getByRole("article")), /Matter opening · Draft/i);
  assert.match(await txt(empty), /30 more characters, so conflicts know what the work is\./);
  const email = page.getByLabel("Contact email", { exact: true });
  await email.fill("legal@");
  assert.equal(await email.getAttribute("aria-invalid"), "true");
  await page.getByText("Enter a full email address.").waitFor();
  assert.equal(await page.locator('[data-demo="submit"]').isDisabled(), true);
  assert.equal(await page.locator('[data-demo="check"]').isDisabled(), true);
}
