export async function check({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  const collection = [{ id: 'stock', name: 'Stock review', season: 'Autumn', week: 5, seasonWeeks: 10, styles: [
    { id: 'cover', name: 'Cotton tee', category: 'Jersey', revenueMinor: 80000, sizes: [{ size: 'M', received: 100, sold: 80 }], weekly: [15, 15, 15, 15, 20] },
  ] }];
  try {
    await page.setViewportSize({ width: 1440, height: 1400 });
    for (const theme of ['dark', 'light']) {
      await mount(`createRoot(document.getElementById('root')).render(<div style={{width:1200}}><Subject.MerchandisingDashboard collections={${JSON.stringify(collection)}} theme="${theme}"/></div>);`);
      const row = page.locator('[data-demo="style-cover"]').locator('xpath=ancestor::tr');
      const suffix = row.getByText('wk', { exact: true });
      await suffix.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => {
        const row = document.querySelector('[data-demo="style-cover"]')?.closest('tr');
        if (!row) return false;
        for (let node = row; node; node = node.parentElement) if (Number(getComputedStyle(node).opacity) < .9999) return false;
        return true;
      });
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const contrast = () => page.evaluate(async () => (await axe.run(document.body, {
        runOnly: { type: 'rule', values: ['color-contrast'] },
      })).violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })));
      assert.deepEqual(await contrast(), [], `${theme} stock-cover metadata meets AA`);
      await capture(theme + '-cover', { audit: true });
      await row.hover();
      await page.waitForTimeout(200);
      assert.equal(await row.evaluate(node => node.matches(':hover')), true);
      assert.deepEqual(await contrast(), [], `${theme} stock-cover metadata meets AA on hover`);
      await capture(theme + '-cover-hover', { audit: true });
    }
  } finally {
    if (viewport) await page.setViewportSize(viewport);
  }
}
