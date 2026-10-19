export async function check({page,mount,assert,capture=async()=>{}}) {
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.SlopeComparison onSelect={row=>window.changes.push({...row})}/>);`);
  const exports=page.getByRole('button',{name:/Exports/});await exports.focus();await exports.press('Enter');
  assert.equal(await exports.getAttribute('aria-pressed'),'true');
  assert.match(await page.getByRole('img').getAttribute('aria-label'),/Exports: 32% in September, 28% in October/);
  const editor=page.getByRole('button',{name:/Editor/});await editor.focus();await editor.press('Space');
  assert.deepEqual(await page.evaluate(()=>window.changes),[{id:'exports',label:'Exports',before:32,after:28},{id:'editor',label:'Editor',before:58,after:70}]);
  assert.equal(await page.locator('button[aria-pressed=true]').count(),1);
  await capture('selected-editor',{audit:true});

  await mount(`window.rows=[{id:'a',label:'Search',before:46,after:64},{id:'b',label:'Editor',before:58,after:70}];window.changes=[];createRoot(document.getElementById('root')).render(<Subject.SlopeComparison series={window.rows} onSelect={row=>{window.changes.push({...row});row.label='Host mutation';row.after=999}}/>);`);
  await page.getByRole('button',{name:/Editor/}).click();
  assert.deepEqual(await page.evaluate(()=>window.rows),[{id:'a',label:'Search',before:46,after:64},{id:'b',label:'Editor',before:58,after:70}],'A selection callback receives its own row copy');
  assert.equal(await page.getByRole('button',{name:/Host mutation/}).count(),0);

  await mount(`function Host(){const [rows,setRows]=React.useState([{id:'a',label:'Original',before:10,after:20}]);return <><Subject.SlopeComparison series={rows}/><button id="replace" onClick={()=>setRows([{id:'b',label:'Replacement',before:-20,after:10}])}>Replace series</button><button id="empty" onClick={()=>setRows([])}>Clear series</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await page.locator('#replace').click();assert.equal(await page.getByRole('button',{name:/Replacement/}).getAttribute('aria-pressed'),'true');
  assert.match(await page.getByRole('img').getAttribute('aria-label'),/Replacement: -20%/);
  const path=await page.locator('svg path').last().getAttribute('d');assert.doesNotMatch(path,/NaN|Infinity/);
  await capture('negative-values',{audit:true});
  await page.locator('#empty').click();assert.equal(await page.getByRole('img').count(),0);
  assert.equal(await page.getByText('No comparison data.',{exact:true}).isVisible(),true);
  await capture('empty-series',{audit:true});

  await mount(`createRoot(document.getElementById('root')).render(<Subject.SlopeComparison series={[{id:'invalid',label:'Missing observations',before:Number.NaN,after:Number.POSITIVE_INFINITY}]}/>);`);
  assert.doesNotMatch(await page.locator('section svg').innerHTML(),/NaN|Infinity/);
  assert.match(await page.getByRole('img').getAttribute('aria-label'),/0% in September, 0% in October/);
  await capture('invalid-numbers',{audit:true});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SlopeComparison series={[{id:'wide',label:'Wide range',before:-Number.MAX_VALUE,after:Number.MAX_VALUE}]}/>);`);
  assert.equal(await page.getByRole('img').count(),0);
  assert.equal(await page.getByText('The numeric range is too large to plot.',{exact:true}).isVisible(),true);
  await capture('unplottable-range',{audit:true});
  await checkStrokeContrast({page,mount,assert,capture});
  await checkLongData({page,mount,assert,capture});
  await checkLiveMotion({page,mount,assert,capture});
}

export async function checkLiveMotion({page,mount,assert,capture=async()=>{}}) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SlopeComparison/>);`);
  await page.getByRole('button',{name:/Exports/}).focus();
  await page.getByRole('button',{name:/Exports/}).press('Enter');
  await page.waitForTimeout(25);
  const moving=Number(await page.locator('[data-demo="slope-before-value"]').innerText());
  assert.ok(moving>32&&moving<46,'Selection figures interpolate between observations');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const paths=await page.locator('svg g path').evaluateAll(nodes=>nodes.map(node=>({dash:node.style.strokeDasharray,offset:node.style.strokeDashoffset})));
  assert.equal(paths.length,4);paths.forEach(path=>assert.ok(!path.dash || parseFloat(path.dash)>=.999,'Live reduced motion finishes the slope drawing'));
  assert.equal(await page.locator('[data-demo="slope-before-value"]').innerText(),'32');
  assert.equal(await page.locator('[data-demo="slope-after-value"]').innerText(),'28');
  assert.equal(await page.getByRole('button',{name:/Exports/}).evaluate(node=>node===document.activeElement),true);
  await capture('live-reduced-motion',{audit:true});
}

async function checkLongData({page,mount,assert,capture=async()=>{}}){
 await page.setViewportSize({width:320,height:1600});
 const bullet=false;
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

async function checkStrokeContrast({page,mount,assert,capture=async()=>{}}){
 await mount(`createRoot(document.getElementById('root')).render(<Subject.SlopeComparison/>);`);
 const ratios=await page.locator('section').evaluate(node=>{
  const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),background=rgb(getComputedStyle(node).backgroundColor);
  const luminance=c=>c.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
  return [...node.querySelectorAll('svg g')].map(group=>{
   const opacity=Number(getComputedStyle(group).opacity),ink=rgb(getComputedStyle(group.querySelector('path')).stroke),painted=ink.map((n,i)=>n*opacity+background[i]*(1-opacity)),a=luminance(painted),b=luminance(background);
   return{opacity,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
 });
 await capture('slope-contrast',{audit:true});
 console.log('Slope stroke ratios',JSON.stringify(ratios));
 assert.equal(ratios.length,4);assert.ok(ratios.every(row=>row.ratio>=3),'All meaningful slope strokes exceed 3:1: '+JSON.stringify(ratios));
}
