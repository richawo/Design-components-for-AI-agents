export async function check({ page, mount, assert }) {
  const parts = `[{id:'body',name:'Body',summary:'Aluminium housing',specs:[{label:'Length',value:{value:25.4,unit:'mm'}}],paths:['M10 10h30v20H10Z'],anchor:[25,20],label:[5,10],labelSide:'left'},{id:'foot',name:'Foot',summary:'Steel base',specs:[{label:'Mass',value:{value:1,unit:'kg'}}],paths:['M20 70h40v10H20Z'],anchor:[40,75],label:[65,75],labelSide:'right'}]`;
  await mount(`window.specSelections=[];window.specUnits=[];createRoot(document.getElementById('root')).render(<Subject.ContentInteractiveSpec parts={${parts}} size={[100,100]} scenery={[]} dimensions={[]} titleBlock={[]} defaultValue={null} onValueChange={(id,part)=>window.specSelections.push({id,name:part?.name??null})} onUnitsChange={units=>window.specUnits.push(units)}/>);`);
  const body = page.locator('[data-demo="row-body"]');
  const foot = page.locator('[data-demo="row-foot"]');
  await body.focus();
  await body.press('Space');
  await page.waitForFunction(() => window.specSelections.length === 1);
  assert.deepEqual(await page.evaluate(() => window.specSelections[0]), { id: 'body', name: 'Body' });
  await body.press('ArrowDown');
  await page.waitForFunction(() => window.specSelections.length === 2);
  assert.deepEqual(await page.evaluate(() => window.specSelections[1]), { id: 'foot', name: 'Foot' });
  assert.equal(await foot.evaluate(node => node === document.activeElement), true);
  await foot.press('ArrowUp');
  await page.waitForFunction(() => window.specSelections.length === 3);
  await page.locator('[data-demo="units-imperial"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.specUnits.length === 1);
  assert.deepEqual(await page.evaluate(() => window.specUnits), ['imperial']);
  await page.waitForFunction(() => /1\.0\s*in/.test(document.querySelector('[data-demo="row-body"]').textContent));
  assert.match(await body.innerText(), /1\.0\s*in/);
  await body.focus();
  await body.press('Escape');
  await page.waitForFunction(() => window.specSelections.at(-1)?.id === null);
  assert.deepEqual(await page.evaluate(() => window.specSelections.at(-1)), { id: null, name: null });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ContentInteractiveSpec parts={[]} scenery={[]} dimensions={[]} titleBlock={[]}/>);`);
  assert.equal(await page.locator('[data-demo^="part-"]').count(), 0);
  assert.equal(await page.locator('[data-demo^="row-"]').count(), 0);
}
