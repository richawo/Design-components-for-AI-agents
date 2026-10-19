import fs from 'node:fs';
export async function check({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  const max = Number.MAX_SAFE_INTEGER;
  const largeActual = max - 100, largeBudget = max - 99;
  const boundary = { id: 'boundary', label: 'Safe integer boundary', revenueMinor: max, revenueBudgetMinor: max,
    lines: [{ id: 'large', label: 'Large line', actualMinor: largeActual, budgetMinor: largeBudget },
      { id: 'small', label: 'Small line', actualMinor: 100, budgetMinor: 99 }], commentary: [] };
  const visual = cell => cell.locator('span[aria-hidden="true"]').innerText();
  try {
    await page.setViewportSize({ width: 1440, height: 2100 });
    await mount(`createRoot(document.getElementById('root')).render(<Subject.FinancialReport periods={[${JSON.stringify(boundary)}]}/>);`);
    assert.equal(await page.getByText('£90,071,992,547,409.91', { exact: true }).first().isVisible(), true);
    await page.getByRole('link', { name: 'Review cost detail', exact: true }).click();
    const grid = page.getByRole('grid', { name: /Cost detail/ });
    await grid.getByText('£90,071,992,547,408.92', { exact: true }).last().waitFor();
    const row = grid.getByRole('row').filter({ has: page.getByText('Large line', { exact: true }) });
    assert.equal(await visual(row.getByRole('gridcell').nth(1)), '£90,071,992,547,408.92');
    assert.equal(await visual(row.getByRole('gridcell').nth(2)), '£90,071,992,547,408.91');
    assert.equal(await visual(row.getByRole('gridcell').nth(3)), '-£0.01');
    assert.equal(await row.getByRole('gridcell').nth(2).locator('.sr-only').innerText(), '£90,071,992,547,408.91');
    const chart = page.getByRole('heading', { name: 'Where the spend sits', exact: true }).locator('xpath=ancestor::section[1]');
    const large = chart.locator('[data-demo="row-0"]');
    assert.match(await large.getAttribute('aria-label'), /£90,071,992,547,408\.91/);
    await large.focus();
    await chart.getByText('£90,071,992,547,408.91', { exact: true }).waitFor();
    await chart.locator('[data-demo="row-1"]').focus();
    await chart.getByText('£1.00', { exact: true }).waitFor();
    await capture('exact-boundary-screen');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    const csv = await download;
    assert.equal(csv.suggestedFilename(), 'report-boundary.csv');
    assert.equal(fs.readFileSync(await csv.path(), 'utf8'), 'line,budget_minor,actual_minor,currency\r\n"Large line",9007199254740892,9007199254740891,GBP\r\n"Small line",99,100,GBP');
    await page.emulateMedia({ media: 'print' });
    const printRow = page.getByRole('table').getByRole('row').filter({ has: page.getByText('Large line', { exact: true }) });
    assert.deepEqual(await printRow.getByRole('cell').allTextContents(), ['Large line', '£90,071,992,547,408.92', '£90,071,992,547,408.91', '-£0.01']);
    assert.equal(await page.getByText('Revenue: £90,071,992,547,409.91', { exact: true }).isVisible(), true);
    await capture('exact-boundary-print');
    await page.emulateMedia({ media: 'screen' });
    const penny = { ...boundary, id: 'penny', label: 'One penny balance', lines: [{ id: 'cost', label: 'Operating costs', actualMinor: max - 1, budgetMinor: max }] };
    await mount(`createRoot(document.getElementById('root')).render(<Subject.FinancialReport periods={[${JSON.stringify(penny)}]}/>);`);
    assert.equal(await page.getByText('£0.01', { exact: true }).first().isVisible(), true);
    await page.getByRole('link', { name: 'Review cost detail', exact: true }).click();
    const pennyRow = page.getByRole('grid').getByRole('row').filter({ has: page.getByText('Operating costs', { exact: true }) });
    await pennyRow.getByText('-£0.01', { exact: true }).last().waitFor();
    assert.equal(await visual(pennyRow.getByRole('gridcell').last()), '-£0.01');
    await capture('one-penny-balance');
    for (const currency of ['JPY', 'BHD']) {
      await mount(`createRoot(document.getElementById('root')).render(<Subject.FinancialReport periods={[${JSON.stringify(boundary)}]} currency="${currency}"/>);`);
      assert.equal(await page.getByRole('alert').isVisible(), true);
      assert.equal(await page.getByRole('button', { name: 'Export CSV', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Print report', exact: true }).isDisabled(), true);
    }
    const overflow = { ...boundary, lines: [{ id: 'a', label: 'First', actualMinor: max, budgetMinor: 0 }, { id: 'b', label: 'Second', actualMinor: 1, budgetMinor: 0 }] };
    await mount(`createRoot(document.getElementById('root')).render(<Subject.FinancialReport periods={[${JSON.stringify(overflow)}]}/>);`);
    assert.equal(await page.getByRole('alert').isVisible(), true);
    assert.equal(await page.getByRole('button', { name: 'Export CSV', exact: true }).isDisabled(), true);
  } finally {
    await page.emulateMedia({ media: 'screen' });
    if (viewport) await page.setViewportSize(viewport);
  }
}
