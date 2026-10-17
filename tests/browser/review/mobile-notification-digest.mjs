export async function check({ page, mount, assert }) {
  const groups = [{ id: "work", app: "Work", icon: "tasks", items: [{ id: "a", title: "Review spec", body: "Mara left a comment", time: "10:00" }, { id: "b", title: "Plan ready", body: "A new plan is waiting", time: "10:02" }] }];
  const options = [{ id: "tomorrow", label: "Tomorrow", until: "08:00" }];
  await mount(`window.reads=[];window.snoozes=[];window.restores=[];window.fail=true;window.failSnooze=true;createRoot(document.getElementById('root')).render(<Subject.MobileNotificationDigest groups={${JSON.stringify(groups)}} snoozeOptions={${JSON.stringify(options)}} defaultExpanded="work" onRead={async(i,g)=>{window.reads.push({id:i.id,group:g.id});if(window.fail)throw Error('Sync paused')}} onSnooze={async(i,g,o)=>{window.snoozes.push({id:i.id,group:g.id,option:o});if(window.failSnooze)throw Error('Snooze unavailable')}} onRestore={(i,g)=>window.restores.push({id:i.id,group:g.id})}/>);`);
  const openActions = async (id, key = "Enter") => {
    await page.locator(`[data-demo="item-${id}"]`).press(key);
    await page.waitForFunction(id => {
      const action = document.querySelector(`[data-demo="read-${id}"]`);
      if (!action) return false;
      let opacity = 1;
      for (let node = action; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
      return opacity > 0.99;
    }, id);
  };
  assert.equal(await page.locator('[data-demo="read-a"]').isDisabled(), true);
  await openActions("a");
  await page.locator('[data-demo="snooze-a"]').press("Escape");
  assert.equal(await page.locator('[data-demo="read-a"]').isDisabled(), true);
  assert.equal(await page.locator('[data-demo="item-a"]').evaluate(el => el === document.activeElement), true);
  await openActions("a", "Space");
  await page.locator('[data-demo="read-a"]').press("Enter");
  await page.getByRole("alert").filter({ hasText: "Sync paused" }).waitFor();
  await page.locator('[data-demo="item-a"]').getByText("Review spec", { exact: true }).waitFor();
  await page.evaluate(() => window.fail = false);
  await openActions("a");
  await page.locator('[data-demo="read-a"]').press("Enter");
  await page.getByRole("button", { name: "Undo", exact: true }).waitFor();
  await page.getByRole("button", { name: "Undo", exact: true }).press("Enter");
  await page.locator('[data-demo="item-a"]').getByText("Review spec", { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.restores), [{ id: "a", group: "work" }]);
  const snooze = async () => {
    await openActions("a");
    await page.locator('[data-demo="snooze-a"]').press("Enter");
    await page.getByRole("button", { name: "Tomorrow, until 08:00", exact: true }).press("Enter");
  };
  await snooze();
  await page.getByRole("alert").filter({ hasText: "Snooze unavailable" }).waitFor();
  await page.locator('[data-demo="item-a"]').getByText("Review spec", { exact: true }).waitFor();
  await page.evaluate(() => window.failSnooze = false);
  await snooze();
  await page.getByText("Snoozed until 08:00", { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.snoozes[1]), { id: "a", group: "work", option: options[0] });
  await openActions("b");
  await page.locator('[data-demo="read-b"]').press("Enter");
  await page.getByText("You’re all caught up", { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.reads), [{ id: "a", group: "work" }, { id: "a", group: "work" }, { id: "b", group: "work" }]);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileNotificationDigest groups={${JSON.stringify(groups)}}/>);`);
  assert.equal(await page.locator('[data-demo="item-b"]').getAttribute("tabindex"), "-1");
  await page.locator('[data-demo="item-b"]').press("Enter");
  assert.equal(await page.getByRole("button", { name: /^Plan ready\./ }).count(), 0);
  await page.getByRole("button", { name: /^Work, 2 notifications/ }).press("Enter");
  await page.getByRole("button", { name: /^Plan ready\./ }).waitFor();
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileNotificationDigest groups={[]}/>);`);
  await page.getByText("You’re all caught up", { exact: true }).waitFor();
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
}
