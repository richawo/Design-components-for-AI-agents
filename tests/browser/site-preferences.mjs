import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launchChromium } from '../../scripts/lib/browser.mjs';
const base=process.env.TEST_BASE||'http://localhost:3213';
const browser=await launchChromium();
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();
page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const color='#3366cc';
const rootColor=()=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--color-site-accent').trim());
async function previewHasColor(hex) {
 console.log("Checking",page.url(),hex);
 const frame=page.frames().find(f=>f.url().includes('/preview/'));
 assert(frame,'live preview is loaded');
 await frame.waitForFunction(hex=>{ const rgb=`rgb(${[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')})`; return [...document.querySelectorAll('body *')].some(e=>{const s=getComputedStyle(e);return [s.color,s.backgroundColor,s.borderColor,s.fill,s.stroke].includes(rgb);});},hex);
}
await page.goto(base+'/components/button-press-depth');
await page.frameLocator('iframe').locator('[data-demo]').first().waitFor();
assert.equal(await rootColor(),'#ff7a45');
await page.getByRole('button',{name:'Accent colour',exact:true}).click();
await page.getByLabel('Hex colour',{exact:true}).fill(color);
await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--color-site-accent').trim()==='#3366cc');
await previewHasColor(color);
assert(!page.url().includes('c=accent'),'global accent does not become a URL override');
await page.screenshot({path:'test-results/site-performance/accent-desktop.png'});
await page.keyboard.press('Escape');
assert.equal(await page.getByRole('button',{name:'Accent colour',exact:true}).getAttribute('aria-expanded'),'false');
await page.reload();await page.frameLocator('iframe').locator('[data-demo]').first().waitFor();
assert.equal(await rootColor(),color);await previewHasColor(color);
for(const slug of ['mobile-settings','commerce-return-desk']) {
 await page.goto(base+'/components/'+slug);
 await page.frameLocator('iframe').locator('[data-demo]').first().waitFor();
 await previewHasColor(color);
}
// Shared component overrides still win, then Reset returns to the global preference.
await page.goto(base+'/components/button-press-depth#c=accent:%23abcdef');
await page.frameLocator('iframe').locator('[data-demo]').first().waitFor();await previewHasColor('#abcdef');
await page.getByRole('button',{name:'Reset controls',exact:true}).click();await previewHasColor(color);
await page.getByRole('button',{name:'Accent colour',exact:true}).click();
await page.getByRole('button',{name:'Use template defaults'}).click();
await page.waitForFunction(()=>getComputedStyle(document.documentElement).getPropertyValue('--color-site-accent').trim()==='#ff7a45');
assert.equal(await page.evaluate(()=>localStorage.getItem('dfa:accent')),null);
await page.keyboard.press('Escape');
await page.reload();await page.frameLocator('iframe').locator('[data-demo]').first().waitFor();
assert.equal(await rootColor(),'#ff7a45');
// A custom dark colour uses white foreground on filled shell controls.
await page.getByRole('button',{name:'Accent colour',exact:true}).click();await page.getByLabel('Hex colour',{exact:true}).fill('#000000');
await page.waitForFunction(()=>getComputedStyle(document.querySelector('.site-btn-accent')).color==='rgb(255, 255, 255)');
await page.keyboard.press('Escape');
await page.setViewportSize({width:390,height:844});await page.goto(base+'/components');
await page.getByRole('button',{name:'Accent colour',exact:true}).click();
await page.getByLabel('Hex colour',{exact:true}).fill('#aabbcc');
await page.screenshot({path:'test-results/site-performance/accent-mobile.png'});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile layout fits');
assert.deepEqual(errors,[]);
fs.writeFileSync('test-results/site-performance/preferences.json',JSON.stringify({ok:true,errors},null,2));
await browser.close();console.log('Accent preference, reload, override, web/mobile/Pro preview and narrow-layout checks passed.');
