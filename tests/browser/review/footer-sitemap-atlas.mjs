export async function check({ page, mount, assert }) {
  await mount(`window.atlasQueries=[];createRoot(document.getElementById('root')).render(<Subject.FooterSitemapAtlas homeHref="" groups={[{id:'docs',label:'Documentation',links:[{id:'cafe',label:'Café manual',href:'#cafe',keywords:['coffee']},{id:'reference',label:'API reference',href:'#reference'}]},{id:'docs',label:'Duplicate group',links:[{id:'hidden',label:'Duplicate must stay absent',href:'#hidden'}]}]} currentHref="#cafe" legalLinks={[]} onQueryChange={query=>window.atlasQueries.push(query)}/>);`);
  const search = page.locator('[data-demo="atlas-search"]');
  const cafe = page.locator('[data-demo="atlas-link-cafe"]');
  assert.equal(await cafe.getAttribute('aria-current'), 'page');
  assert.equal(await page.locator('[data-demo="atlas-link-hidden"]').count(), 0);
  await search.fill('cafe');
  await page.waitForFunction(() => window.atlasQueries.at(-1) === 'cafe');
  await search.press('ArrowDown');
  assert.equal(await cafe.evaluate(node => node === document.activeElement), true);
  await cafe.press('Enter');
  await page.waitForFunction(() => location.hash === '#cafe');
  const clear = page.locator('[data-demo="atlas-clear"]');
  await clear.focus();
  await clear.press('Space');
  assert.equal(await search.inputValue(), '');
  assert.equal(await page.evaluate(() => window.atlasQueries.at(-1)), '');
  await search.fill('no matching page');
  await search.press('Escape');
  assert.equal(await search.inputValue(), '');
  await mount(`createRoot(document.getElementById('root')).render(<Subject.FooterSitemapAtlas homeHref="" groups={[]} legalLinks={[]}/>);`);
  assert.equal(await page.locator('[data-demo^="atlas-link-"]').count(), 0);
}
