export async function check({ page, mount, assert }) {
  const guide = () => page.locator("section").first().innerText();
  const chest = () => page.getByLabel("Your chest");
  const cell = (name) => page.getByRole("textbox", { name, exact: true });
  const publish = () => page.locator('[data-demo="publish"]');
  await mount(
    `window.guides=[];window.fail=true;createRoot(document.getElementById('root')).render(` +
      `<Subject.SizeGuide onSave={async g=>{window.guides.push(g);if(window.fail)throw Error('Shopify rejected the update')}}/>);`,
  );
  // 96 cm sits between S (10 cm of ease) and M (16 cm); the designed 12 cm and "size down" pick S.
  await chest().fill("96");
  assert.match(await guide(), /Between S and M/);
  assert.match(await guide(), /We’d take S/);
  assert.equal(await page.getByRole("radio", { name: "S, your size" }).getAttribute("aria-checked"), "true");
  // Inches convert the shopper's figure and the table, and keep the recommendation.
  await page.getByRole("radio", { name: "Inches" }).click();
  assert.equal(await chest().inputValue(), "37.8");
  assert.match(await page.getByRole("row", { name: /Chest width/ }).innerText(), /20\.9/);
  assert.match(await guide(), /Between S and M/);
  // Keyboard: arrows walk the size on the sketch.
  await page.getByRole("radio", { name: "S, your size" }).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("radio", { name: "M", exact: true }).getAttribute("aria-checked"), "true");
  // Invalid and out-of-range input explain themselves.
  await chest().fill("abc");
  assert.match(await guide(), /Enter a number/);
  await chest().fill("200");
  assert.match(await guide(), /between 23\.6 and 63\.0 in/);
  await chest().fill("52");
  assert.match(await guide(), /Larger than our XL/);

  // Editing: a smaller size than the one before it, or two decimals, blocks publishing.
  await page.getByRole("button", { name: "Edit measurements" }).click();
  assert.equal(await page.getByRole("radio", { name: "Inches" }).isDisabled(), true);
  await cell("Chest width M centimetres").fill("52.4");
  assert.match(await guide(), /Chest width in M should be larger than S/);
  assert.equal(await publish().isDisabled(), true);
  await cell("Chest width M centimetres").fill("56.25");
  assert.match(await guide(), /at most one decimal/);
  await cell("Chest width M centimetres").fill("56.5");
  assert.match(await guide(), /1 value changed/);
  // A rejected publish keeps the edits.
  await publish().click();
  await page.getByRole("alert").filter({ hasText: "Shopify rejected the update." }).waitFor();
  assert.match(await page.getByRole("alert").innerText(), /edits are kept/);
  assert.equal(await cell("Chest width M centimetres").inputValue(), "56.5");
  assert.equal(await publish().innerText(), "Publish again");
  await page.evaluate(() => (window.fail = false));
  await publish().click();
  await page.getByText("Size guide published.").waitFor();
  const saved = await page.evaluate(() => window.guides.at(-1));
  assert.equal(saved.measurements[0].millimetres.m, 565);
  assert.equal(saved.measurements[1].millimetres.m, 680);
  assert.match(await page.getByRole("row", { name: /Chest width/ }).innerText(), /56\.5/);
  // Discard restores the published values.
  await page.getByRole("button", { name: "Edit measurements" }).click();
  await cell("Body length XL centimetres").fill("80");
  await page.getByRole("button", { name: "Discard" }).click();
  assert.match(await page.getByRole("row", { name: /Body length/ }).innerText(), /72/);

  // The phone table scrolls within its own region; labels never collide with the first size.
  await page.setViewportSize({width:320,height:900});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SizeGuide/>);`);
  const clearLabels = await page.getByRole('table').evaluate(table => [...table.querySelectorAll('tbody tr')].every(row => {
    const label = row.querySelector('th > span > span:last-child');
    const value = row.querySelector('td');
    return label.getBoundingClientRect().right <= value.getBoundingClientRect().left;
  }));
  assert.equal(clearLabels, true, 'Measurement labels stay out of the size columns');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, 'The phone document does not scroll horizontally');
  assert.ok(await page.getByRole('region',{name:'Garment measurements table',exact:true}).evaluate(el => el.scrollWidth > el.clientWidth));
  await page.setViewportSize({width:390,height:900});

  // A missing measurement is flagged and can't be published until it's filled.
  const sizes = [{ id: "s", label: "S" }, { id: "m", label: "M" }];
  const width = { id: "x", label: "Width", instruction: "Flat", point: "chest", flat: true, millimetres: { s: 500 } };
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.SizeGuide sizes={${JSON.stringify(sizes)}} measurements={${JSON.stringify([width])}} onSave={()=>{}}/>);`,
  );
  assert.match(await page.getByRole("table").innerText(), /Check/);
  await page.getByRole("button", { name: "Edit measurements" }).click();
  assert.match(await guide(), /Width in M needs centimetres/);
  assert.equal(await publish().isDisabled(), true);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SizeGuide measurements={[]}/>);`);
  assert.match(await guide(), /No measurements for this style yet/);
}
