export async function check({ page, mount, assert }) {
  await mount(`window.ledgerFilters=[];window.ledgerOpens=[];createRoot(document.getElementById('root')).render(<Subject.SocialProofCaseLedger cases={[{id:'alpha',company:'Alpha Studio',industry:'software',metric:'Waiting',unit:'hours',before:100,after:50,better:'lower',quote:{text:'We spend less time waiting.',name:'Ada Vale',role:'Operations'}},{id:'beta',company:'Beta Shop',industry:'retail',metric:'Completed orders',before:0,after:20,better:'higher',quote:{text:'Our first measured reporting period.',name:'Ben Ito',role:'Owner'}}]} onFilterChange={filter=>window.ledgerFilters.push(filter)} onOpenChange={id=>window.ledgerOpens.push(id)}/>);`);
  const alpha = page.locator('[data-demo="case-alpha"]');
  await alpha.focus();
  await alpha.press('Enter');
  await page.waitForFunction(() => window.ledgerOpens.length === 1);
  assert.equal(await alpha.getAttribute('aria-expanded'), 'true');
  await page.getByText(/We spend less time waiting\./).first().waitFor();
  await page.locator('[data-demo="filter-retail"]').focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.ledgerFilters.at(-1) === 'retail');
  await alpha.waitFor({ state: 'hidden' });
  const beta = page.locator('[data-demo="case-beta"]');
  await beta.waitFor();
  assert.match(await beta.innerText(), /No baseline/);
  await beta.focus();
  await beta.press('Enter');
  await page.waitForFunction(() => window.ledgerOpens.at(-1) === 'beta');
  await beta.press('Space');
  await page.waitForFunction(() => window.ledgerOpens.at(-1) === null);
  assert.deepEqual(await page.evaluate(() => window.ledgerOpens), ['alpha', 'beta', null]);
  assert.doesNotMatch(await page.locator('#root').innerText(), /NaN|Infinity/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SocialProofCaseLedger cases={[]}/>);`);
  assert.equal(await page.locator('[data-demo^="case-"]').count(), 0);
  assert.doesNotMatch(await page.locator('#root').innerText(), /NaN|Infinity/);
}
