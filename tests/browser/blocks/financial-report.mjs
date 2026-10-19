import { check as checkExports } from '../review/financial-report-exports.mjs';
import { check as checkPrecision } from '../review/financial-report-precision.mjs';
export async function check({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  const review = label => capture(label, { audit: true });
  const choose = async label => {
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: label, exact: true }).click();
  };
  const data = [{id:'first',label:'First period',revenueMinor:150000,revenueBudgetMinor:140000,lines:[{id:'people',label:'People',actualMinor:50000,budgetMinor:60000}],commentary:['First period review.']},{id:'second',label:'Second period',revenueMinor:120000,revenueBudgetMinor:140000,lines:[{id:'people',label:'People',actualMinor:55000,budgetMinor:60000}],commentary:['Second period review.']}];
  try {
    await page.setViewportSize({ width: 1440, height: 940 });
    await mount(`window.printCalls=0;window.print=()=>window.printCalls++;createRoot(document.getElementById('root')).render(<Subject.FinancialReport/>);`);
    const picker = page.getByRole('combobox');
    await picker.focus(); await picker.press('Enter'); await picker.press('ArrowDown'); await picker.press('Enter');
    await page.getByText('Financial review / September 2026', { exact: true }).waitFor();
    assert.equal(await picker.evaluate(node => node === document.activeElement), true);
    for (const amount of ['£78,000.00', '£43,400.00', '£34,600.00']) assert.equal(await page.getByText(amount, { exact: true }).first().isVisible(), true);
    await review('september-summary');
    await page.getByRole('link', { name: 'Review cost detail', exact: true }).press('Enter');
    const grid = page.getByRole('grid', { name: /Cost detail/ });
    await grid.waitFor();
    const software = grid.getByRole('row').filter({ has: page.getByText('Software and infrastructure', { exact: true }) });
    await software.getByRole('gridcell').nth(2).getByText('£8,700.00', { exact: true }).last().waitFor();
    assert.equal(await software.getByRole('gridcell').nth(2).locator('span[aria-hidden="true"]').innerText(), '£8,700.00');
    assert.equal(await software.getByRole('gridcell').last().locator('span[aria-hidden="true"]').innerText(), '-£300.00');
    await review('september-detail');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    assert.equal((await download).suggestedFilename(), 'report-sep.csv');
    await page.getByRole('button', { name: 'Print report', exact: true }).click();
    assert.equal(await page.evaluate(() => window.printCalls), 1);
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), 'Northstar / September 2026');
    assert.equal(await page.getByRole('table').getByRole('row').count(), 4);
    await review('september-print');
    await page.emulateMedia({ media: 'screen' });

    await mount(`function Host(){const[periods,setPeriods]=React.useState([]);window.provideReports=()=>setPeriods(${JSON.stringify(data)});return <Subject.FinancialReport periods={periods}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
    assert.equal(await page.getByText('No reports yet.', { exact: true }).isVisible(), true);
    assert.equal(await page.getByText('No reports', { exact: true }).isVisible(), true);
    assert.equal(await page.getByRole('combobox').isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Export CSV', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Print report', exact: true }).isDisabled(), true);
    await review('empty-reports');
    await page.evaluate(() => window.provideReports());
    await page.getByText('Financial review / First period', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Export CSV', exact: true }).isDisabled(), false);
    await choose('Second period');
    await page.getByText('Financial review / Second period', { exact: true }).waitFor();
    await review('arriving-reports');

    await mount(`createRoot(document.getElementById('root')).render(<Subject.FinancialReport periods={[{id:'quiet',label:'Quiet month',revenueMinor:0,revenueBudgetMinor:0,lines:[],commentary:[]}]}/>);`);
    await page.getByRole('link', { name: 'Review cost detail', exact: true }).click();
    assert.equal(await page.getByText('No cost lines yet.', { exact: true }).isVisible(), true);
    assert.equal(await page.getByText('No commentary for this period.', { exact: true }).isVisible(), true);
    await review('empty-costs');

    await page.setViewportSize({ width: 390, height: 940 });
    await mount(`createRoot(document.getElementById('root')).render(<Subject.default brand="Northstar Group Financial Services" periods={${JSON.stringify(data)}}/>);`);
    await choose('Second period');
    await review('phone-summary');
    await page.getByRole('link', { name: 'Review cost detail', exact: true }).click();
    assert.equal(await page.getByRole('grid').getByText('Budget', { exact: true }).last().isVisible(), true);
    assert.equal(await page.getByRole('grid').getByText('Actual', { exact: true }).last().isVisible(), true);
    await review('phone-detail');

    await page.setViewportSize({ width: 1440, height: 1800 });
    await mount(`window.instanceExports=[];createRoot(document.getElementById('root')).render(<><Subject.FinancialReport brand="Studio A" periods={${JSON.stringify(data)}} onExport={report=>window.instanceExports.push(['A',report.id])}/><Subject.FinancialReport brand="Studio B" periods={${JSON.stringify(data)}} onExport={report=>window.instanceExports.push(['B',report.id])}/></>);`);
    const instances = page.locator('[data-financial-report]');
    const second = instances.nth(1);
    await second.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Second period', exact: true }).click();
    await second.getByText('Financial review / Second period', { exact: true }).waitFor();
    assert.equal(await instances.first().getByText('Financial review / First period', { exact: true }).isVisible(), true);
    const anchors = await page.getByRole('link', { name: 'Review cost detail', exact: true }).evaluateAll(nodes => nodes.map(node => node.hash));
    assert.equal(new Set(anchors).size, 2, 'Each report targets its own detail region');
    await second.getByRole('button', { name: 'Export CSV', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => window.instanceExports), [['B', 'second']]);
    await review('independent-reports');

    await page.setViewportSize({ width: 1440, height: 940 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await mount(`createRoot(document.getElementById('root')).render(<Subject.FinancialReport/>);`);
    await choose('September 2026');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByText('Financial review / September 2026', { exact: true }).waitFor();
    await page.waitForFunction(() => document.getAnimations().filter(animation => animation.playState === 'running').length === 0);
    await review('live-reduced-motion');

    await checkExports({ page, mount, assert, capture: review });
    await checkPrecision({ page, mount, assert, capture: review });
  } finally {
    await page.emulateMedia({ media: 'screen', reducedMotion: 'reduce' });
    if (viewport) await page.setViewportSize(viewport);
  }
}
