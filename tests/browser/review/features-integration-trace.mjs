export async function check({ page, mount, assert }) {
  const integrations = `[{id:'fixture',label:'Checkout to CRM',source:'Checkout',destination:'CRM',stages:[{id:'source',kind:'source',label:'Received',system:'Checkout',operation:'checkout.completed',fields:[{id:'name',key:'full_name',value:'Ada Vale'}]},{id:'normal',kind:'transform',label:'Normalised',system:'Relay',operation:'normalise',fields:[{id:'name',key:'display_name',value:'Ada Vale'}]},{id:'created',kind:'action',label:'Created',system:'CRM',operation:'create.record',fields:[{id:'name',key:'name',value:'Ada Vale',role:'title'}],result:{ok:true,status:'Created',reference:'REC-7'}}]}]`;
  await mount(`window.traceSelections=[];window.traceRuns=[];createRoot(document.getElementById('root')).render(<Subject.FeaturesIntegrationTrace integrations={${integrations}} stepMs={100} onValueChange={selection=>window.traceSelections.push({...selection})} onRun={integration=>window.traceRuns.push(integration.id)}/>);`);
  await page.locator('[data-demo="stage-fixture-source"]').focus();
  await page.keyboard.press('End');
  await page.waitForFunction(() => window.traceSelections.at(-1)?.stageId === 'created');
  await page.getByText(/· REC-7$/).waitFor();
  assert.equal(await page.getByText(/· REC-7$/).count(), 1);
  await page.locator('[data-demo="run"]').focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.traceRuns.length === 1 && window.traceSelections.length >= 4);
  assert.deepEqual(await page.evaluate(() => window.traceRuns), ['fixture']);
  assert.deepEqual(await page.evaluate(() => window.traceSelections.slice(-3)), [{ integrationId: 'fixture', stageId: 'source' }, { integrationId: 'fixture', stageId: 'normal' }, { integrationId: 'fixture', stageId: 'created' }]);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.FeaturesIntegrationTrace integrations={[]}/>);`);
  assert.equal(await page.locator('[data-demo="run"]:enabled').count(), 0);
  assert.equal(await page.locator('[data-demo^="stage-"]').count(), 0);
}
