export async function check({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  const initial = { id: 'period', label: 'Original report', revenueMinor: 20000, revenueBudgetMinor: 20000,
    lines: [{ id: 'cost', label: 'Operating costs', actualMinor: 1200, budgetMinor: 1500 }], commentary: ['A reviewed reporting period.'] };
  const revised = { ...initial, label: 'Revised report', revenueMinor: 30000, lines: [{ ...initial.lines[0], actualMinor: 1800 }] };
  const action = () => page.locator('[data-demo="export-report"]');
  const notice = () => page.locator('[data-financial-report] p[role="status"]').last();
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  try {
    await page.setViewportSize({ width: 1440, height: 1800 });
    await mount(`const initial=${JSON.stringify(initial)},revised=${JSON.stringify(revised)};window.exportJobs=[];function Host(){const[report,setReport]=React.useState(initial);const[currency,setCurrency]=React.useState('GBP');const[brand,setBrand]=React.useState('Northstar');window.cloneReport=()=>setReport(structuredClone(initial));window.replaceReport=()=>setReport(revised);window.replaceCurrency=()=>setCurrency('USD');window.replaceBrand=()=>setBrand('Studio');return <Subject.FinancialReport periods={[report]} currency={currency} brand={brand} onExport={payload=>new Promise((resolve,reject)=>window.exportJobs.push({payload:structuredClone(payload),resolve,reject}))}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
    await action().focus();
    await action().evaluate(node => { node.click(); node.click(); });
    await page.waitForFunction(() => window.exportJobs.length === 1);
    assert.equal(await action().isDisabled(), true);
    assert.equal(await action().evaluate(node => node === document.activeElement), true, 'A pending export retains keyboard focus');
    await action().press('Enter');
    assert.equal(await page.evaluate(() => window.exportJobs.length), 1);
    await page.evaluate(() => window.cloneReport());
    await settle();
    assert.equal(await action().isDisabled(), true, 'Equal report values preserve the pending request');
    await capture('export-pending');
    await page.evaluate(() => window.replaceReport());
    await page.waitForFunction(() => !document.querySelector('[data-demo="export-report"]').hasAttribute('aria-disabled'));
    await action().click();
    await page.waitForFunction(() => window.exportJobs.length === 2);
    await page.evaluate(() => window.exportJobs[0].resolve());
    await settle();
    assert.equal(await action().isDisabled(), true, 'A retired export cannot unlock its replacement');
    assert.equal(await notice().innerText(), '');
    await page.evaluate(() => window.exportJobs[1].reject(Error('Export service unavailable')));
    await page.waitForFunction(() => !document.querySelector('[data-demo="export-report"]').hasAttribute('aria-disabled'));
    assert.match(await notice().innerText(), /export failed/);
    await capture('export-rejected');
    await action().click();
    await page.waitForFunction(() => window.exportJobs.length === 3);
    await page.evaluate(() => window.exportJobs[2].resolve());
    await notice().filter({ hasText: 'Revised report exported.' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.exportJobs.map(job => job.payload)), [initial, revised, revised]);
    await capture('export-retry-saved');
    for (const change of ['replaceCurrency', 'replaceBrand']) {
      const index = await page.evaluate(() => window.exportJobs.length);
      await action().click();
      await page.waitForFunction(index => window.exportJobs.length === index + 1, index);
      await page.evaluate(change => window[change](), change);
      await page.waitForFunction(() => !document.querySelector('[data-demo="export-report"]').hasAttribute('aria-disabled'));
      await action().click();
      await page.waitForFunction(index => window.exportJobs.length === index + 2, index);
      await page.evaluate(index => window.exportJobs[index].reject(Error('Retired export rejected')), index);
      await settle();
      assert.equal(await action().isDisabled(), true, 'A retired context cannot finish the current export');
      assert.equal(await notice().innerText(), '');
      await page.evaluate(index => window.exportJobs[index + 1].resolve(), index);
      await notice().filter({ hasText: 'Revised report exported.' }).waitFor();
    }
    await capture('export-current-context');

    await mount(`window.sourceReport=${JSON.stringify(initial)};window.exportOrder=[];createRoot(document.getElementById('root')).render(<Subject.FinancialReport periods={[window.sourceReport]} onExport={payload=>{window.exportOrder.push('callback');payload.label='Changed by export';payload.lines[0].actualMinor=9900;payload.lines.push({id:'injected',label:'Injected cost',actualMinor:500,budgetMinor:500});payload.commentary.push('Injected by callback');}}/>);`);
    await action().evaluate(node => { node.click(); window.exportOrder.push('after-click'); });
    await notice().filter({ hasText: 'Original report exported.' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.sourceReport), initial, 'Host callback mutation cannot edit the displayed report records');
    assert.deepEqual(await page.evaluate(() => window.exportOrder), ['callback', 'after-click'], 'A synchronous export callback runs during the action');
    await capture('export-independent-snapshot');

    await mount(`window.exportJobs=[];function Host(){const[show,setShow]=React.useState(true);window.hideReport=()=>setShow(false);window.showReport=()=>setShow(true);return show?<Subject.FinancialReport periods={[${JSON.stringify(initial)}]} onExport={payload=>new Promise((resolve,reject)=>window.exportJobs.push({payload,resolve,reject}))}/>:<p>Report closed.</p>};createRoot(document.getElementById('root')).render(<Host/>);`);
    await action().click();
    await page.waitForFunction(() => window.exportJobs.length === 1);
    await page.evaluate(() => window.hideReport());
    await page.getByText('Report closed.', { exact: true }).waitFor();
    await page.evaluate(() => window.showReport());
    await action().click();
    await page.waitForFunction(() => window.exportJobs.length === 2);
    await page.evaluate(() => window.exportJobs[0].reject(Error('Unmounted export rejected')));
    await settle();
    assert.equal(await action().isDisabled(), true);
    assert.equal(await notice().innerText(), '');
    await page.evaluate(() => window.exportJobs[1].resolve());
    await notice().filter({ hasText: 'Original report exported.' }).waitFor();
    await capture('export-remounted-owner');
  } finally {
    if (viewport) await page.setViewportSize(viewport);
  }
}
