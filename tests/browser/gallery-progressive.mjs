import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launchChromium } from '../../scripts/lib/browser.mjs';

const base = process.env.TEST_BASE || 'http://localhost:3222';
const out = process.env.TEST_OUT || 'test-results/site-performance';
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => requests.push(r.url()));
  await page.goto(base + '/components');
  await page.locator('.site-reveal[data-reveal]').first().waitFor({ state: 'attached' });
  const catalogue = await page.locator('script[type="application/ld+json"]').evaluateAll(nodes => nodes.map(n => JSON.parse(n.textContent)).find(data => data.mainEntity?.itemListElement)?.mainEntity.itemListElement);
  assert(catalogue?.length > 100, 'test exercises a growing catalogue');
  const cards = page.locator('.component-grid .component-card');
  const initialCount = await cards.count();
  assert(initialCount <= 24 && initialCount < catalogue.length, 'first render is bounded');
  const initialDom = await page.locator('*').count();
  const search = page.getByRole('searchbox', { name: 'Search components' });
  const last = catalogue.at(-1);
  const lastPath = new URL(last.url).pathname;
  const findLast = async () => {
    await search.fill(last.name);
    await page.waitForFunction(path => {
      const cards = document.querySelectorAll('.component-grid .component-card');
      return cards.length === 1 && cards[0].getAttribute('href') === path;
    }, lastPath);
  };
  await findLast();
  await search.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.component-grid .component-card').length === 12);

  // Keyboard / assistive navigation can request a batch without scrolling first.
  const expectedNext = new URL(catalogue[12].url).pathname;
  await page.getByRole('button', { name: 'Load more components', exact: true }).evaluate(node => node.focus({ preventScroll: true }));
  await page.keyboard.press('Enter');
  await page.waitForFunction(path => document.activeElement?.getAttribute('href') === path, expectedNext);
  const keyboardCount = await cards.count();
  assert(keyboardCount >= 24);

  // Scrolling fills in every remaining card, in order, without duplicates.
  for (let pass = 0; pass < Math.ceil(catalogue.length / 12) + 2; pass++) {
    const before = await cards.count();
    if (before === catalogue.length) break;
    await cards.last().scrollIntoViewIfNeeded();
    await page.waitForFunction(before => document.querySelectorAll('.component-grid .component-card').length > before, before);
  }
  const hrefs = await cards.evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
  assert.deepEqual(hrefs, catalogue.map(item => new URL(item.url).pathname));
  assert.equal(new Set(hrefs).size, catalogue.length);
  assert.equal(await page.getByRole('button', { name: 'Load more components', exact: true }).count(), 0);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await findLast();
  await search.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.component-grid .component-card').length === 12);
  assert.equal(requests.filter(url => /\/api\/(?:pro\/)?source\/|\/preview\//.test(url)).length, 0, 'gallery does not fetch source or mount live demos');
  await page.screenshot({ path: out + '/gallery-progressive-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/components');
  await page.locator('.site-reveal[data-reveal]').first().waitFor({ state: 'attached' });
  assert.equal(await cards.count(), 12);
  await cards.last().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelectorAll('.component-grid .component-card').length >= 24);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile grid fits');
  await page.screenshot({ path: out + '/gallery-progressive-mobile.png' });
  assert.deepEqual(errors, []);
  fs.writeFileSync(out + '/gallery-progressive.json', JSON.stringify({ ok: true, total: catalogue.length, initialCount, initialDom, keyboardCount, errors }, null, 2));
  console.log(JSON.stringify({ total: catalogue.length, initialCount, initialDom, keyboardCount, completeCatalogueAccessible: true, errors }));
} finally { await browser.close(); }
