export async function check({ page, mount, assert }) {
  const d = (name) => page.locator(`[data-demo="${name}"]`);
  const footer = () => page.locator("footer").innerText();
  await mount(
    `window.calls=[];window.undos=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.AccessRequests onDecision={async p=>{window.calls.push(p);if(window.fail)throw Error('offline')}} onUndo={p=>window.undos.push(p)}/>);`,
  );
  // The oldest request opens first; downscoping shrinks what it reaches.
  await page.getByRole("heading", { name: "Priya Raman", exact: true }).waitFor();
  assert.match(await footer(), /Grant Priya Admin on Billing/);
  assert.equal(await page.getByRole("img", { name: "High sensitivity", exact: true }).count(), 2);
  await d("role-editor").click();
  assert.match(await footer(), /smaller than asked/);
  await page.waitForFunction(() => !document.querySelector("ol")?.textContent?.includes("Payment methods"));
  // Policy caps disable longer windows, and arrow keys skip them.
  await d("role-admin").click();
  assert.equal(await d("hours-72").isDisabled(), true);
  await d("hours-24").click();
  await page.keyboard.press("ArrowRight");
  assert.equal(await d("hours-1").getAttribute("aria-checked"), "true");
  await d("role-editor").click();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await d("role-viewer").getAttribute("aria-checked"), "true");
  await page.keyboard.press("ArrowRight");
  assert.equal(await d("role-editor").getAttribute("aria-checked"), "true");
  // A refused decision keeps the draft.
  await d("approve").click();
  await page.getByRole("alert").filter({ hasText: "offline" }).waitFor();
  assert.match(await footer(), /Your decision is kept/);
  assert.equal(await d("role-editor").getAttribute("aria-checked"), "true");
  assert.match(await d("approve").innerText(), /Approve 1h/);
  await page.evaluate(() => (window.fail = false));
  await d("approve").click();
  await page.getByRole("status").filter({ hasText: "approved" }).waitFor();
  const approved = await page.evaluate(() => window.calls[1]);
  assert.equal(approved.requestId, "AR-1093");
  assert.equal(approved.outcome, "approved");
  assert.equal(approved.roleId, "editor");
  assert.equal(approved.hours, 1);
  assert.match(approved.expiresAt, /^2026-10-17T10:4\d:00\.000Z$/);
  assert.match(await page.getByRole("complementary", { name: "Active grants" }).innerText(), /Priya Raman/);
  // Undo returns the request and withdraws the grant.
  await d("undo").click();
  await page.getByRole("heading", { name: "Priya Raman", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.undos[0].requestId), "AR-1093");
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="Active grants"]')?.textContent?.includes("Priya Raman"),
  );
  // Denial needs a reason the requester will see.
  await d("deny").click();
  assert.equal(await d("confirm-deny").isDisabled(), true);
  await d("deny-reason").fill("no");
  assert.equal(await d("confirm-deny").isDisabled(), true);
  await page.getByRole("button", { name: "Needs manager approval first", exact: true }).click();
  await d("confirm-deny").click();
  await page.getByRole("status").filter({ hasText: "denied" }).waitFor();
  const denied = await page.evaluate(() => window.calls.at(-1));
  assert.deepEqual(denied, { requestId: "AR-1093", outcome: "denied", reason: "Needs manager approval first" });
  await page.getByRole("heading", { name: "Jules Fontaine", exact: true }).waitFor();
  assert.match(await page.locator("ol").first().innerText(), /Asked for 30 days; Admin caps at 1 day/);

  // Empty and invalid data.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.AccessRequests requests={[]} grants={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /Queue clear/);
  assert.match(await page.locator("section").innerText(), /No temporary access running/);
  await mount(
    `const r={id:'AR-1',requester:'Ada Park',team:'Ops',resource:'Billing',currentRoleId:null,requestedRoleId:'owner',requestedHours:4,reason:'Close.',requestedAt:'2026-10-17T09:00:00Z',reach:{}};createRoot(document.getElementById('root')).render(<Subject.AccessRequests requests={[r,{...r,id:'AR-2',requestedRoleId:'viewer',requestedHours:NaN}]}/>);`,
  );
  const alert = await page.getByRole("alert").innerText();
  assert.match(alert, /AR-1 \(unknown role\)/);
  assert.match(alert, /AR-2 \(invalid duration\)/);
  assert.doesNotMatch(await page.locator("section").innerText(), /NaN|Infinity/);
}
