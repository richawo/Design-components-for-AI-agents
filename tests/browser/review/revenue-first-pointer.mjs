export async function checkRevenuePointer({ page, mount, assert, capture = async () => {} }) {
  await mount(`const data=Array.from({length:14},(_,i)=>({date:new Date(Date.UTC(2026,8,1+i)).toISOString().slice(0,10),value:i+1}));createRoot(document.getElementById('root')).render(<><button>Outside chart</button><Subject.ChartRevenueTrend data={data} ranges={[{key:'week',label:'7D',days:7},{key:'short',label:'3D',days:3}]} defaultRange="week" unit="count" locale="en-GB"/></>);`);
  const coarse = await page.evaluate(() => matchMedia('(pointer:coarse)').matches);
  const plot = page.locator('[data-demo="plot"]');
  const read = () => plot.locator('[aria-live="polite"]').innerText();
  await plot.focus();
  assert.match(await read(), /14 Sep/);
  await plot.press('Home');
  assert.match(await read(), /8 Sep/);
  await plot.press('End');
  assert.match(await read(), /14 Sep/);
  const outside = page.getByRole('button', { name: 'Outside chart', exact: true });
  await outside.focus();
  const box = await plot.boundingBox();
  const position = { x: 44 + (box.width - 44) / 2, y: Math.min(90, box.height - 5) };
  if (coarse) await plot.tap({ position });
  else await plot.click({ position });
  assert.match(await read(), /11 Sep/);
  assert.equal(await plot.evaluate(node => document.activeElement === node), true);
  await plot.press('ArrowLeft');
  assert.match(await read(), /10 Sep/);
  await page.waitForTimeout(300);
  const tooltipBounds = await plot.locator('[class~="z-10"]').boundingBox();
  const plotBounds = await plot.boundingBox();
  assert.ok(tooltipBounds.x >= plotBounds.x - 1 && tooltipBounds.x + tooltipBounds.width <= plotBounds.x + plotBounds.width + 1,
    'Daily values stay inside the plot after pointer and keyboard selection');
  await capture('first-pointer-and-keyboard', { audit: true });
  if (coarse) {
    for (const radio of await page.getByRole('radio').all()) {
      const bounds = await radio.boundingBox();
      assert.ok(bounds.width >= 43.5 && bounds.height >= 43.5, 'Chart range has a 44px phone target');
    }
  }
}

export async function checkKpiTargets({ page, mount, assert, capture = async () => {} }) {
  assert.equal(await page.evaluate(() => matchMedia('(pointer:coarse)').matches), true);
  await mount(`window.periodChanges=[];createRoot(document.getElementById('root')).render(<Subject.DashboardKpiCards onPeriodChange={key=>window.periodChanges.push(key)}/>);`);
  for (const radio of await page.getByRole('radio').all()) {
    const bounds = await radio.boundingBox();
    assert.ok(bounds.width >= 43.5 && bounds.height >= 43.5, 'KPI period has a 44px phone target');
  }
  await page.locator('[data-demo="period-7d"]').tap();
  assert.equal(await page.locator('[data-demo="period-7d"]').getAttribute('aria-checked'), 'true');
  assert.deepEqual(await page.evaluate(() => window.periodChanges), ['7d']);
  await capture('phone-period', { audit: true });
}
