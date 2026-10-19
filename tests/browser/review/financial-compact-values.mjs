const painted = element => {
  const range = document.createRange();
  range.selectNodeContents(element);
  const rect = range.getBoundingClientRect();
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
};

export async function checkTable({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  try {
    await page.setViewportSize({ width: 320, height: 1100 });
    await mount(`const format=value=>value===-1?'-US$0.01':'US$90,071,992,547,408.91';createRoot(document.getElementById('root')).render(<div style={{maxWidth:260,margin:'auto'}}><Subject.DataTableSortable title="Cost detail" description="Boundary values" selectable={false} resizable={false} columns={[{key:'name',header:'Cost line',kind:'text',width:240,minWidth:200},{key:'budget',header:'Budget',kind:'currency',formatValue:format,width:240,minWidth:208},{key:'actual',header:'Actual',kind:'currency',formatValue:format,width:240,minWidth:208},{key:'variance',header:'Variance',kind:'currency',formatValue:format,width:240,minWidth:208}]} data={[{id:'large',name:'Large line',budget:9007199254740892,actual:9007199254740891,variance:-1}]}/></div>);`);
    const row = page.getByRole('row').filter({ has: page.getByText('Large line', { exact: true }) });
    await capture('compact-cost-lines');
    for (const [index, header] of [[1, 'Budget'], [2, 'Actual'], [3, 'Variance']]) {
      const cell = row.getByRole('gridcell').nth(index);
      assert.equal(await cell.getByText(header, { exact: true }).isVisible(), true, `Compact ${header} amount retains its visible column label`);
      await cell.focus();
      const bounds = await cell.boundingBox();
      const amount = await cell.locator('span[aria-hidden="true"]').last().evaluate(painted);
      const grid = await page.getByRole('grid').boundingBox();
      assert.ok(amount.left >= bounds.x - 1 && amount.right <= bounds.x + bounds.width + 1, `${header} amount fits its cell`);
      assert.ok(amount.left >= grid.x - 1 && amount.right <= grid.x + grid.width + 1, `${header} amount remains inside the compact table viewport`);
    }
  } finally { if (viewport) await page.setViewportSize(viewport); }
}

export async function checkAllocation({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  try {
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      await mount(`createRoot(document.getElementById('root')).render(<div style={{maxWidth:${width===320?260:1100},margin:'auto'}}><Subject.ChartAllocation title="Operating spend" showComparison={false} views={[{key:'cost',label:'Costs',slices:[{name:'Large line',value:9007199254740891}]}]} formatValue={(value,format)=>format==='full'?'US$90,071,992,547,408.91':'US$90.1tn'}/></div>);`);
      await page.locator('[data-demo="row-0"]').focus();
      const full = page.getByText('US$90,071,992,547,408.91', { exact: true }).filter({ visible: true });
      await full.waitFor();
      const centre = page.locator('div[aria-live="polite"]');
      await centre.getByText('US$90.1tn', { exact: true }).waitFor({ state: 'hidden' });
      await page.waitForFunction(() => {
        const label = [...document.querySelectorAll('p')].find(node => node.textContent === 'US$90,071,992,547,408.91');
        if (!label) return false;
        for (let node = label; node; node = node.parentElement) if (Number(getComputedStyle(node).opacity) < .9999) return false;
        return true;
      });
      await capture('full-allocation-' + width);
      const amount = await full.evaluate(painted);
      const ring = await page.locator('svg[role="img"]').boundingBox();
      const middle = ring.x + ring.width / 2;
      const halfHole = ring.width * .32;
      assert.ok(amount.top >= ring.y + ring.height - 1 || (amount.left >= middle - halfHole && amount.right <= middle + halfHole), 'The complete focused amount sits inside the chart opening or below the ring');
      assert.equal(await page.getByText('1 group', { exact: true }).isVisible(), true);
    }
  } finally { if (viewport) await page.setViewportSize(viewport); }
}
