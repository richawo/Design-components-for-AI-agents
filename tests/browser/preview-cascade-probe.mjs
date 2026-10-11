import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium} from '../../scripts/lib/browser.mjs';
if(fs.existsSync('registry/pro/fashion-launch-calendar')){
 const browser=await launchChromium();const base=process.env.PREVIEW_BASE||'http://localhost:3100';
 try{for(const reducedMotion of ['reduce','no-preference']){
  const page=await browser.newPage({viewport:{width:1440,height:980},reducedMotion});
  await page.goto(base+'/preview/fashion-launch-calendar',{waitUntil:'networkidle'});
  assert.match(await page.locator("h2").evaluate(e=>getComputedStyle(e).fontFamily),/Instrument Serif/,"Preview font tokens must be emitted even when absent from the shell");
  const day=page.locator('[data-demo="day-20"]');assert.equal(await day.isVisible(),true,'Desktop calendar must survive shell CSS ordering');
  await day.click();assert.match(await page.locator('section').innerText(),/Wholesale appointments/);
  await page.setViewportSize({width:390,height:900});assert.equal(await day.isVisible(),false);
  assert.equal(await page.getByRole('button',{name:/^20 October 2026 ·/}).isVisible(),true);
  await page.close();
 }}finally{await browser.close()}
 console.log('PASS preview cascade in desktop, mobile and both motion modes');
}else console.log('SKIP preview cascade: private calendar unavailable');
