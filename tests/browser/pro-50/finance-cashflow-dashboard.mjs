export async function check({ page, mount, assert }) {
  const section = () => page.locator("section").first();
  await mount(
    `window.moves=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.CashflowDashboard onMoveMovement={async(id,date)=>{window.moves.push([id,date]);if(window.fail){window.fail=false;throw Error('The direct debit is already scheduled.')}}}/>);`,
  );
  assert.match(await section().innerText(), /Below floor · w\/c 28 Dec/);
  const week = (label) => page.getByRole("radio", { name: new RegExp(`^Week of ${label}:`) });
  assert.equal(await week("28 Dec").getAttribute("aria-checked"), "true");

  // Keyboard: arrows walk the weeks, Home jumps to the first.
  await week("28 Dec").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await week("4 Jan").getAttribute("aria-checked"), "true");
  await page.keyboard.press("Home");
  assert.equal(await week("19 Oct").getAttribute("aria-checked"), "true");

  // Narrow cards fold the list; the rent is further down.
  await page.getByRole("button", { name: "Show all 18" }).click();

  // A rejected push moves the payment back and says why.
  const push = page.locator('[data-demo="push-rent"]');
  await push.click();
  await page.getByText(/Oakridge Lettings stays on 28 Dec\. The direct debit is already scheduled\./).waitFor();
  assert.match(await section().innerText(), /Below floor/);
  assert.equal(await week("28 Dec").getAttribute("aria-checked"), "true", "Rejected moves return selection to the payment's original week");

  // The retry lands it a week later and the dip clears.
  await push.click();
  await page.getByText("Moved from 28 Dec").waitFor();
  assert.deepEqual(await page.evaluate(() => window.moves[1]), ["rent", "2027-01-04"]);
  assert.match(await section().innerText(), /Above floor/);
  assert.equal(await week("4 Jan").getAttribute("aria-checked"), "true");
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForFunction(() => window.moves.length === 3);
  assert.deepEqual(await page.evaluate(() => window.moves[2]), ["rent", "2026-12-28"]);
  assert.match(await section().innerText(), /Below floor/);

  // The horizon picker is a radiogroup.
  await page.getByRole("radio", { name: "6 weeks" }).click();
  assert.match(await section().innerText(), /6-week forecast/);
  await page.getByRole("radio", { name: /^Week of/ }).nth(5).waitFor();
  assert.equal(await page.getByRole("radio", { name: /^Week of/ }).count(), 6);

  // At desktop widths the list itself follows the selected week.
  await page.setViewportSize({width:1440,height:1000});
  try {
    await mount(`document.getElementById('root').style.maxWidth='1200px';createRoot(document.getElementById('root')).render(<Subject.CashflowDashboard/>);`);
    await page.waitForFunction(() => {
      const list = document.querySelector('[aria-label="Large movements"] > ul');
      const row = list?.querySelector('[data-in-week]');
      if (!list || !row || list.scrollHeight <= list.clientHeight) return false;
      const box = list.getBoundingClientRect(), item = row.getBoundingClientRect();
      return list.scrollTop > 0 && item.top >= box.top - 1 && item.bottom <= box.bottom + 1;
    });
    await week("19 Oct").focus();
    await page.keyboard.press("Home");
    await page.waitForFunction(() => document.querySelector('[aria-label="Large movements"] > ul').scrollTop < 64);
    await week("28 Dec").click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Large movements"] > ul').scrollTop > 0);
  } finally { await page.setViewportSize({width:390,height:900}); }

  // Independent host saves keep both payment rows pending until each acknowledges.
  await mount(`window.releases={};createRoot(document.getElementById('root')).render(<Subject.CashflowDashboard largeThresholdMinor={0} movements={[{id:'a',label:'Payment A',date:'2026-10-20',amountMinor:-500000,movable:true},{id:'b',label:'Payment B',date:'2026-10-21',amountMinor:-500000,movable:true}]} onMoveMovement={id=>new Promise(resolve=>window.releases[id]=resolve)}/>);`);
  await page.locator('[data-demo="push-a"]').click();
  await page.locator('[data-demo="push-b"]').click();
  const a = page.locator('li').filter({hasText:'Payment A'}).getByRole('button',{name:'Undo',exact:true});
  const b = page.locator('li').filter({hasText:'Payment B'}).getByRole('button',{name:'Undo',exact:true});
  assert.equal(await a.isDisabled(), true);
  assert.equal(await b.isDisabled(), true);
  await page.evaluate(() => window.releases.a());
  await page.waitForFunction(() => [...document.querySelectorAll('button')].filter(el => el.textContent.trim() === 'Undo' && el.disabled).length === 1);
  assert.equal(await b.isDisabled(), true);
  await page.evaluate(() => window.releases.b());
  await page.waitForFunction(() => [...document.querySelectorAll('button')].filter(el => el.textContent.trim() === 'Undo' && el.disabled).length === 0);

  // Empty data stays written, not blank.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CashflowDashboard movements={[]}/>);`);
  assert.match(await section().innerText(), /Nothing over £10[kK] in the next 13 weeks/);
  assert.match(await section().innerText(), /Above floor/);
  assert.doesNotMatch(await section().innerText(), /NaN|Infinity/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CashflowDashboard movements={[{id:'bad',label:'Invalid payment',date:'2026-02-30',amountMinor:-1000}]}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /Invalid payment.*invalid movement date/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CashflowDashboard movements={[{id:'bad',label:'Bad amount',date:'2026-10-20',amountMinor:NaN}]}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /Bad amount.*whole amount in minor units/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CashflowDashboard startDate="not-a-date"/>);`);
  assert.match(await page.getByRole("alert").innerText(), /valid start date/);
}
