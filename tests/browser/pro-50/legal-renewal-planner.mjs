const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");

export async function check({ page, mount, assert }) {
  await mount(`window.decisions=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.RenewalPlanner referenceDate="2026-10-17" onDecision={async p=>{window.decisions.push(p);if(window.fail)throw Error('offline')}}/>);`);
  const root = page.getByRole("region", { name: "Renewal planner" });
  const summary = root.locator("dl").first();
  const row = (name) => page.getByRole("button", { name });
  const announced = (re) => page.getByRole("status").filter({ hasText: re }).waitFor();

  // Deadlines are counted from the reference date, earliest first.
  assert.match(await txt(row(/Harbour Works/)), /2 days ago Notice missed/);
  assert.match(await txt(row(/Ledgerline/)), /14 days Notice closing/);
  assert.match(await txt(row(/Fieldnote/)), /15 days Review window open/);
  assert.match(await txt(row(/Northline Studio/)), /Renegotiate/);
  assert.equal(await row(/Harbour Works/).getAttribute("aria-pressed"), "true");
  assert.match(await txt(summary), /Notice due in 30 days 2 £82,400/);
  assert.match(await txt(summary), /Missed, auto-renewing 1 £36,000/);
  assert.match(await txt(summary), /Decisions on file 1 of 6/);

  // Signature: move the as-of line by keyboard and watch deadlines lapse.
  const asOf = page.getByRole("slider", { name: "Plan as of date" });
  assert.equal(await asOf.getAttribute("aria-valuetext"), "Today, 17 Oct 2026");
  await asOf.focus();
  await page.keyboard.press("PageUp");
  await page.keyboard.press("PageUp");
  assert.equal(await asOf.getAttribute("aria-valuetext"), "As of 31 Oct 2026");
  assert.match(await txt(row(/Ledgerline/)), /0 days Notice closing/);
  await page.keyboard.press("ArrowRight");
  assert.equal(await asOf.getAttribute("aria-valuetext"), "As of 1 Nov 2026");
  assert.match(await txt(row(/Ledgerline/)), /1 day ago Notice missed/);
  assert.match(await txt(summary), /Missed, auto-renewing 2 £94,400/);
  await page.keyboard.press("ArrowLeft");
  assert.equal(await asOf.getAttribute("aria-valuetext"), "As of 31 Oct 2026");
  await page.keyboard.press("Home");
  assert.equal(await asOf.getAttribute("aria-valuetext"), "Today, 17 Oct 2026");
  await page.keyboard.press("PageDown");
  await root.getByRole("button", { name: "Back to today" }).click();
  assert.equal(await asOf.getAttribute("aria-valuetext"), "Today, 17 Oct 2026");
  assert.match(await txt(summary), /Missed, auto-renewing 1 £36,000/);

  // Keyboard: open a contract from the timeline.
  await row(/Ledgerline/).focus();
  await page.keyboard.press("Enter");
  assert.equal(await row(/Ledgerline/).getAttribute("aria-pressed"), "true");
  await root.getByRole("heading", { level: 2, name: /Ledgerline · Payroll platform/ }).waitFor();
  assert.match(await txt(root), /Notice by 31 Oct 2026 Renews 30 Dec 2026 Status 14 days to notice/);
  assert.match(await txt(root), /at least 60 days’ written notice/);

  // Recording needs a decision.
  const record = page.locator('[data-demo="record"]');
  assert.equal(await record.isDisabled(), true);
  assert.match(await txt(root), /Choose what happens at renewal\./);
  const terminate = page.getByRole("radio", { name: /^Terminate/ });
  await terminate.focus();
  await page.keyboard.press("Space");
  assert.equal(await terminate.isChecked(), true);
  const note = page.getByLabel("Rationale for the file", { exact: true });
  await note.fill("  Moving payroll in-house from January; serve notice this week.  ");
  assert.equal(await record.isDisabled(), false);

  // The host rejects first: the choice and the note stay.
  await record.click();
  await page.getByRole("alert").filter({ hasText: /Couldn’t record it\. Your choice and note are kept\./ }).waitFor();
  await announced(/wasn’t recorded\. Your draft is kept/);
  assert.equal(await terminate.isChecked(), true);
  assert.equal(await note.inputValue(), "  Moving payroll in-house from January; serve notice this week.  ");
  // The draft survives switching contracts too.
  await row(/Fieldnote/).click();
  await root.getByRole("heading", { level: 2, name: /Fieldnote/ }).waitFor();
  await row(/Ledgerline/).click();
  await root.getByRole("heading", { level: 2, name: /Ledgerline/ }).waitFor();
  assert.equal(await page.getByRole("radio", { name: /^Terminate/ }).isChecked(), true);
  assert.equal(await note.inputValue(), "  Moving payroll in-house from January; serve notice this week.  ");

  // Then it records.
  await page.evaluate(() => (window.fail = false));
  await record.click();
  await announced(/Recorded terminate for Ledgerline/);
  assert.equal(await page.evaluate(() => window.decisions.length), 2);
  assert.deepEqual(await page.evaluate(() => window.decisions[1]), {
    contractId: "CTR-219",
    decision: "terminate",
    note: "Moving payroll in-house from January; serve notice this week.",
  });
  await root.filter({ hasText: /Owner decision/i }).waitFor();
  assert.match(await txt(root), /Recorded by Noor Ali/);
  assert.match(await txt(root), /“Moving payroll in-house from January; serve notice this week\.”/);
  assert.equal(await page.getByRole("form").count(), 0);
  assert.match(await txt(row(/Ledgerline/)), /Terminate Decision recorded/);
  assert.match(await txt(summary), /Decisions on file 2 of 6/);
  assert.match(await txt(summary), /Notice due in 30 days 1 £24,000/);

  // The Undecided scope hides decided contracts.
  const undecided = page.getByRole("radio", { name: /Undecided/ });
  assert.match(await txt(undecided), /Undecided 4/);
  await undecided.click();
  assert.equal(await undecided.getAttribute("aria-checked"), "true");
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Contracts by notice deadline"] > li').length === 4);
  assert.equal(await row(/Northline Studio/).count(), 0);

  // A decision without a note still records, with an empty note.
  await mount(`window.one=null;createRoot(document.getElementById('root')).render(<Subject.RenewalPlanner referenceDate="2026-10-17" defaultContractId="CTR-231" onDecision={p=>{window.one=p}}/>);`);
  await page.getByRole("radio", { name: /^Renew/ }).check();
  await page.locator('[data-demo="record"]').click();
  await page.waitForFunction(() => window.one);
  assert.deepEqual(await page.evaluate(() => window.one), { contractId: "CTR-231", decision: "renew", note: "" });

  // Every contract decided: the undecided view says so.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.RenewalPlanner referenceDate="2026-10-17" contracts={[{id:'A',name:'Seats',counterparty:'Acme',owner:'Ada Park',renewalDate:'2027-01-01',noticeDeadline:'2026-12-01',annualValueMinor:100000,decision:'renew'}]}/>);`);
  await page.getByRole("radio", { name: /Undecided/ }).click();
  await page.getByText("Every renewal in this window has a decision on file.").waitFor();

  // Invalid dates stay explicit instead of producing a countdown.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.RenewalPlanner referenceDate="2026-10-17" contracts={[{id:'BAD',name:'Seats',counterparty:'Acme',owner:'Ada Park',renewalDate:'2026-02-30',noticeDeadline:'2026-13-01',annualValueMinor:100000}]}/>);`);
  const bad = page.getByRole("region", { name: "Renewal planner" });
  assert.match(await txt(page.getByRole("button", { name: /Acme/ })), /Date missing/);
  assert.match(await txt(bad), /Notice by Date missing Renews Date missing Status Dates missing/);
  assert.match(await txt(bad.locator("dl").first()), /Notice due in 30 days 0 £0/);

  // No contracts.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.RenewalPlanner referenceDate="2026-10-17" contracts={[]}/>);`);
  await page.getByText("No renewals in the next 7 months.").waitFor();
  assert.equal(await page.getByRole("slider").count(), 0);
}
