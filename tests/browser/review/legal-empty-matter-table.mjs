export async function check({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  try {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 940 });
      await mount(`createRoot(document.getElementById('root')).render(<Subject.LegalWorkspace brand="Lex Spring Commercial and Property" scopes={[{id:'NEW',label:'A new service agreement',matters:[],obligations:[],requests:[]}]}/>);`);
      const table = page.getByRole('table', { name: 'Matters', exact: true });
      const empty = table.getByRole('row').filter({ hasText: 'No matters yet.' });
      assert.equal(await empty.getByRole('cell').getAttribute('aria-colspan'), '5');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await empty.scrollIntoViewIfNeeded();
      await capture('empty-matter-table-' + width, { audit: true });
    }
    await page.setViewportSize({ width: 320, height: 940 });
    await mount(`createRoot(document.getElementById('root')).render(<Subject.LegalWorkspace/>);`);
    await page.getByRole('searchbox', { name: 'Find a matter', exact: true }).fill('No matching client');
    const filtered = page.getByRole('table', { name: 'Matters', exact: true }).getByRole('row').filter({ hasText: 'No matters match.' });
    await filtered.waitFor();
    assert.equal(await filtered.getByRole('cell').getAttribute('aria-colspan'), '5');
    await filtered.scrollIntoViewIfNeeded();
    await capture('filtered-matter-table-320', { audit: true });
  } finally {
    if (viewport) await page.setViewportSize(viewport);
  }
}
