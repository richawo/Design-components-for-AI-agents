export async function check({ page, mount, assert }) {
  await mount(`window.phases=[];window.lengths=[];window.dnd=[];window.done=[];createRoot(document.getElementById('root')).render(<Subject.MobileFocusSession defaultMinutes={25} presets={[25,45]} completedToday={[]} onPhaseChange={p=>window.phases.push(p)} onMinutesChange={m=>window.lengths.push(m)} onDoNotDisturbChange={on=>window.dnd.push(on)} onComplete={p=>window.done.push(p)}/>);`);
  const dial = page.getByRole("slider", { name: "Session length", exact: true });
  assert.equal(await dial.getAttribute("aria-valuenow"), "25");
  await dial.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await dial.getAttribute("aria-valuenow"), "26");
  await page.getByRole("radio", { name: "45 minutes", exact: true }).click();
  assert.equal(await dial.getAttribute("aria-valuenow"), "45");
  await page.getByRole("radio", { name: "45 minutes", exact: true, checked: true }).waitFor();
  await page.getByRole("button", { name: "Do Not Disturb", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.dnd), [false]);
  await page.getByRole("button", { name: "Start focus session", exact: true }).click();
  await page.getByRole("button", { name: "Pause session", exact: true }).click();
  await page.getByRole("button", { name: "Resume session", exact: true }).click();
  await page.getByRole("button", { name: "Finish session", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.phases), ["running", "paused", "running", "finished"]);
  assert.equal(await page.evaluate(() => window.done[0].plannedMinutes), 45);
  assert.equal(await page.evaluate(() => window.done[0].completed), false);

  await mount(`window.done=[];createRoot(document.getElementById('root')).render(<Subject.MobileFocusSession intention="Draft the memo" defaultMinutes={5} initialPhase="paused" defaultElapsedSeconds={120} presets={[]} completedToday={[]} onComplete={p=>window.done.push(p)}/>);`);
  await page.getByRole("button", { name: "End session", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.done[0]), { intention: "Draft the memo", plannedMinutes: 5, focusedMinutes: 2, completed: false });
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
}
