export async function check({ page, mount, assert, choose }) {
  await mount(`window.steps=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.EmployeeOnboarding onComplete={async p=>{window.steps.push(p);if(window.fail)throw Error('offline')}} onReopen={p=>{window.reopened=p}}/>);`);
  const text = () => page.locator("section").first().innerText();
  // Figures tween through motion values, so wait for them to settle.
  const until = (re) => page.locator("section").first().filter({ hasText: re }).waitFor();
  await until(/5 \/ 11/);
  await page.locator('[data-demo="task-access"]').click();
  const record = page.getByRole("button", { name: "Record completion" });
  await page.getByLabel("Completion note", { exact: true }).fill("Access verified with Noor. Ticket IT-208.");
  assert.equal(await record.isDisabled(), true);
  await page.getByRole("checkbox", { name: "I confirm this step is complete for Noor Ali." }).check();
  await record.click();
  await page.getByRole("status").filter({ hasText: "request failed" }).waitFor();
  // The note survives the failure.
  assert.equal(await page.getByLabel("Completion note", { exact: true }).inputValue(), "Access verified with Noor. Ticket IT-208.");
  await page.evaluate(() => (window.fail = false));
  await record.click();
  await page.getByRole("status").filter({ hasText: "Step recorded" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.steps[1]), { hireId: "noor", taskId: "access", note: "Access verified with Noor. Ticket IT-208." });
  await until(/6 \/ 11/);
  // Unblocked: shadowing no longer waits on access.
  assert.doesNotMatch(await page.locator('[data-demo="task-shadow"]').innerText(), /Waiting/);
  // Undo reopens.
  await page.getByRole("button", { name: "Undo" }).click();
  assert.deepEqual(await page.evaluate(() => window.reopened), { hireId: "noor", taskId: "access" });
  await until(/5 \/ 11/);
  // Quick tick records with an empty note.
  await page.locator('[data-demo="tick-team"]').check();
  await page.getByRole("status").filter({ hasText: "Step recorded" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.steps.at(-1)), { hireId: "noor", taskId: "team", note: "" });
  // A blocked step says what it waits on.
  await page.locator('[data-demo="task-handover"]').click();
  assert.equal(await page.getByRole("button", { name: /^Waiting: Shadow three customer calls/ }).isDisabled(), true);
  await page.keyboard.press("Escape");
  // Switching hire resets the view to their journey.
  await choose(page.locator('[data-demo="hire"]'), "theo");
  await until(/1 \/ 6/);
  assert.match(await text(), /Starts in 7 days/);
}
