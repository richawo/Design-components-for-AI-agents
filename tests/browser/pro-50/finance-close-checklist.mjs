export async function check({ page, mount, assert }) {
  const section = () => page.locator("section").first();
  await mount(
    `window.calls=[];window.fail=true;window.signed=[];window.signFail=true;createRoot(document.getElementById('root')).render(<Subject.CloseChecklist onToggleTask={async(id,done)=>{window.calls.push([id,done]);if(window.fail){window.fail=false;throw Error('The close is locked by Priya.')}}} onSignOff={async s=>{window.signed.push(s);if(window.signFail){window.signFail=false;throw Error('Sign-off service unavailable.')}}}/>);`,
  );
  assert.match(await section().innerText(), /1 late/);
  const cloud = page.getByRole("checkbox", { name: /^Accrue unbilled cloud usage/ });
  // The review waits on the accrual: it's locked, with no checkbox to tick.
  assert.equal(await page.getByRole("checkbox", { name: /^Review accruals over £5,000/ }).count(), 0);
  assert.match(await section().innerText(), /Waits on Accrue unbilled cloud usage/);

  // A rejected tick puts the box back and says why.
  await cloud.click();
  await page.getByText("The close is locked by Priya. The box is back as it was.").waitFor();
  assert.equal(await cloud.isChecked(), false);
  assert.equal(await page.getByRole("checkbox", { name: /^Review accruals/ }).count(), 0);

  // Keyboard: Space ticks it; the blocked review unlocks.
  await cloud.focus();
  await page.keyboard.press("Space");
  const review = page.getByRole("checkbox", { name: /^Review accruals over £5,000/ });
  await review.waitFor();
  assert.deepEqual(await page.evaluate(() => window.calls), [["cloud", true], ["cloud", true]]);
  assert.equal(await cloud.isChecked(), true);
  // The accrual can't be reopened once the review that depends on it is done.
  await review.check();
  await page.waitForFunction(() => window.calls.length === 3);
  assert.equal(await cloud.isDisabled(), true);

  // Sections fold from the keyboard.
  const cash = page.getByRole("button", { name: /Cash and bank/ });
  assert.equal(await cash.getAttribute("aria-expanded"), "false");
  await cash.focus();
  await page.keyboard.press("Enter");
  assert.equal(await cash.getAttribute("aria-expanded"), "true");
  await page.getByRole("checkbox", { name: /^Reconcile Operating/ }).waitFor();

  // Sign-off: a failure keeps every tick, the retry stamps it closed.
  const sign = page.getByRole("button", { name: /Sign off October/ });
  await sign.click();
  await page.getByText("Sign-off service unavailable. Every tick is kept.").waitFor();
  assert.equal(await review.isChecked(), true);
  await page.getByRole("button", { name: /Try again/ }).click();
  await page.getByRole("article", { name: "October 2026 close sign-off" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.signed[1]), {
    period: "October 2026",
    signedBy: "Priya Shah",
    signedOn: "2026-11-04",
    taskCount: 12,
  });
  assert.match(await section().innerText(), /Closed/);

  // Invalid and empty data.
  const t = (id, deps) => ({ id, title: id.toUpperCase(), group: "G", owner: "Ada Park", dueDay: 1, dependsOn: deps });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CloseChecklist tasks={${JSON.stringify([t("a", ["b"]), t("b", ["a"])])}}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /cycle/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CloseChecklist tasks={${JSON.stringify([t("a", ["missing"])])}}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /isn’t in the list/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CloseChecklist tasks={[]}/>);`);
  assert.match(await section().innerText(), /No close tasks yet/);
}
