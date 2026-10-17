async function drag(page, from, to) {
  await page.locator(to).scrollIntoViewIfNeeded();
  const a = await page.locator(from).boundingBox();
  const b = await page.locator(to).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}
export async function check({ page, mount, assert }) {
  await mount(`window.rotas=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.ShiftCoverage onPublish={async p=>{window.rotas.push(p);if(window.fail)throw Error('offline')}}/>);`);
  const status = () => page.getByRole("status").last().innerText();
  // Refused drops name the rule.
  await drag(page, '[data-demo="shift-wed-close"]', '[data-demo="cell-leo-2"]');
  assert.match(await status(), /Leo Brennan can’t take it: Not trained: Keyholder/);
  await drag(page, '[data-demo="shift-sat-close"]', '[data-demo="cell-mei-5"]');
  assert.match(await status(), /Overlaps 08:00–16:00/);
  // A valid drop assigns.
  await drag(page, '[data-demo="shift-sat-close"]', '[data-demo="cell-ollie-5"]');
  assert.match(await page.locator('[data-demo="cell-ollie-5"]').innerText(), /14:00–22:00/);
  assert.match(await status(), /assigned to Ollie Grant/);
  // Keyboard: select, then place in a highlighted cell.
  await page.locator('[data-demo="shift-sun-close"]').focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator('[data-demo="shift-sun-close"]').getAttribute("aria-pressed"), "true");
  await page.locator('[data-demo="cell-mei-6"]').focus();
  await page.keyboard.press("Enter");
  assert.match(await page.locator('[data-demo="cell-mei-6"]').innerText(), /12:00–20:00/);
  // Publish fails, keeps the draft, then succeeds.
  await page.locator('[data-demo="publish"]').click();
  await page.getByText("Couldn’t publish").waitFor();
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="publish"]').click();
  await page.getByText("Everyone on the rota has been notified").waitFor();
  const rota = await page.evaluate(() => window.rotas[1]);
  assert.equal(rota.assignments.length, 28);
  assert.deepEqual(rota.assignments.find((a) => a.shiftId === "sat-close"), { shiftId: "sat-close", staffId: "ollie" });
  assert.deepEqual(rota.assignments.find((a) => a.shiftId === "sun-close"), { shiftId: "sun-close", staffId: "mei" });
  assert.equal(await page.locator('[data-demo="publish"]').isDisabled(), true);

  await mount(`createRoot(document.getElementById('root')).render(<Subject.ShiftCoverage shifts={[{id:'bad',date:'2026-02-30',start:'24:00',end:'01:00',role:'Desk'}]}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /invalid date or time/);
  assert.match(await page.locator("section").innerText(), /No shifts this week/);
}
