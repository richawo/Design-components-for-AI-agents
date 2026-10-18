export async function check({ page, mount, assert, choose, capture = async () => {} }) {
  const total = () => page.locator("dl").innerText();
  await mount(
    `window.rules=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.PromotionBuilder onSave={async rule=>{window.rules.push(rule);if(window.fail)throw Error('The store could not save this rule.');await new Promise(resolve=>window.finishRule=resolve)}}/>);`,
  );
  assert.match(await total(), /£128.00/);
  assert.match(await total(), /£113.00/);
  assert.match(await page.getByRole("listitem").nth(0).innerText(), /£74.15/);
  assert.match(await page.getByRole("listitem").nth(1).innerText(), /£38.85/);
  const returning = page.getByRole("radio", { name: "Returning", exact: true });
  await returning.click();
  assert.match(await total(), /£128.00/);
  assert.match(await page.getByRole("status").innerText(), /outside the selected audience/);
  await returning.press("Home");
  assert.equal(
    await page.getByRole("radio", { name: "New customer", exact: true }).getAttribute("aria-checked"),
    "true",
  );
  assert.match(await total(), /£113.00/);
  await choose(page.getByRole("combobox", { name: "Eligible category", exact: true }), "Home");
  assert.match(await total(), /£119.20/);
  await choose(page.getByRole("combobox", { name: "Discount type", exact: true }), "fixed");
  await page.getByRole("textbox", { name: "Discount value", exact: true }).fill("100.00");
  await page.getByRole("textbox", { name: "Maximum saving", exact: true }).fill("");
  assert.match(await total(), /£84.00/);
  await page.getByRole("textbox", { name: "Promotion code", exact: true }).fill("!");
  assert.equal(await page.getByRole("button", { name: "Save rule", exact: true }).isDisabled(), true);
  await capture("invalid-rule", { audit: true });
  await page.getByRole("textbox", { name: "Promotion code", exact: true }).fill("offer");
  await page.getByRole("button", { name: "Save rule", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "The store could not save this rule." }).waitFor();
  await capture("save-failed", { audit: true });
  assert.equal(await page.getByRole("textbox", { name: "Promotion code", exact: true }).inputValue(), "OFFER");
  assert.equal(await page.getByRole("textbox", { name: "Discount value", exact: true }).inputValue(), "100.00");
  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "Save rule", exact: true }).click();
  assert.equal(await page.getByRole("textbox", { name: "Promotion code", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("combobox", { name: "Eligible category", exact: true }).isDisabled(), true);
  await page.locator('[data-demo="save"]').evaluate((el) => el.click());
  assert.equal(await page.evaluate(() => window.rules.length), 2);
  assert.deepEqual(await page.evaluate(() => window.rules[1]), {
    code: "OFFER",
    kind: "fixed",
    value: 10000,
    minimumMinor: 5000,
    capMinor: null,
    category: "Home",
    audience: "new",
  });
  await capture("save-pending", { audit: true });
  await page.evaluate(() => window.finishRule());
  await page.getByText("OFFER rule saved", { exact: true }).waitFor();
  await capture("saved", { audit: true });
  assert.equal(await page.getByRole("button", { name: "Saved", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Edit rule", exact: true }).click();
  assert.equal(await page.getByRole("textbox", { name: "Promotion code", exact: true }).isDisabled(), false);

  // Savings stay exact at the safe-integer boundary, including the final penny.
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.PromotionBuilder basket={[{id:'one',name:'Wholesale order',category:'Clothing',quantity:1,priceMinor:9007199254740991}]} defaultRule={{code:'EXACT',kind:'fixed',value:9007199254740990,minimumMinor:0,capMinor:null,category:null,audience:'all'}}/>);`,
  );
  assert.equal(
    await page.getByRole("textbox", { name: "Discount value", exact: true }).inputValue(),
    "90071992547409.90",
  );
  assert.match(await total(), /After promotion\s+£0.01/);
  await capture("exact-boundary", { audit: true });
  assert.equal(await page.getByRole("button", { name: "Save rule", exact: true }).isDisabled(), true);

  for (const [currency, minor, value] of [
    ["JPY", 123, 23],
    ["KWD", 1234, 234],
  ]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.PromotionBuilder currency=${JSON.stringify(currency)} basket={[{id:'one',name:'Unit',category:'Home',quantity:1,priceMinor:${minor}}]} defaultRule={{code:'EXACT',kind:'fixed',value:${value},minimumMinor:0,capMinor:null,category:null,audience:'all'}}/>);`,
    );
    assert.equal(
      await page.getByRole("textbox", { name: "Discount value", exact: true }).inputValue(),
      currency === "JPY" ? "23" : "0.234",
    );
    const text = (await total()).replaceAll("\u00a0", " ");
    assert.ok(text.includes(currency === "JPY" ? "JP¥100" : "KWD 1.000"), text);
  }

  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.PromotionBuilder basket={[{id:'duplicate',name:'A',category:'Home',quantity:1,priceMinor:100},{id:'duplicate',name:'B',category:'Home',quantity:1,priceMinor:100},{id:'invalid',name:'Invalid',category:'Home',quantity:-1,priceMinor:100}]}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /Invalid basket lines: 3/);
  assert.match(await page.getByLabel("Basket receipt").innerText(), /No valid items/);
  assert.doesNotMatch(await total(), /NaN|Infinity/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PromotionBuilder basket={[]}/>);`);
  assert.match(await page.getByRole("status").innerText(), /Add an item/);

  // An old currency's response cannot certify a newly displayed rule.
  await mount(
    `window.rules=[];window.swapCurrency=null;function Host(){const [currency,setCurrency]=React.useState('GBP');window.swapCurrency=setCurrency;return <Subject.PromotionBuilder currency={currency} onSave={rule=>{window.rules.push(rule);return new Promise(resolve=>window.finishOld=resolve)}}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.getByRole("button", { name: "Save rule", exact: true }).click();
  await page.evaluate(() => window.swapCurrency("JPY"));
  await page.getByRole("button", { name: "Save rule", exact: true }).waitFor();
  await page.evaluate(() => window.finishOld());
  assert.equal(await page.getByText("AUTUMN20 rule saved", { exact: true }).count(), 0);
}
