import fs from 'node:fs';

export async function check({ page, mount, assert, capture = async () => {} }) {
  const viewport = page.viewportSize();
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const meta = JSON.parse(fs.readFileSync('registry/pro/fashion-merchandising-dashboard/meta.json', 'utf8'));
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const height of new Set([900, meta.previewHeight])) {
      await page.setViewportSize({ width: 1440, height });
      for (const theme of ['dark', 'light']) {
        await mount(`
          import { DemoPlayer } from './lib/demo/player';
          import { parseSteps } from './lib/demo/schema.mjs';
          import { gallerySteps } from './scripts/lib/recording-quality.mjs';
          Object.assign(document.getElementById('root').style, {padding:'0',maxWidth:'none',width:'100%'});
          createRoot(document.getElementById('root')).render(<Subject.default theme="${theme}"/>);
          window.runMerchandisingDemo = () => new DemoPlayer(window, {
            move(){}, show(){}, press(){}, pulse(){}
          }, new AbortController().signal).play(gallerySteps(parseSteps(${JSON.stringify(meta.demo.steps)})));
        `);
        assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), false);
        await page.waitForTimeout(2500);
        await capture(theme + '-' + height + '-gallery-opening');
        await page.evaluate(() => window.runMerchandisingDemo());
        await capture(theme + '-' + height + '-gallery-ending');
        const curve = page.getByRole('group', {
          name: 'Sell-through by week for Merino roll neck, Ink. Use the arrow keys to read each week.', exact: true,
        });
        assert.equal(await curve.count(), 1, `${theme} gallery script selects the visible style summary`);
        const chart = await curve.boundingBox();
        const footer = await page.locator('.fmd-root footer').boundingBox();
        assert.ok(chart && footer && chart.y >= 0 && chart.y + chart.height <= footer.y,
          `${theme} selected chart stays above the sticky receipt at ${height}px`);
        assert.ok(footer.y >= 0 && footer.y + footer.height <= height + 1,
          `${theme} complete receipt stays in the ${height}px scene`);
        assert.equal(await page.getByRole('status').filter({ hasText: 'Sent to pricing review' }).count(), 1);
        assert.match(await page.locator('.fmd-root footer').innerText(), /3 styles · £41,400\.00 of stock at full price/);
        assert.equal(await page.evaluate(() => scrollY), 0, `${theme} complete gallery action stays in its measured scene`);
      }
    }
  } finally {
    if (viewport) await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  }
}
