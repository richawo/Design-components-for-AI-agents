export async function check({ page, mount, assert }) {
  assert.equal(await page.evaluate(() => matchMedia('(pointer:coarse)').matches), true);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.DataTableSortable title="Directory" description="1 of 4 workspaces" columns={[{key:'name',header:'Workspace',kind:'entity',sortable:true},{key:'owner',header:'Owner',sortable:true}]} data={[{id:'harbour',name:'Harbour Works',owner:'Noor Ali'}]} selectable={false} resizable={false}/>);`);
  const heading = await page.getByRole('heading', { name: /^Directory/ }).boundingBox();
  assert.ok(heading.height < 25, 'Directory remains on one line beside or above the phone controls');
  for (const radio of await page.getByRole('radio').all()) {
    const bounds = await radio.boundingBox();
    assert.ok(bounds.width >= 43.5 && bounds.height >= 43.5);
  }
  await page.getByRole('radio', { name: /^compact$/i }).tap();
  assert.equal(await page.getByRole('radio', { name: /^compact$/i }).getAttribute('aria-checked'), 'true');
  assert.equal(await page.getByRole('row').filter({ hasText: 'Harbour Works' }).count(), 1);
}
