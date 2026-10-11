import fs from 'node:fs';
import { launchChromium } from '../../scripts/lib/browser.mjs';
const base = process.env.PERF_BASE || 'http://localhost:3210';
const out = process.env.PERF_OUT || 'test-results/site-performance/before.json';
const negative = process.env.PERF_NEGATIVE === '1';
const browser = await launchChromium();
const reports = [];
for (const route of ['/components', '/components/chart-portfolio', '/components/three-globe-arcs']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 1250000, uploadThroughput: 625000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const errors = [], requests = new Map();
  page.on('pageerror', e => errors.push(e.message));
  cdp.on('Network.requestWillBeSent', e => requests.set(e.requestId, { url: e.request.url.replace(base, ''), type: e.type, bytes: 0 }));
  cdp.on('Network.loadingFinished', e => { const r = requests.get(e.requestId); if (r) r.bytes += e.encodedDataLength; });
  await page.addInitScript(({negative}) => {
    window.__perf = { longTasks: [], inputs: [], lcp: 0 };
    new PerformanceObserver(list => window.__perf.longTasks.push(...list.getEntries().map(e => ({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
    new PerformanceObserver(list => {window.__perf.lcp=list.getEntries().at(-1).startTime;}).observe({type:'largest-contentful-paint',buffered:true});
    addEventListener('input', e => {
      if(e.target.id !== 'component-search') return;
      const start = performance.now(), value = e.target.value;
      if(negative) { const end = start + 250; while(performance.now() < end) {} }
      requestAnimationFrame(() => {const first=performance.now()-start;requestAnimationFrame(()=>window.__perf.inputs.push({value,first,second:performance.now()-start}));});
    },true);
  }, {negative});
  await page.goto(base + route, {waitUntil:'load',timeout:60000});
  await page.waitForTimeout(3500);
  const startup = await page.evaluate(()=>({ ...window.__perf, navigation:performance.getEntriesByType('navigation')[0].toJSON(), dom:document.querySelectorAll('*').length, resources:performance.getEntriesByType('resource').map(r=>({name:r.name,decoded:r.decodedBodySize})) }));
  const startupRequests = [...requests.values()];
  if (route === '/components') {
    const search=page.getByRole('searchbox',{name:'Search components'});
    await search.focus();
    await search.pressSequentially('chart',{delay:160});
    await page.waitForTimeout(1000);
    await search.press('Escape');
    await page.waitForTimeout(1000);
    await search.pressSequentially('pricing',{delay:160});
    await page.waitForTimeout(1000);
    await search.press('Escape');
    await page.waitForTimeout(1000);
  }
  const final = await page.evaluate(()=>window.__perf);
  const values = final.inputs.map(i=>i.second).sort((a,b)=>a-b);
  reports.push({route, errors, startup, startupRequests, ...final, observed: {
    inputToFrameMax:Math.max(0,...final.inputs.map(i=>i.first)), secondFrameMax:Math.max(0,...values), secondFrameP95:values[Math.floor(values.length*.95)]||0,
    longTaskMax:Math.max(0,...final.longTasks.map(i=>i.duration)), lcp:startup.lcp, dom:startup.dom,
    transferredBytes:startupRequests.reduce((s,r)=>s+r.bytes,0), prefetchBytes:startupRequests.filter(r=>r.url.includes('_rsc=')).reduce((s,r)=>s+r.bytes,0),
    decodedJsBytes:startup.resources.filter(r=>r.name.includes('.js')).reduce((s,r)=>s+r.decoded,0)
  }});
  await page.screenshot({path:out.replace('.json',`-${route.split('/').pop()}.png`)});
  await context.close();
}
await browser.close();
const gallery=reports[0].observed;
const result={summary:{ok:!reports.some(r=>r.errors.length)&&gallery.secondFrameMax<200,observed:gallery},reports};
fs.mkdirSync(new URL('.',`file://${process.cwd()}/${out}`).pathname,{recursive:true});
fs.writeFileSync(out,JSON.stringify(result,null,2));
console.log(JSON.stringify(reports.map(({route,observed,errors})=>({route,observed,errors})),null,2));
