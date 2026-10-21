// Accepted album opens, retired detail actions and late transport completion.
export async function check({ page, mount, assert }) {
  await mount(`window.collectionSelections=[];window.collectionViews=[];window.collectionJobs=[];createRoot(document.getElementById('root')).render(<Subject.MediaSpatialCollection collections={[{id:'one',title:'First album',creator:'Ada Vale',entries:[]},{id:'two',title:'Second album',creator:'Ben Ito',entries:[{id:'track',name:'Track one',kind:'Audio',size:'3:10'}]}]} onSelectedChange={id=>window.collectionSelections.push(id)} onViewChange={view=>window.collectionViews.push(view)} onOpenCollection={(collection,signal)=>new Promise((resolve,reject)=>window.collectionJobs.push({collection:structuredClone(collection),signal,resolve,reject}))}/>);`);
  const next = page.locator('[data-demo="collection-next"]');
  await next.focus();
  const retiredDetail = page.evaluate(() => new Promise(resolve => {
    const old = document.querySelector('[data-demo="collection-open"]');
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[data-demo="collection-1"][aria-selected="true"]')) return;
      observer.disconnect();
      resolve({ connected: old.isConnected, inert: !!old.closest('[inert]'), disabled: old.disabled });
    });
    observer.observe(document.getElementById('root'), { attributes: true, childList: true, subtree: true });
  }));
  await next.press('Space');
  const retired = await retiredDetail;
  assert.ok(!retired.connected || retired.inert || retired.disabled, 'Outgoing album actions retire with the selection');
  await page.waitForFunction(() => window.collectionSelections.at(-1) === 'two');
  await page.locator('[data-demo="collection-1"][aria-selected="true"]').waitFor();
  await page.getByRole('heading', { name: 'Second album', exact: true }).waitFor();
  const open = page.getByRole('button', { name: /^(Open album|Opening|Opened|Try again)$/ });
  await open.focus();
  await open.press('Enter');
  await page.waitForFunction(() => window.collectionJobs.length === 1);
  assert.equal(await open.getAttribute('aria-busy'), 'true');
  await page.evaluate(() => window.collectionJobs[0].reject(Error('Album service unavailable')));
  await page.getByRole('status').filter({ hasText: 'Album service unavailable' }).waitFor();
  await open.focus();
  await open.press('Space');
  await page.waitForFunction(() => window.collectionJobs.length === 2);
  assert.deepEqual(await page.evaluate(() => window.collectionJobs[0].collection), await page.evaluate(() => window.collectionJobs[1].collection));
  assert.equal(await page.evaluate(() => window.collectionJobs[1].collection.id), 'two');
  await page.evaluate(() => window.collectionJobs[1].resolve());
  await page.waitForFunction(() => !document.querySelector('[data-demo="collection-open"]').hasAttribute('aria-busy'));
  await open.focus();
  await open.press('Enter');
  await page.waitForFunction(() => window.collectionJobs.length === 3);
  await page.locator('[data-demo="collection-list"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.collectionViews.at(-1) === 'list');
  await page.locator('[data-demo="stage"]').waitFor({ state: 'hidden' });
  await page.locator('[data-demo="collection-0"]').focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.collectionSelections.at(-1) === 'one');
  await page.waitForFunction(() => window.collectionJobs[2].signal.aborted);
  await page.evaluate(() => window.collectionJobs[2].resolve());
  await page.getByRole('heading', { name: 'First album', exact: true }).waitFor();
  assert.equal(await open.innerText(), 'Open album');
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MediaSpatialCollection collections={[]}/>);`);
  assert.equal(await page.locator('[data-demo="collection-open"]:enabled').count(), 0);
  assert.equal(await page.locator('[data-demo="stage"]').count(), 0);
}
