import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchChromium} from '../../scripts/lib/browser.mjs';
import {mountFixture} from '../../scripts/lib/component-fixture.mjs';
export async function run(group){
 const requested=new Set(process.argv.slice(2));
 const cases=fs.readdirSync('tests/browser/pro-50').filter(f=>f.startsWith(group+'-')&&f.endsWith('.mjs')).map(f=>f.slice(0,-4)).filter(s=>!requested.size||requested.has(s));
 assert.ok(cases.length,'No cases selected for '+group);
 const browser=await launchChromium();const page=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{for(const slug of cases){const mount=code=>mountFixture(page,slug,'pro',code);const {check}=await import('./pro-50/'+slug+'.mjs');const choose=async (locator,value)=>{
  if(await locator.evaluate(el=>el.tagName==='SELECT'))return locator.selectOption(value);
  await locator.click();const id=await locator.getAttribute('aria-controls');
  const options=page.locator(`[id=${JSON.stringify(id)}] [role=option]`);
  const index=await options.evaluateAll((nodes,value)=>nodes.findIndex(node=>(typeof value === "object" && value.label ? node.textContent.trim()===value.label : node.dataset.value===String(value))),value);
  assert.ok(index>=0,'Select option exists: '+value);await options.nth(index).click();
 };await check({page,mount,assert,choose});assert.deepEqual(errors,[],slug);console.log('PASS '+slug);}}finally{await browser.close();}
}
