import fs from 'node:fs';
import { launchChromium } from '../../scripts/lib/browser.mjs';
const base=process.env.PERF_BASE||'http://localhost:3211';
const out=process.env.PERF_OUT||'test-results/site-performance/navigation-before.json';
const negative = process.env.PERF_NEGATIVE === "1";
const browser=await launchChromium();
const context=await browser.newContext({viewport:{width:1440,height:900}});
const page=await context.newPage();
page.setDefaultTimeout(30000);
const cdp=await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:625000,uploadThroughput:312500});
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(({ negative })=>{
  window.__navigationPerf={clicks:[],longTasks:[]};
  new PerformanceObserver(list=>window.__navigationPerf.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  addEventListener('click',e=>{
    const target=e.target.closest('a,button');if(!target)return;
    const start=performance.now(), label=target.textContent?.trim();
    if (negative) { const until = performance.now() + 250; while (performance.now() < until) {} }
    const sample={label,start};window.__navigationPerf.clicks.push(sample);
    requestAnimationFrame(()=>{sample.first=performance.now()-start;requestAnimationFrame(()=>{sample.second=performance.now()-start;});});
  },true);
}, { negative });
const observed=[];
for(const slug of ['chart-portfolio','command-palette','data-table-sortable']) {
  await page.goto(base+'/components?q='+slug.replaceAll('-',' '),{waitUntil:'load'});
  await page.waitForTimeout(1500);
  const link=page.locator(`main a[href='/components/${slug}']`).first();
  // Direct destination link injected only for measurement to avoid a filter mismatch.
  if(!await link.count()) await page.evaluate(slug=>{const a=document.createElement('a');a.id='perf-link';a.href='/components/'+slug;a.textContent='Open';document.querySelector('main').prepend(a);},slug);
  const target=await link.count()?link:page.locator('#perf-link');
  const start=Date.now();await target.click();
  await page.waitForURL('**/components/'+slug);
  await page.locator('iframe').waitFor();
  const shellMs=Date.now()-start;
  await page.frameLocator('iframe').locator('[data-demo]').first().waitFor({timeout:30000});
  const previewMs=Date.now()-start;
  await page.waitForTimeout(1000);
  const tabs=[];
  for(const label of ['Prompt','JSON prompt','Code','Install']) {
    const t=page.getByRole('tab',{name:label,exact:true});const t0=Date.now();await t.click();
    await page.getByRole('tabpanel').filter({visible:true}).waitFor();
    tabs.push({label,elapsedMs:Date.now()-t0});
    await page.waitForTimeout(250);
  }
  observed.push({slug,shellMs,previewMs,tabs,report:await page.evaluate(()=>window.__navigationPerf)});
}
const tabClicks=observed.flatMap(p=>p.report.clicks).filter(c=>['Prompt','JSON prompt','Code','Install'].includes(c.label));
const metrics={inputToPaintMax:Math.max(...tabClicks.map(c=>c.first)),inputToSecondFrameMax:Math.max(...tabClicks.map(c=>c.second)),longTaskMax:Math.max(...observed.flatMap(p=>p.report.longTasks.map(t=>t.duration)))};
const summary={ok:errors.length===0&&metrics.inputToSecondFrameMax<200,observed:metrics};
fs.mkdirSync(new URL('.',`file://${process.cwd()}/${out}`).pathname,{recursive:true});
fs.writeFileSync(out,JSON.stringify({summary,observed,errors},null,2));
console.log(JSON.stringify({observed:observed.map(({report,...r})=>({...r,clickFrames:report.clicks.map(c=>({label:c.label?.slice(0,40),first:c.first,second:c.second})),longTaskMax:Math.max(0,...report.longTasks.map(t=>t.duration))})),errors},null,2));
await browser.close();
