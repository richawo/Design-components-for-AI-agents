const stages = `[{id:'prepare',label:'Prepare',before:{tool:'Manual',title:'Collect files',minutes:10,rows:[{label:'One queue',state:'warn'}]},after:{tool:'Workspace',title:'Files ready',minutes:2,rows:[{label:'One queue',state:'ok'}]}},{id:'finish',label:'Finish',before:{tool:'Manual',title:'Recheck files',minutes:20,rows:[{label:'Review queue',state:'warn'}]},after:{tool:'Workspace',title:'Review complete',minutes:3,rows:[{label:'Review queue',state:'ok'}]}}]`;
export async function check({ page, mount, assert }) {
  await mount(`window.lensStages=[];createRoot(document.getElementById('root')).render(<Subject.FeaturesCompareLenses stages={${stages}} onValueChange={id=>window.lensStages.push(id)}/>);`);
  const lens = page.locator('[data-demo="lens"]');
  await lens.waitFor();
  await lens.focus();
  await lens.press('End');
  await page.waitForFunction(() => window.lensStages.at(-1) === 'finish');
  assert.equal(await lens.getAttribute('aria-valuenow'), '2');
  await lens.press('Home');
  await page.waitForFunction(() => window.lensStages.at(-1) === 'prepare');
  assert.equal(await lens.getAttribute('aria-valuenow'), '1');
  const finish = page.locator('[data-demo="stage-finish"]');
  await finish.focus();
  await finish.press('Space');
  await page.waitForFunction(() => window.lensStages.at(-1) === 'finish');
  assert.equal(await lens.getAttribute('aria-valuenow'), '2');
  await mount(`createRoot(document.getElementById('root')).render(<Subject.FeaturesCompareLenses stages={${stages}} value="prepare"/>);`);
  assert.equal(await page.locator('[data-demo="lens"]').getAttribute('aria-disabled'), 'true');
  assert.equal(await page.locator('[data-demo="stage-finish"]').isDisabled(), true);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.FeaturesCompareLenses stages={[]}/>);`);
  assert.equal(await page.locator('[data-demo="lens"]').count(), 0);
  assert.equal(await page.locator('[data-demo^="stage-"]').count(), 0);
}
