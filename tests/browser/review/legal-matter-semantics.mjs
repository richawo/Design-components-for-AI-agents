export async function check({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  try {
    await page.setViewportSize({ width: 1440, height: 940 });
    await mount(`createRoot(document.getElementById('root')).render(<Subject.LegalWorkspace/>);`);
    const table = page.getByRole('table', { name: 'Matters', exact: true });
    const disclosure = table.locator('[data-demo="matter-mat-204"]');
    const row = disclosure.locator('xpath=ancestor::*[@role="row"][1]');
    assert.equal(await row.getByRole('cell').count(), 5, 'The five data cells belong to the table row, outside the disclosure button');
    assert.equal(await disclosure.getByRole('cell').count(), 0);
    assert.match(await row.innerText(), /Northline supply agreement.*Northline Studio/s);
    await capture('matter-table-closed', { audit: true });
    await disclosure.focus(); await disclosure.press('Enter');
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'true');
    const detail = page.locator(`[id=${JSON.stringify(await disclosure.getAttribute('aria-controls'))}]`);
    await detail.getByText('Review the revised service schedule with the commercial owner.', { exact: true }).waitFor();
    assert.equal(await detail.getAttribute('role'), 'row');
    assert.equal(await detail.getByRole('cell').getAttribute('aria-colspan'), '5');
    await capture('matter-table-expanded', { audit: true });
    await disclosure.press('Space');
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'false');
    const before = await disclosure.boundingBox();
    await page.mouse.click(before.x + before.width - 12, before.y + before.height / 2);
    assert.equal(await disclosure.getAttribute('aria-expanded'), 'true', 'The full row remains clickable outside the matter-name cell');
    assert.equal(await disclosure.evaluate(node => node === document.activeElement), true);
  } finally {
    if (viewport) await page.setViewportSize(viewport);
  }
}
