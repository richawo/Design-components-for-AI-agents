// Exercise spacing edits, real drags and current clipboard receipts.
export async function check({ page, mount, assert, capture = async () => {} }) {
  await page.setViewportSize({ width: 1440, height: 1200 });
  const fixture = `window.changes=[];window.clipboardCalls=[];window.clipboardFail=true;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.clipboardCalls.push(text);if(window.clipboardFail)throw Error('Clipboard fixture failure')}}});createRoot(document.getElementById('root')).render(<Subject.EditorSpacingInspector onChange={value=>window.changes.push(structuredClone(value))}/>);`;
  await mount(fixture);
  const input = (side) =>
    page.getByRole("textbox", {
      name: side[0].toUpperCase() + side.slice(1) + " padding",
      exact: true,
    });
  const left = () =>
    page.getByRole("slider", { name: "Left padding", exact: true });
  await left().press("ArrowRight");
  assert.equal(await left().getAttribute("aria-valuenow"), "28");
  await left().press("Shift+ArrowRight");
  assert.equal(await left().getAttribute("aria-valuenow"), "68");
  await page.locator('[data-demo="link"]').click();
  await input("top").press("ArrowUp");
  for (const side of ["top", "right", "bottom", "left"])
    assert.equal(await input(side).inputValue(), "28");
  await page
    .getByRole("switch", { name: /Snap to the 4 px grid/ })
    .press("Space");
  await input("top").press("ArrowUp");
  for (const side of ["top", "right", "bottom", "left"])
    assert.equal(await input(side).inputValue(), "29");
  const gap = () => page.getByRole("textbox", { name: "Gap", exact: true });
  await gap().fill("20");
  await gap().press("Enter");
  await page.locator('[data-demo="direction-horizontal"]').press("Enter");
  await page.locator('[data-demo="align-center"]').press("Enter");
  const expected = {
    direction: "horizontal",
    align: "center",
    gap: 20,
    padding: { top: 29, right: 29, bottom: 29, left: 29 },
  };
  assert.deepEqual(await page.evaluate(() => window.changes.at(-1)), expected);
  await capture("keyboard-layout", { audit: true });
  const copy = page.locator('[data-demo="copy-css"]');
  await copy.click();
  await page
    .getByRole("status")
    .filter({ hasText: /Couldn.t reach the clipboard/ })
    .waitFor();
  const css = await page.evaluate(() => window.clipboardCalls[0]);
  assert.match(css, /flex-direction: row;/);
  assert.match(css, /align-items: center;/);
  assert.match(css, /padding: 29px;/);
  assert.equal(await page.evaluate(() => getSelection().toString()), css);
  await capture("clipboard-failed", { audit: true });
  const reports = await page.evaluate(() => window.changes.length);
  await page.evaluate(() => (window.clipboardFail = false));
  await copy.click();
  await page.getByRole("status").filter({ hasText: "CSS copied" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.clipboardCalls), [
    css,
    css,
  ]);
  assert.equal(
    await page.evaluate(() => window.changes.length),
    reports,
    "Clipboard status does not report another layout edit",
  );
  await mount(fixture);
  await left().scrollIntoViewIfNeeded();
  const box = await left().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  const moved = Number(await left().getAttribute("aria-valuenow"));
  assert.ok(
    moved > 24 && moved % 4 === 0,
    "A real padding-band drag changes the measured layout on the grid",
  );
  assert.equal(await input("left").inputValue(), String(moved));
  for (const side of ["top", "right", "bottom"])
    assert.equal(await input(side).inputValue(), "24");
  await capture("dragged-padding", { audit: true });
  await page
    .getByRole("button", { name: "Reset spacing", exact: true })
    .click();
  assert.equal(await input("left").inputValue(), "24");
  assert.equal(await gap().inputValue(), "16");
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorSpacingInspector layers={[]}/>);`,
  );
  assert.equal(await page.getByRole("slider", { name: /^Gap / }).count(), 0);
  assert.doesNotMatch(
    await page.locator("section").innerText(),
    /NaN|Infinity/,
  );
  await capture("empty", { audit: true });
  await mount(
    `window.copyJobs=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:text=>new Promise(resolve=>window.copyJobs.push({text,resolve}))}});createRoot(document.getElementById('root')).render(<Subject.EditorSpacingInspector/>);`,
  );
  await copy.click();
  await gap().fill("20");
  await gap().press("Enter");
  await page.evaluate(() => window.copyJobs[0].resolve());
  await page.waitForTimeout(50);
  assert.equal(
    await page.getByRole("status").filter({ hasText: "CSS copied" }).count(),
    0,
    "An old clipboard reply cannot acknowledge the displayed CSS",
  );
  await copy.click();
  assert.match(
    await page.evaluate(() => window.copyJobs[1].text),
    /gap: 20px;/,
  );
  await page.evaluate(() => window.copyJobs[1].resolve());
  await page.getByRole("status").filter({ hasText: "CSS copied" }).waitFor();
  await capture("current-copy", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorSpacingInspector onChange={value=>{value.padding.top=999}}/>);`,
  );
  await input("left").press("ArrowUp");
  await gap().press("ArrowUp");
  await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.equal(
    await input("top").inputValue(),
    "24",
    "Callback mutation cannot alter the retained layout",
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorSpacingInspector defaultValue={{direction:'vertical',align:'start',gap:NaN,padding:{top:Infinity,right:-1,bottom:24,left:24}}}/>);`,
  );
  assert.doesNotMatch(
    await page.locator("section").innerText(),
    /NaN|Infinity/,
  );
  await page.getByRole("alert").waitFor();
  await capture("invalid", { audit: true });
}
