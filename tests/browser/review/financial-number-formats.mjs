export async function checkTable({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  try {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      await mount(`window.formattedValues=[];const format=value=>{window.formattedValues.push(value);return (value<100?'z ':'a ')+new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value/100)};function Host(){const[custom,setCustom]=React.useState(true);window.setNumericFormat=setCustom;return <Subject.DataTableSortable title="Minor-unit ledger" description="Custom numeric display" columns={[{key:'name',header:'Name',kind:'entity'},{key:'amount',header:'Amount',kind:'currency',formatValue:custom?format:undefined}]} data={[{id:'a',name:'Alpha',amount:101},{id:'b',name:'Beta',amount:19}]} currency="GBP" locale="en-GB" resizable={false}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
      const alpha = page.getByRole('row').filter({ has: page.getByText('Alpha', { exact: true }) });
      const beta = page.getByRole('row').filter({ has: page.getByText('Beta', { exact: true }) });
      assert.equal(await alpha.getByRole('gridcell').last().locator('span[aria-hidden="true"]').innerText(), 'a £1.01');
      assert.equal(await beta.getByRole('gridcell').last().locator('span[aria-hidden="true"]').innerText(), 'z £0.19');
      assert.equal(await alpha.getByRole('gridcell').last().locator('.sr-only').innerText(), 'a £1.01');
      const sort = page.getByRole('button', { name: 'Amount', exact: true });
      await sort.click();
      const order = () => page.locator('[role="row"][aria-rowindex]:not([aria-rowindex="1"])').evaluateAll(rows => rows.map(row => row.textContent.match(/Alpha|Beta/)?.[0]));
      assert.deepEqual(await order(), ['Alpha', 'Beta'], 'Raw descending numbers determine order, not the reversed display prefixes');
      await sort.click();
      assert.deepEqual(await order(), ['Beta', 'Alpha']);
      if (width === 1440) {
        await page.locator('[data-demo="select-all"]').click();
      } else {
        await alpha.getByRole('checkbox').check();
        await beta.getByRole('checkbox').check();
      }
      const total = page.getByRole('region', { name: 'Selected rows', exact: true });
      await total.waitFor();
      await total.getByText('a £1.20', { exact: true }).waitFor();
      assert.match(await total.innerText(), /a £1\.20/);
      await page.evaluate(() => window.setNumericFormat(false));
      await alpha.getByRole('gridcell').last().getByText('£101.00', { exact: true }).last().waitFor();
      await total.getByText('£120.00', { exact: true }).last().waitFor();
      await page.evaluate(() => window.setNumericFormat(true));
      await alpha.getByRole('gridcell').last().getByText('a £1.01', { exact: true }).last().waitFor();
      await total.getByText('a £1.20', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => [101, 19, 120].every(value => window.formattedValues.includes(value))), true);
      await capture('custom-table-' + width);
    }
  } finally { if (viewport) await page.setViewportSize(viewport); }
}

export async function checkAllocation({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  try {
    await page.setViewportSize({ width: 1100, height: 1100 });
    await mount(`window.formatModes=[];createRoot(document.getElementById('root')).render(<Subject.ChartAllocation title="Allocation in cents" showComparison={false} views={[{key:'cost',label:'Costs',slices:[{name:'Alpha',value:101},{name:'Beta',value:19}]}]} formatValue={(value,format)=>{window.formatModes.push({value,format});return format+':'+new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value/100)}}/>);`);
    await page.getByText('compact:£1.20', { exact: true }).waitFor();
    assert.equal(await page.getByText('short:£1.01', { exact: true }).count(), 1);
    assert.equal(await page.getByText('short:£0.19', { exact: true }).count(), 1);
    const first = page.locator('[data-demo="row-0"]');
    assert.match(await first.getAttribute('aria-label'), /Alpha:.*full:£1\.01/);
    await first.focus();
    await page.getByText('full:£1.01', { exact: true }).waitFor();
    await page.locator('[data-demo="row-1"]').focus();
    await page.getByText('full:£0.19', { exact: true }).waitFor();
    await page.getByText('full:£1.01', { exact: true }).waitFor({ state: 'hidden' });
    await page.getByText('compact:£1.20', { exact: true }).waitFor({ state: 'hidden' });
    await page.waitForFunction(() => {
      const label = [...document.querySelectorAll('p')].find(node => node.textContent === 'full:£0.19');
      if (!label) return false;
      for (let node = label; node; node = node.parentElement) if (Number(getComputedStyle(node).opacity) < .9999) return false;
      return true;
    });
    assert.equal(await page.evaluate(() => ['full', 'compact', 'short'].every(format => window.formatModes.some(call => call.format === format && call.value > 0))), true);
    await capture('custom-allocation');
  } finally { if (viewport) await page.setViewportSize(viewport); }
}
