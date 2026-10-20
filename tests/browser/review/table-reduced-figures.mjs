export async function check({page,mount,assert,capture=async()=>{}}) {
  const painted = () => page.waitForFunction(() => {
    const root = document.querySelector('[role="grid"]')?.closest('section');
    return root && [root, ...root.querySelectorAll('[role="row"], h2')].every(node => {
      const style = getComputedStyle(node);
      return ['none', 'blur(0px)'].includes(style.filter) && Math.abs(new DOMMatrixReadOnly(style.transform).m42) < .1;
    });
  });
  await page.setViewportSize({width:1000,height:800});
  await page.emulateMedia({reducedMotion:'reduce'});
  await mount(`createRoot(document.getElementById('root')).render(<><div style={{height:1800}}>Scroll to cost detail</div><Subject.DataTableSortable title="Reduced-motion cost detail" columns={[{key:'label',header:'Line'},{key:'amount',header:'Amount',kind:'currency'}]} data={[{id:'line',label:'Licences',amount:1234}]} currency="GBP" locale="en-GB" selectable={false} resizable={false}/></>);`);
  const row=page.getByRole('grid').getByRole('row').filter({has:page.getByText('Licences',{exact:true})});
  const visual=row.getByRole('gridcell').last().locator('span[aria-hidden="true"]');
  assert.equal(await visual.innerText(),'£1,234.00','Reduced motion renders its final figures before the table enters the viewport');
  await row.scrollIntoViewIfNeeded();await painted();await capture('reduced-first-view',{audit:true});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<><div style={{height:1800}}>Scroll to cost detail</div><Subject.DataTableSortable title="Live preference cost detail" columns={[{key:'label',header:'Line'},{key:'amount',header:'Amount',kind:'currency'}]} data={[{id:'line',label:'Licences',amount:1234}]} currency="GBP" locale="en-GB" selectable={false} resizable={false}/></>);`);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>[...document.querySelectorAll('[role="gridcell"] [aria-hidden="true"]')].some(node=>node.textContent==='£1,234.00'));
  assert.equal(await visual.innerText(),'£1,234.00','A live reduced-motion preference settles offscreen figures too');
  await row.scrollIntoViewIfNeeded();await painted();await capture('live-reduced-first-view',{audit:true});
}
