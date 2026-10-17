export async function check({ page, mount, assert }) {
  await mount(`window.decisions=[];window.reopened=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.LeaveApproval onDecision={async p=>{window.decisions.push(p);if(window.fail)throw Error('offline')}} onReopen={p=>{window.reopened.push(p)}}/>);`);
  const section = () => page.locator("section").first().innerText();
  // Role queries skip outgoing panels, which are inert while they exit.
  const approve = page.getByRole("button", { name: "Approve", exact: true });
  const note = page.getByLabel("Note to Noor", { exact: true });
  const meter = page.getByRole("meter", { name: "Allowance after this request" });
  assert.match(await meter.getAttribute("aria-valuetext"), /8 days available, 5 days after this request/);
  // Noor’s three days sit across the team calendar with who else is off.
  assert.match(await page.getByRole("region", { name: "Customer partnerships calendar" }).innerText(), /Wed,? 21 Oct, full day requested, Dana Whitfield off, Elliot James has requested leave/);

  // A failed approval keeps the request open and the note intact.
  await note.fill("Have a great break.");
  await approve.click();
  await page.getByRole("status").filter({ hasText: "Couldn’t record the decision" }).waitFor();
  assert.equal(await note.inputValue(), "Have a great break.");
  await page.evaluate(() => (window.fail = false));
  await approve.click();
  await page.getByRole("status").filter({ hasText: "Leave approved" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.decisions[1]), { requestId: "LV-201", decision: "approve", note: "Have a great break." });
  assert.match(await section(), /Approved at .*“Have a great break\.”/s);

  // Undo reopens through the host and restores the decision bar.
  await page.getByRole("button", { name: "Undo" }).click();
  assert.deepEqual(await page.evaluate(() => window.reopened[0]), { requestId: "LV-201", decision: "approve", note: "Have a great break." });
  await approve.waitFor();
  await approve.click();
  await page.getByRole("status").filter({ hasText: "Leave approved" }).waitFor();

  // With Noor approved, Elliot’s day drops the team below minimum: approving needs a note.
  await page.locator('[data-demo="request-1"]').focus();
  await page.keyboard.press("Enter");
  assert.match(await page.getByRole("alert").innerText(), /drops below minimum cover on Wed 21/);
  assert.equal(await approve.isDisabled(), true);
  await page.getByLabel("Note to Elliot", { exact: true }).fill("Sofia covers the renewals desk.");
  assert.equal(await approve.isDisabled(), false);

  // Maya asks for more than she has left: no approval, decline with a reason chosen by keyboard.
  await page.locator('[data-demo="request-2"]').click();
  assert.match(await page.getByRole("alert").innerText(), /Needs 1 day more than Maya has left/);
  assert.equal(await approve.isDisabled(), true);
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Decline request", exact: true });
  assert.equal(await confirm.isDisabled(), true);
  await page.locator('[data-demo="reason-2"]').focus();
  await page.keyboard.press("Enter");
  assert.match(await page.getByLabel("Reason for Maya", { exact: true }).inputValue(), /more than your remaining allowance/);
  await confirm.click();
  await page.getByRole("status").filter({ hasText: "Request declined" }).waitFor();
  assert.equal((await page.evaluate(() => window.decisions.at(-1))).decision, "decline");
  // Elliot’s drafted note survived switching requests.
  await page.locator('[data-demo="request-1"]').click();
  assert.equal(await page.getByLabel("Note to Elliot", { exact: true }).inputValue(), "Sofia covers the renewals desk.");

  // Invalid and duplicate data is named, never counted.
  const bad = { employeeId: "noor", employee: "Noor Ali", team: "Customer partnerships", type: "Annual leave", note: "" };
  await mount(`createRoot(document.getElementById('root')).render(<Subject.LeaveApproval requests={${JSON.stringify([
    { ...bad, id: "bad", days: [{ date: "2026-10-20", units: null }] },
    { ...bad, id: "bad", days: [{ date: "2026-10-21", units: 2 }] },
  ])}}/>);`);
  const alerts = (await page.getByRole("alert").allInnerTexts()).join(" ");
  assert.match(alerts, /appears twice/);
  assert.match(alerts, /durations are invalid/);
  assert.doesNotMatch(await section(), /NaN|Infinity|undefined/);
  assert.equal(await approve.isDisabled(), true);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.LeaveApproval requests={[]}/>);`);
  assert.match(await section(), /No leave waiting on you/);
}
