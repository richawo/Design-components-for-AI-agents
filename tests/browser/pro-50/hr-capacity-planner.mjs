export async function check({ page, mount, assert, choose, capture = async () => {} }) {
  await mount(
    `window.plans=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.CapacityPlanner onSave={async bookings=>{window.plans.push(structuredClone(bookings));if(window.fail)throw Error('The planning service is offline.');bookings[0].hours=24;return new Promise(resolve=>window.finishPlan=resolve)}}/>);`,
  );
  const hours = () => page.getByRole("spinbutton", { name: "Hours for allocation 1", exact: true });
  assert.equal(await page.getByRole("spinbutton").count(), 2);
  await page.getByRole("button", { name: "Add 2 hours", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Save plan", exact: true }).isEnabled(), true);
  await page.getByRole("button", { name: "Add 2 hours", exact: true }).click();
  assert.match(await page.getByRole("alert").innerText(), /over-capacity/);
  assert.equal(await page.getByRole("button", { name: "Save plan", exact: true }).isDisabled(), true);
  await capture("over-capacity", { audit: true });
  await page.getByRole("button", { name: "Remove allocation 4", exact: true }).click();
  assert.equal(
    await page
      .getByRole("combobox", { name: "Project to add", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "The planning service is offline." }).waitFor();
  assert.equal(await page.evaluate(() => window.plans[0].length), 8);
  await capture("save-failed", { audit: true });
  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  assert.equal(await hours().isDisabled(), true);
  assert.equal(await page.locator('[data-demo="capacity-jo-thu"]').isDisabled(), true);
  await page.locator('[data-demo="save-plan"]').evaluate((node) => node.click());
  assert.equal(await page.evaluate(() => window.plans.length), 2);
  const calendar = page.getByRole("region", { name: "Team allocation calendar", exact: true });
  await calendar.focus();
  assert.equal(await calendar.evaluate((node) => node === document.activeElement), true);
  const beforeScroll = await calendar.evaluate((node) => node.scrollLeft);
  await calendar.press("ArrowRight");
  await page.waitForFunction((before) => document.querySelector('[aria-label="Team allocation calendar"]').scrollLeft > before, beforeScroll);
  await capture("pending", { audit: true });
  await page.evaluate(() => window.finishPlan());
  await page.getByRole("status").filter({ hasText: "Capacity plan saved." }).waitFor();
  assert.equal(await calendar.evaluate((node) => node === document.activeElement), true, "Acknowledgement keeps the user's calendar inspection focus");
  assert.equal(await page.getByRole("alert").count(), 0);
  await hours().fill("0.1");
  assert.equal(await page.getByRole("button", { name: "Save plan", exact: true }).isDisabled(), true);
  assert.equal(await hours().getAttribute("aria-invalid"), "true");
  await capture("invalid-hours", { audit: true });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  assert.equal(await hours().inputValue(), "4", "Acknowledged baseline is independent of callback mutation");
  assert.equal(await page.getByRole("spinbutton").count(), 3);
  assert.match(
    await page.locator('[data-demo="capacity-mara-mon"]').getAttribute("aria-label"),
    /6 of 8 hours/,
    "Callback mutation cannot change the acknowledged Monday baseline",
  );
  await hours().press("ArrowDown");
  assert.equal(await hours().inputValue(), "3.75");
  await hours().press("Shift+ArrowUp");
  assert.equal(await hours().inputValue(), "6.25");
  for (const field of [
    hours(),
    page.getByRole("button", { name: "Fewer hours for allocation 1", exact: true }),
    page.getByRole("button", { name: "More hours for allocation 1", exact: true }),
  ]) {
    const box = await field.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, "Quarter-hour targets are at least 44px");
  }
  await capture("quarter-hour-edit", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CapacityPlanner onSave={()=>{throw Error('Reset failure fixture')}}/>);`,
  );
  await page.getByRole("button", { name: "Add 2 hours", exact: true }).click();
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Reset failure fixture" }).waitFor();
  await hours().fill("0.1");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  assert.equal(await page.getByRole("spinbutton").count(), 2, "Failed saves do not replace Reset’s original baseline");
  assert.equal(await hours().inputValue(), "4");
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CapacityPlanner people={[]} days={[]} projects={[]} defaultBookings={[]}/>);`,
  );
  assert.match(await page.locator("section").innerText(), /Add team members and working days/);
  await capture("empty", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CapacityPlanner people={[{id:'off',name:'On leave',role:'Research',dailyHours:0}]} days={[{id:'mon',label:'Mon',date:'12'}]} projects={[{id:'one',name:'Research'}]} defaultBookings={[]}/>);`,
  );
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.match(await page.locator('[data-demo="capacity-off-mon"]').getAttribute("aria-label"), /0 of 0 hours/);
  await capture("zero-capacity", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CapacityPlanner people={[{id:'x',name:'Invalid',role:'Design',dailyHours:NaN}]} defaultBookings={[]}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /daily hours/);
  assert.doesNotMatch(await page.locator("section").innerText(), /NaN/);
  await capture("invalid-capacity", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CapacityPlanner allowOverbooking onSave={()=>{}}/>);`,
  );
  await page.getByRole("button", { name: "Add 2 hours", exact: true }).click();
  await page.getByRole("button", { name: "Add 2 hours", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Save plan", exact: true }).isEnabled(), true);
  assert.match(await page.locator("section").innerText(), /Over capacity/);
  await mount(
    `function Host(){const [bookings,setBookings]=React.useState([{id:'a',personId:'mara',dayId:'tue',projectId:'website',hours:2}]);return <Subject.CapacityPlanner defaultBookings={bookings} onSave={async next=>{await new Promise(resolve=>window.finishEcho=resolve);setBookings(next)}}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await hours().fill("3");
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await page.evaluate(() => window.finishEcho());
  await page.getByRole("status").filter({ hasText: "Capacity plan saved." }).waitFor();
  assert.equal(await hours().inputValue(), "3");
  assert.equal(await page.getByRole("button", { name: "Save plan", exact: true }).isDisabled(), true);
  await mount(
    `function Host(){const [bookings,setBookings]=React.useState([{id:'a',personId:'mara',dayId:'tue',projectId:'website',hours:2}]);window.replacePlan=()=>setBookings([{id:'a',personId:'mara',dayId:'tue',projectId:'website',hours:5}]);return <Subject.CapacityPlanner defaultBookings={bookings} onSave={()=>new Promise(resolve=>window.oldPlan=resolve)}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await hours().fill("3");
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await page.evaluate(() => window.replacePlan());
  await page.waitForFunction(() => document.querySelector('[role="spinbutton"]').value === "5");
  await page.evaluate(() => window.oldPlan());
  assert.doesNotMatch(await page.locator("section").innerText(), /Capacity plan saved/);

  // Accepted numeric snapshots are clean independently of their input formatting.
  {
 await mount(`window.plans=[];createRoot(document.getElementById('root')).render(<Subject.CapacityPlanner onSave={next=>window.plans.push(structuredClone(next))}/>);`);
 const hours=page.getByRole('spinbutton',{name:'Hours for allocation 1',exact:true});await hours.fill('3.50');await page.getByRole('button',{name:'Save plan',exact:true}).click();await page.getByRole('status').filter({hasText:'Capacity plan saved.'}).waitFor();assert.equal(await page.evaluate(()=>window.plans[0].find(booking=>booking.id==='b').hours),3.5);await capture('acknowledged-decimal',{audit:true});assert.equal(await page.getByRole('button',{name:'Save plan',exact:true}).isDisabled(),true,'An acknowledged decimal plan is clean even when its typed formatting differs');

  }
}
