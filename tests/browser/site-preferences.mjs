import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launchChromium } from '../../scripts/lib/browser.mjs';

const base = process.env.TEST_BASE || 'http://localhost:3220';
const out = process.env.TEST_OUT || 'test-results/site-performance';
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const color = '#3366cc';
const picker = () => page.getByRole('button', { name: 'Component accent', exact: true });
const rootColor = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-site-accent').trim());
const shellPalette = () => page.evaluate(() => {
  const colours = selector => [...document.querySelectorAll(selector)].map(node => {
    const s = getComputedStyle(node);
    return [s.color, s.backgroundColor, s.fill];
  });
  return {
    logo: colours('header svg rect, header svg circle, header svg path'),
    proButton: colours('header .site-btn-accent'),
    proBadges: colours('main span.text-site-accent-readable'),
    navigation: colours('header nav .bg-site-accent'),
  };
});
async function loadPreview(slug, hash = '') {
  await page.goto(base + '/components/' + slug + hash);
  await page.frameLocator('iframe').locator('[data-demo]').first().waitFor();
  assert.equal(await page.locator('header [data-accent-picker]').count(), 0, 'colour control is not in the site header');
}
async function previewHasColor(hex) {
  console.log('Checking', page.url(), hex);
  const frame = page.frames().find(f => f.url().includes('/preview/'));
  assert(frame, 'live preview is loaded');
  await frame.waitForFunction(hex => {
    const rgb = 'rgb(' + [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ') + ')';
    return [...document.querySelectorAll('body *')].some(e => {
      const s = getComputedStyle(e);
      return [s.color, s.backgroundColor, s.borderColor, s.fill, s.stroke].includes(rgb);
    });
  }, hex);
}
async function choose(hex) {
  await picker().click();
  await page.getByLabel('Hex colour', { exact: true }).fill(hex);
  await page.waitForFunction(hex => localStorage.getItem('dfa:accent') === hex, hex);
  assert.equal(await rootColor(), '#ff7a45', 'site accent is independent of the component preference');
}
async function closePicker() {
  await page.keyboard.press('Escape');
  assert.equal(await picker().getAttribute('aria-expanded'), 'false');
}
try {
  await loadPreview('button-press-depth');
  await previewHasColor('#f4f4f5');
  const initialShell = await shellPalette();
  await choose(color);
  await previewHasColor(color);
  assert.deepEqual(await shellPalette(), initialShell, 'branding, navigation and Pro badges do not change');
  assert(!page.url().includes('c=accent'), 'shared accent does not become a URL override');
  await page.screenshot({ path: out + '/accent-desktop.png' });
  await closePicker();
  await page.reload();
  await page.frameLocator('iframe').locator('[data-demo]').first().waitFor();
  assert.equal(await rootColor(), '#ff7a45');
  assert.deepEqual(await shellPalette(), initialShell, 'persisted preference does not change the shell');
  await previewHasColor(color);

  for (const slug of ['mobile-settings', 'commerce-return-desk']) {
    await loadPreview(slug);
    await previewHasColor(color);
    if (slug === 'commerce-return-desk') {
      const proShell = await shellPalette();
      assert(proShell.proBadges.length > 0, 'Pro badge is covered');
      await choose('#000000');
      await previewHasColor('#000000');
      assert.deepEqual(await shellPalette(), proShell, 'even a black component accent leaves Pro styling unchanged');
      await closePicker();
      await choose(color);
      await closePicker();
    }
  }

  // A shared component link wins; Reset controls restores the shared preview colour.
  await loadPreview('button-press-depth', '#c=accent:%23abcdef');
  await previewHasColor('#abcdef');
  await page.getByRole('button', { name: 'Reset controls', exact: true }).click();
  await previewHasColor(color);
  await picker().click();
  await page.getByRole('button', { name: 'Use template defaults' }).click();
  await previewHasColor('#f4f4f5');
  assert.equal(await page.evaluate(() => localStorage.getItem('dfa:accent')), null);
  await closePicker();
  await page.reload();
  await page.frameLocator('iframe').locator('[data-demo]').first().waitFor();
  await previewHasColor('#f4f4f5');

  // Retain an existing visitor's preference, but leave gallery branding fixed.
  await choose(color);
  await closePicker();
  await page.goto(base + '/components');
  assert.equal(await picker().count(), 0, 'gallery has no accent setting');
  assert.equal(await rootColor(), '#ff7a45');
  const galleryShell = await shellPalette();
  assert(galleryShell.proBadges.length > 0);
  for (const [text] of galleryShell.proBadges) assert.equal(text, 'rgb(255, 122, 69)');

  await page.setViewportSize({ width: 390, height: 844 });
  await loadPreview('button-press-depth');
  await choose('#aabbcc');
  await previewHasColor('#aabbcc');
  const region = page.getByRole('region', { name: 'Component accent settings' });
  await region.scrollIntoViewIfNeeded();
  const box = await region.boundingBox();
  assert(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, 'mobile picker is fully visible');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile layout fits');
  await page.screenshot({ path: out + '/accent-mobile.png' });
  await closePicker();
  assert.deepEqual(errors, []);
  fs.writeFileSync(out + '/preferences.json', JSON.stringify({ ok: true, scope: 'live previews only', errors }, null, 2));
  console.log('Preview-only colour, unchanged branding/Pro badges, persistence, defaults, overrides and mobile layout passed.');
} finally {
  await browser.close();
}
