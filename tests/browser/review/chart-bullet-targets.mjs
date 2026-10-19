export async function check({page,mount,assert,capture=async()=>{}}) {
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.BulletTargets onPeriodChange={id=>window.changes.push(id)}/>);`);
  const september=page.getByRole('button',{name:'September',exact:true});await september.focus();await september.press('Space');
  assert.equal(await september.getAttribute('aria-pressed'),'true');
  assert.equal(await page.getByRole('img',{name:'Docs published: 51 docs, target 50, scale 0 to 70',exact:true}).count(),1);
  const october=page.getByRole('button',{name:'October',exact:true});await october.focus();await october.press('Enter');
  assert.deepEqual(await page.evaluate(()=>window.changes),['sep','oct']);
  assert.equal(await page.getByRole('img',{name:'Docs published: 42 docs, target 50, scale 0 to 70',exact:true}).count(),1);
  assert.equal(await page.locator('button[aria-pressed=true]').count(),1);
  await capture('october-targets',{audit:true});

  await mount(`createRoot(document.getElementById('root')).render(<Subject.BulletTargets periods={[]} defaultPeriod="missing"/>);`);
  assert.equal(await page.getByRole('button').count(),0);assert.equal(await page.getByRole('img').count(),0);
  assert.equal(await page.getByText('No targets in this period.',{exact:true}).isVisible(),true);
  await capture('empty-periods',{audit:true});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.BulletTargets periods={[{id:'empty',label:'Next month',metrics:[]}]} defaultPeriod="missing"/>);`);
  assert.equal(await page.getByRole('button',{name:'Next month',exact:true}).getAttribute('aria-pressed'),'true');
  await capture('empty-metrics',{audit:true});

  await mount(`createRoot(document.getElementById('root')).render(<Subject.BulletTargets periods={[{id:'one',label:'Current',metrics:[{id:'bad',label:'Unavailable',actual:Number.NaN,target:Number.POSITIVE_INFINITY,ceiling:-10,unit:'items'},{id:'neg',label:'Negative values',actual:-1,target:-2,ceiling:0,unit:'items'},{id:'big',label:'Large values',actual:Number.MAX_VALUE,target:Number.MAX_VALUE,ceiling:Number.MAX_VALUE,unit:'items'}]}]}/>);`);
  const charts=page.getByRole('img');assert.equal(await charts.count(),3);
  assert.equal(await charts.first().getAttribute('aria-label'),'Unavailable: 0 items, target 0, scale 0 to 1');
  assert.equal(await charts.nth(1).getAttribute('aria-label'),'Negative values: 0 items, target 0, scale 0 to 1');
  assert.doesNotMatch(await page.locator('section').innerHTML(),/NaN|Infinity/);
  await capture('normalized-values',{audit:true});

  await mount(`function Host(){const [periods,setPeriods]=React.useState([{id:'one',label:'Original',metrics:[{id:'first',label:'Old goal',actual:1,target:2,ceiling:3,unit:'items'}]}]);return <><Subject.BulletTargets periods={periods}/><button id="replace" onClick={()=>setPeriods([{id:'two',label:'Replacement',metrics:[{id:'second',label:'New goal',actual:3,target:4,ceiling:5,unit:'items'}]}])}>Replace periods</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await page.locator('#replace').click();assert.equal(await page.getByRole('button',{name:'Replacement',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.getByText('Old goal',{exact:true}).count(),0);
  assert.equal(await page.getByRole('img',{name:'New goal: 3 items, target 4, scale 0 to 5',exact:true}).count(),1);
  await capture('replacement-period',{audit:true});
  await checkLongData({page,mount,assert,capture});
  await checkLiveMotion({page,mount,assert,capture});
}

export async function checkLiveMotion({page,mount,assert,capture=async()=>{}}) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.BulletTargets/>);`);
  await page.locator('[data-demo="bullet-value-0"]').evaluate(node=>{
    window.bulletFigureSamples=[Number(node.textContent)];
    window.bulletFigureObserver=new MutationObserver(()=>window.bulletFigureSamples.push(Number(node.textContent)));
    window.bulletFigureObserver.observe(node,{subtree:true,childList:true,characterData:true});
  });
  await page.getByRole('button',{name:'September',exact:true}).click();
  await page.waitForFunction(()=>window.bulletFigureSamples.some(value=>value>42&&value<51));
  const samples=await page.evaluate(()=>window.bulletFigureSamples);
  assert.ok(samples.some(value=>value>42&&value<51),'Period figures interpolate to the next result');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>window.bulletFigureObserver.disconnect());
  const fractions=await page.getByRole('img').evaluateAll(nodes=>nodes.map(node=>node.children[1].getBoundingClientRect().width/node.getBoundingClientRect().width));
  for(const [i,expected]of [51/70,22/40,92/100].entries())assert.ok(Math.abs(fractions[i]-expected)<.005,'Live reduced motion settles the actual bar');
  assert.equal(await page.getByRole('button',{name:'September',exact:true}).evaluate(node=>node===document.activeElement),true);
  assert.equal(await page.locator('[data-demo="bullet-value-0"]').innerText(),'51');
  await capture('live-reduced-motion',{audit:true});
}

async function checkLongData({page,mount,assert,capture=async()=>{}}){
 await page.setViewportSize({width:320,height:1600});
 const bullet=true;
 const source=bullet
  ? `createRoot(document.getElementById('root')).render(<Subject.BulletTargets title="A wider publishing target" periods={[{id:'one',label:'Current',metrics:[{id:'long',label:'Research reports shared with the partner network',actual:1e22,target:1.2e22,ceiling:1.5e22,unit:'completed editorial publications'}]}]}/>);`
  : `createRoot(document.getElementById('root')).render(<Subject.SlopeComparison beforeLabel="Previous reporting quarter" afterLabel="Current reporting quarter" unit="completed editorial publications" series={[{id:'one',label:'Research reports shared with the partner network',before:1e22,after:1.2e22}]}/>);`;
 await mount(source);
 await capture('long-data');
 const layout=await page.locator('section').evaluate(node=>{
  const card=node.getBoundingClientRect(),walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),outside=[];
  while(walker.nextNode()){
   const text=walker.currentNode;if(!text.textContent.trim())continue;
   const range=document.createRange();range.selectNodeContents(text);
   for(const r of range.getClientRects())if(r.width>0&&(r.left<card.left-1||r.right>card.right+1))outside.push({text:text.textContent,rect:{left:r.left,right:r.right},card:{left:card.left,right:card.right}});
  }
  return{viewport:innerWidth,width:document.documentElement.scrollWidth,outside};
 });
 assert.deepEqual(layout.outside,[],'Every painted long datum stays within the card');
 assert.ok(layout.width<=layout.viewport,'Long-data viewport has no horizontal overflow');
 await page.setViewportSize({width:390,height:1600});
}
