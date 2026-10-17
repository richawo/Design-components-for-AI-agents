export async function check({ page, mount, assert }) {
  const view = () => page.locator("section").first().innerText();
  const confirm = () => page.locator('[data-demo="confirm"]');
  const radio = (name) => page.getByRole("radio", { name, exact: true });
  await mount(
    `window.requests=[];window.fail=true;createRoot(document.getElementById('root')).render(` +
      `<Subject.ExchangeSelector onConfirm={async r=>{window.requests.push(r);if(window.fail)throw Error('Ink in M was just reserved')}}/>);`,
  );
  assert.equal(await confirm().isDisabled(), true);
  assert.match(await view(), /Choose a new colour or size/);
  // Keyboard: the colour group is one tab stop; ArrowRight moves from Oat to Ink.
  await radio("Oat, your colour").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await radio("Ink").getAttribute("aria-checked"), "true");
  assert.match(await view(), /To pay/);
  // Sold-out options can't be chosen.
  assert.equal(await radio("Ecru, sold out").getAttribute("aria-disabled"), "true");
  await radio("Ecru, sold out").click({ force: true });
  assert.equal(await radio("Ink").getAttribute("aria-checked"), "true");
  // "Too small" moves to the next size up.
  await radio("Too small").click();
  assert.equal(await radio("M, 2 left").getAttribute("aria-checked"), "true");
  assert.match(await view(), /We moved you to M, one size up/);
  assert.match(await view(), /Chest 56 cm · Length 68 cm/);
  assert.equal(await confirm().innerText(), "Pay £10.00 and exchange");
  // A rejected request keeps every choice.
  await confirm().click();
  await page.getByRole("alert").filter({ hasText: "Ink in M was just reserved." }).waitFor();
  assert.match(await page.getByRole("alert").innerText(), /choices are saved/);
  assert.equal(await radio("Ink").getAttribute("aria-checked"), "true");
  assert.equal(await radio("M, 2 left").getAttribute("aria-checked"), "true");
  await page.evaluate(() => (window.fail = false));
  await confirm().click();
  await page.getByText("Exchange confirmed").waitFor();
  const request = await page.evaluate(() => window.requests.at(-1));
  assert.deepEqual(request.from, { colourwayId: "oat", size: "S" });
  assert.deepEqual(request.to, { colourwayId: "ink", size: "M" });
  assert.equal(request.reasonId, "small");
  assert.equal(request.differenceMinor, 1000);
  assert.match(await view(), /We charge £10\.00/);

  // A cheaper colourway becomes a refund; a colour without the current size moves to the nearest one.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ExchangeSelector/>);`);
  await radio("Rust").click();
  assert.match(await view(), /We refund/);
  assert.match(await view(), /£20\.00/);
  assert.equal(await radio("S, 2 left").getAttribute("aria-checked"), "true");
  await radio("Ink").click();
  await radio("XL, sold out").click({ force: true });
  assert.equal(await radio("XL, sold out").getAttribute("aria-checked"), "false");
  await radio("Prefer another colour").click();
  assert.equal(await confirm().isDisabled(), false);

  // No colourways at all.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ExchangeSelector colourways={[]}/>);`);
  assert.match(await view(), /can’t be exchanged online/);
}
