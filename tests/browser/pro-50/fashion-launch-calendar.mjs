export async function check({ page, mount, assert }) {
  const detail = () => page.getByRole("complementary", { name: "Launch details" }).innerText();
  const shows = async (re) => {
    for (let i = 0; i < 40 && !re.test(await detail()); i++) await page.waitForTimeout(50);
    assert.match(await detail(), re);
  };
  const check = (name) => page.getByRole("checkbox", { name });
  await mount(
    `window.moves=[];window.ticks=[];window.fail=true;window.failTick=false;createRoot(document.getElementById('root')).render(` +
      `<Subject.LaunchCalendar onSchedule={async m=>{window.moves.push(m);if(window.fail)throw Error('The showroom is booked')}} ` +
      `onChecklistChange={async c=>{window.ticks.push(c);if(window.failTick)throw Error('Offline')}}/>);`,
  );
  await shows(/Salt Light capsule/);
  await shows(/3 of 5 checks done/);
  await shows(/1 required check to go/);
  // Ticking the last required check makes the drop ready.
  await check(/Launch email scheduled/).check();
  await shows(/4 of 5 checks done/);
  await shows(/Required checks done/);
  assert.deepEqual(await page.evaluate(() => window.ticks.at(-1)), { launchId: "salt-light", checkId: "email", complete: true });
  // A rejected tick is undone and explained.
  await page.evaluate(() => (window.failTick = true));
  await check(/Launch email scheduled/).click();
  await page.getByRole("alert").filter({ hasText: "wasn’t saved" }).waitFor();
  assert.equal(await check(/Launch email scheduled/).isChecked(), true);
  // A rejected move springs back to its day.
  await page.getByRole("button", { name: "One day later" }).click();
  await page.getByRole("alert").filter({ hasText: "The showroom is booked." }).waitFor();
  await shows(/back on 14 Oct/);
  await shows(/Wed, 14 Oct/);
  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "One day later" }).click();
  await shows(/Thu, 15 Oct/);
  assert.deepEqual(await page.evaluate(() => window.moves.at(-1)), { launchId: "salt-light", date: "2026-10-15" });
  // Phone widths: a day's marker opens its drop.
  await page.getByRole("button", { name: "Knitwear drop 2", exact: true }).click();
  await shows(/Knitwear drop 2/);
  await shows(/1 of 4 checks done/);
  // Month navigation and Today.
  await page.getByRole("button", { name: "Next month" }).click();
  await page.getByText("November 2026").waitFor();
  await page.getByRole("button", { name: "Today" }).click();
  await page.getByText("October 2026").waitFor();

  // Wide screens: Alt+arrow keys move a focused card a day or a week.
  // The fixture frame is narrow, so the calendar gets a wide box of its own.
  await page.setViewportSize({ width: 1440, height: 900 });
  await mount(`window.moves=[];createRoot(document.getElementById('root')).render(<div style={{width:1200}}><Subject.LaunchCalendar onSchedule={async m=>{window.moves.push(m)}}/></div>);`);
  const card = page.locator('[data-demo="drop-archive"]');
  await card.focus();
  await page.keyboard.press("Alt+ArrowLeft");
  await shows(/Thu, 29 Oct/);
  await page.locator('[data-demo="drop-archive"]').focus();
  await page.keyboard.press("Alt+ArrowUp");
  await shows(/Thu, 22 Oct/);
  assert.deepEqual(await page.evaluate(() => window.moves.map((m) => m.date)), ["2026-10-29", "2026-10-22"]);
  await page.setViewportSize({ width: 390, height: 900 });

  // Invalid dates are left out; nothing left means the empty state.
  const bad = { id: "x", name: "Undated drop", collection: "SS27", channel: "Online", date: "next week", owner: "Ada Park", checks: [] };
  await mount(`createRoot(document.getElementById('root')).render(<Subject.LaunchCalendar launches={[${JSON.stringify(bad)}]}/>);`);
  await shows(/No launches planned/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.LaunchCalendar launches={[]}/>);`);
  await shows(/No launches planned/);
}
