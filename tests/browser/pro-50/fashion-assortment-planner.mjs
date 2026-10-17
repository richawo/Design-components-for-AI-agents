export async function check({ page, mount, assert }) {
  const view = () => page.locator("section").first().innerText();
  // Figures settle a frame after the state changes, so text checks poll briefly.
  const shows = async (re) => {
    for (let i = 0; i < 40 && !re.test(await view()); i++) await page.waitForTimeout(50);
    assert.match(await view(), re);
  };
  const cell = (name) => page.getByRole("slider", { name, exact: true });
  const publish = () => page.locator('[data-demo="publish"]');
  await mount(
    `window.plans=[];window.fail=true;createRoot(document.getElementById('root')).render(` +
      `<Subject.AssortmentPlanner onPublish={async p=>{window.plans.push(p);if(window.fail)throw Error('Warehouse sync timed out')}}/>);`,
  );
  await shows(/442/);
  // Keyboard: arrows step whole runs, End jumps to the cell's maximum.
  const bath = cell("Lambswool crew Ecru at Milsom Street");
  assert.equal(await bath.getAttribute("aria-valuenow"), "0");
  await bath.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  assert.equal(await bath.getAttribute("aria-valuenow"), "2");
  assert.equal(await bath.getAttribute("aria-valuetext"), "12 units, 2 runs");
  await shows(/454/);
  await page.keyboard.press("End");
  assert.equal(await bath.getAttribute("aria-valuenow"), "12");
  await shows(/72\s*\/ 84\s*12 free/);
  await page.keyboard.press("Home");
  assert.equal(await bath.getAttribute("aria-valuenow"), "0");
  // Over capacity blocks publishing until it is fixed.
  await cell("Lambswool crew Ecru at Marylebone").focus();
  await page.keyboard.press("End");
  const shirt = cell("Wool overshirt Camel at Marylebone");
  await shirt.focus();
  await page.keyboard.press("End");
  assert.equal(await shirt.getAttribute("aria-valuenow"), "12");
  await shows(/Marylebone is 20 units over capacity/);
  assert.equal(await publish().isDisabled(), true);
  await page.keyboard.press("Shift+ArrowLeft");
  assert.equal(await shirt.getAttribute("aria-valuenow"), "7");
  assert.equal(await publish().isDisabled(), false);
  // Fill by grade uses the rest of the pool without breaking capacity.
  await page.locator('[data-demo="autofill"]').click();
  await shows(/100% of 872/);
  // A rejected publish keeps the grid.
  const before = await shirt.getAttribute("aria-valuenow");
  await publish().click();
  await page.getByRole("alert").filter({ hasText: "Warehouse sync timed out." }).waitFor();
  assert.match(await page.getByRole("alert").innerText(), /grid is unchanged/);
  assert.equal(await shirt.getAttribute("aria-valuenow"), before);
  await page.evaluate(() => (window.fail = false));
  await publish().click();
  await page.getByText(/published to 6 stores/).waitFor();
  const plan = await page.evaluate(() => window.plans.at(-1));
  assert.equal(plan.totalUnits + plan.unallocatedUnits, 872);
  assert.ok(plan.allocations.every((a) => a.units === a.runs * (a.styleId === "trouser-stone" ? 8 : 6)));

  // A small pool clamps the cell and says so.
  const style = { id: "tee", name: "Merino tee", sku: "T1", colour: "Ink", hex: "#23262d", garment: "tee", poolUnits: 12, sizeRun: [{ size: "M", units: 6 }] };
  const store = { id: "bath", name: "Milsom Street", region: "Bath", grade: "C", capacity: 84 };
  await mount(`createRoot(document.getElementById('root')).render(<Subject.AssortmentPlanner styles={[${JSON.stringify(style)}]} stores={[${JSON.stringify(store)}]} initialAllocation={{}}/>);`);
  assert.equal(await publish().isDisabled(), true);
  await shows(/Allocate at least one run/);
  await cell("Merino tee Ink at Milsom Street").focus();
  await page.keyboard.press("End");
  assert.equal(await cell("Merino tee Ink at Milsom Street").getAttribute("aria-valuenow"), "2");
  await shows(/pool empty/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.AssortmentPlanner styles={[]}/>);`);
  await shows(/Nothing to allocate yet/);
}
