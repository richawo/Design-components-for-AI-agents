export async function check({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 940 });
      await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
      const indices = await page.getByRole('group', { name: 'Filter by phase', exact: true }).locator('button > span:first-child > span:first-child').evaluateAll(nodes => nodes.map(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        return { text: node.textContent, lines: new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size };
      }));
      assert.deepEqual(indices.map(index => index.text), ['01', '02', '03', '04', '05']);
      assert.ok(indices.every(index => index.lines === 1), `Each two-digit phase index stays together at ${width}px`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await capture('phase-labels-' + width, { audit: true });
    }
  } finally {
    if (viewport) await page.setViewportSize(viewport);
  }
}
