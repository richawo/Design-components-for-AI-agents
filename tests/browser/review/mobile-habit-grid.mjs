export async function check({ page, mount, assert }) {
  const days = Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-${12 + i}`, label: `Day ${i + 1}` }));
  const habits = [{ id: "read", name: "Read", icon: "book", target: 3 }, { id: "rest", name: "Rest", paused: true }];
  const props = `habits={${JSON.stringify(habits)}} days={${JSON.stringify(days)}} todayIndex={2} defaultValue={{read:[],rest:[]}}`;
  await mount(`window.toggles=[];window.changes=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.MobileHabitGrid ${props} onToggle={async(change,signal)=>{window.toggles.push({...change,signal:signal instanceof AbortSignal});if(window.fail)throw Error('Could not sync this mark.');await new Promise(resolve=>window.finishMark=resolve)}} onValueChange={(next,change)=>window.changes.push({next,change})}/>);`);
  const cell = page.locator('[data-demo="habit-read-2"]');
  await cell.press("Space");
  await page.getByRole("alert").filter({ hasText: "Could not sync this mark." }).waitFor();
  assert.equal(await cell.getAttribute("aria-checked"), "false");
  assert.equal(await page.evaluate(() => window.changes.length), 0);
  await page.evaluate(() => window.fail = false);
  await cell.press("Space");
  await page.waitForFunction(() => document.querySelector('[data-demo="habit-read-2"]').getAttribute('aria-disabled') === 'true');
  assert.equal(await cell.getAttribute("aria-checked"), "true");
  await page.evaluate(() => window.finishMark());
  await page.waitForFunction(() => window.changes.length === 1);
  assert.deepEqual(await page.evaluate(() => ({ day: window.toggles[1].day, index: window.toggles[1].dayIndex, done: window.toggles[1].done, signal: window.toggles[1].signal, marks: window.changes[0].next.read })), { day: days[2], index: 2, done: true, signal: true, marks: [false,false,true,false,false,false,false] });
  assert.equal(await page.locator('[data-demo="habit-read-3"]').isDisabled(), true);
  assert.equal(await page.locator('[data-demo="habit-rest-2"]').isDisabled(), true);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileHabitGrid habits={[]}/>);`);
  await page.getByText("No habits yet", { exact: true }).waitFor();
  assert.equal(await page.getByRole("checkbox").count(), 0);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
}
