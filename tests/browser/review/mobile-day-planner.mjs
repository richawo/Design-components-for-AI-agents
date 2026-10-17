export async function check({ page, mount, assert }) {
  const events = [{ id: "work", title: "Design work", startMinute: 540, endMinute: 600 }, { id: "standup", title: "Stand-up", startMinute: 615, endMinute: 660, editable: false, unavailableReason: "Set by Mara" }];
  await mount(`window.moves=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.MobileDayPlanner events={${JSON.stringify(events)}} dayStart={480} dayEnd={720} minuteStep={15} onReschedule={async(p,signal)=>{window.moves.push({...p,signal:signal instanceof AbortSignal});if(window.fail)throw Error('Calendar is offline.')}}/>);`);
  const event = page.locator('[data-demo="planner-event-work"]');
  await event.focus();
  await page.keyboard.press("Enter");
  const later = page.getByRole("button", { name: "Later", exact: true });
  await later.press("Enter");
  const move = page.getByRole("button", { name: "Move", exact: true });
  assert.equal(await move.isEnabled(), true);
  await later.press("Enter");
  await page.getByText("Overlaps Stand-up", { exact: true }).waitFor();
  assert.equal(await move.isDisabled(), true);
  await page.getByRole("button", { name: "Earlier", exact: true }).press("Enter");
  await move.press("Enter");
  await page.getByText("Calendar is offline.", { exact: true }).waitFor();
  await page.evaluate(() => window.fail = false);
  await page.getByRole("button", { name: "Try again", exact: true }).press("Enter");
  await page.getByText("Moved to 09:15", { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => ({ id: window.moves[1].event.id, start: window.moves[1].startMinute, end: window.moves[1].endMinute, conflicts: window.moves[1].conflicts, signal: window.moves[1].signal })), { id: "work", start: 555, end: 615, conflicts: [], signal: true });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileDayPlanner events={[]} dayStart={480} dayEnd={720}/>);`);
  assert.equal(await page.locator('[data-demo^="planner-event-"]').count(), 0);
  assert.equal(await page.getByRole("button", { name: "Move", exact: true }).count(), 0);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
}
