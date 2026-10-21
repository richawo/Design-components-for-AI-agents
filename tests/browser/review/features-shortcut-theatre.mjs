export async function check({ page, mount, assert }) {
  await mount(`window.theatreActions=[];createRoot(document.getElementById('root')).render(<Subject.FeaturesShortcutTheatre shortcuts={[{action:'create',label:'Create',description:'Create one issue',key:'n',mod:false},{action:'done',label:'Done',description:'Complete the selected issue',key:'x',mod:false}]} issues={[{id:'TEST-1',title:'An existing issue',status:'todo',priority:1}]} people={[]} newIssueTitles={['Fix the release description.']} issuePrefix="TEST" autoplay={false} onAction={action=>window.theatreActions.push(action)}/>);`);
  const create = page.locator('[data-demo="shortcut-create"]');
  await create.focus();
  await create.press('n');
  await page.waitForFunction(() => window.theatreActions.includes('create'));
  const issue = page.locator('[data-demo^="issue-"]').filter({ hasText: 'Fix the release description.' });
  await issue.waitFor();
  assert.equal(await issue.getAttribute('aria-pressed'), 'true');
  await issue.focus();
  await issue.press('x');
  await page.waitForFunction(() => window.theatreActions.at(-1) === 'done');
  await issue.getByLabel('Done', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.theatreActions), ['create', 'done']);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.FeaturesShortcutTheatre shortcuts={[]} issues={[]} people={[]} newIssueTitles={[]} autoplay={false}/>);`);
  assert.equal(await page.locator('[data-demo^="shortcut-"]').count(), 0);
  assert.equal(await page.locator('[data-demo^="issue-"]').count(), 0);
}
