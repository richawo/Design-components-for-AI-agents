// Curve and phrase edits, exact commits, host ownership, malformed layouts and native cancellation.
const layout=`{path:{start:{x:.1,y:.5},c1:{x:.3,y:.3},c2:{x:.7,y:.3},end:{x:.9,y:.5}},size:80,tracking:0,align:'middle'}`;
export async function check({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'reduce'});
 await mount(`window.pathChanges=[];window.pathCommits=[];window.phrases=[];createRoot(document.getElementById('root')).render(<Subject.TextPathTypesetter defaultValue={${layout}} onTextChange={text=>window.phrases.push(text)} onValueChange={value=>window.pathChanges.push(structuredClone(value))} onValueCommit={value=>window.pathCommits.push(structuredClone(value))}/>);`);
 const handle=page.locator('[data-demo="handle-c1"]');await handle.focus();await handle.press('ArrowRight');
 await page.waitForFunction(()=>window.pathCommits.length===1);assert.ok(Math.abs(await page.evaluate(()=>window.pathCommits[0].path.c1.x)-.304)<1e-6);
 await handle.press('Shift+ArrowLeft');assert.equal(await page.evaluate(()=>window.pathCommits.length),2);assert.ok(Math.abs(await page.evaluate(()=>window.pathCommits[1].path.c1.x)-.284)<1e-6);
 const canvas=page.getByRole('img',{name:/set along a curved path/});const box=await canvas.boundingBox(),start=await handle.boundingBox();
 await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.7,{steps:12});await page.mouse.up();
 assert.equal(await page.evaluate(()=>window.pathCommits.length),3);const dragged=await page.evaluate(()=>window.pathCommits[2]);assert.ok(Math.abs(dragged.path.c1.x-.4)<.003&&Math.abs(dragged.path.c1.y-.7)<.003);
 const phrase=page.locator('[data-demo="phrase"]');await phrase.fill('One  clear line');assert.equal(await page.evaluate(()=>window.phrases.at(-1)),'One  clear line');assert.equal(await page.locator('textPath').textContent(),'One clear line');
 await page.locator('[data-demo="shape-wave"]').click();assert.equal(await page.evaluate(()=>window.pathCommits.length),4);assert.equal(await page.locator('[data-demo="shape-wave"]').getAttribute('aria-pressed'),'true');
 const align=page.getByRole('radiogroup',{name:'Alignment',exact:true});await align.getByRole('radio',{checked:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>window.pathCommits.at(-1).align),'end');
 await phrase.fill('');assert.equal(await page.getByRole('img',{name:'Empty path',exact:true}).count(),1);assert.equal(await page.locator('[data-demo="fit"]').count(),0,'An empty phrase has no overflowing letters to fit');
 await mount(`window.pathCommits=[];createRoot(document.getElementById('root')).render(<Subject.TextPathTypesetter defaultValue={${layout}} disabled onValueCommit={value=>window.pathCommits.push(value)}/>);`);
 assert.equal(await page.locator('[data-demo="phrase"]').isDisabled(),true);await page.locator('[data-demo="handle-c1"]').focus();await page.keyboard.press('ArrowRight');assert.deepEqual(await page.evaluate(()=>window.pathCommits),[]);
 await mount(`function Host(){const[value,setValue]=React.useState(${layout});window.replacePath=setValue;return <Subject.TextPathTypesetter value={value} onValueChange={setValue}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 await page.evaluate(()=>window.replacePath({path:{start:{x:.1,y:.5},c1:{x:NaN,y:.3},c2:{x:.7,y:.3},end:{x:.9,y:.5}},size:80,tracking:0,align:'middle'}));
 assert.equal(await page.getByRole('alert').count(),1,'Malformed host geometry has a written state');
 assert.equal(await page.locator('svg path[d]').evaluateAll(nodes=>nodes.every(node=>!/(?:NaN|Infinity)/.test(node.getAttribute('d')))),true);
 await checkHostLayouts({page,mount,assert});
 await checkMorph({page,mount,assert});
}

export async function checkMorph({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'no-preference'});
 try {
  await mount(`window.curveMorphCommits=[];createRoot(document.getElementById('root')).render(<Subject.TextPathTypesetter defaultValue={${layout}} onValueCommit={next=>window.curveMorphCommits.push(structuredClone(next))}/>);`);
  assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),false);
  const before=await page.locator('.tpt-canvas path[id]').getAttribute('d'),wave=page.locator('[data-demo="shape-wave"]');
  await Promise.all([
   page.waitForFunction(previous=>document.querySelector('.tpt-canvas path[id]').getAttribute('d')!==previous&&document.querySelector('[data-demo="shape-wave"]').getAttribute('aria-pressed')!=='true'&&window.curveMorphCommits.length===0,before,{polling:'raf',timeout:1500}),
   wave.click(),
  ]);
  await page.waitForFunction(()=>window.curveMorphCommits.length===1);
  assert.equal(await wave.getAttribute('aria-pressed'),'true');
  const actual=await page.evaluate(()=>{const svg=document.querySelector('.tpt-canvas svg[role="img"]'),box=svg.viewBox.baseVal;return Object.fromEntries(['start','c1','c2','end'].map(key=>{const matrix=document.querySelector('[data-demo="handle-'+key+'"]').transform.baseVal.consolidate().matrix;return[key,{x:matrix.e/box.width,y:matrix.f/box.height}]}))});
  const saved=await page.evaluate(()=>window.curveMorphCommits[0]);
  for(const key of ['start','c1','c2','end'])for(const coordinate of ['x','y'])assert.ok(Math.abs(actual[key][coordinate]-saved.path[key][coordinate])<.0002,'The finished morph callback describes its visible control points');
 } finally {await page.emulateMedia({reducedMotion:'reduce'})}
}

async function checkHostLayouts({page,mount,assert}) {
 const initial={path:{start:{x:.1,y:.5},c1:{x:.3,y:.3},c2:{x:.7,y:.3},end:{x:.9,y:.5}},size:80,tracking:0,align:'middle'};
 const pose=()=>page.evaluate(()=>({d:document.querySelector('.tpt-canvas path[id]')?.getAttribute('d'),alerts:document.querySelectorAll('[role="alert"]').length,finite:[...document.querySelectorAll('.tpt-canvas svg *')].every(node=>['d','transform','font-size','letter-spacing','x','y'].every(name=>!/(?:NaN|Infinity)/.test(node.getAttribute(name)??''))),commits:window.hostPathCommits,changes:window.hostPathChanges,originalStart:String(window.originalPath.path.start.x),originalEnd:String(window.originalPath.path.end.y),cancelCount:window.hostPathCancels??0}));
 for(const kind of ['arriving-invalid','initial-invalid','invalid-parameters','invalid-default','readonly-layout','refused-layout','notification-mutation','recovery','readonly-text','unchanged-drop','native-cancel']) {
  let session,previousTouchPoints;
  try {
   if(kind==='native-cancel') {
    previousTouchPoints=await page.evaluate(()=>navigator.maxTouchPoints);session=await page.context().newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
   }
   const controlled=['arriving-invalid','initial-invalid','invalid-parameters','readonly-layout','refused-layout','recovery'].includes(kind);
   const value=kind==='initial-invalid'?`{...window.originalPath,path:{...window.originalPath.path,c1:{x:NaN,y:.3}}}`:kind==='invalid-parameters'?`{...window.originalPath,size:Infinity,tracking:NaN,align:'unknown'}`:kind==='invalid-default'?`{...window.originalPath,size:NaN}`:'window.originalPath';
   const onChange=kind==='notification-mutation'?`next=>{window.hostPathChanges.push(structuredClone(next));next.path.start.x=NaN}`:kind==='refused-layout'?`next=>window.hostPathChanges.push(structuredClone(next))`:`next=>{window.hostPathChanges.push(structuredClone(next));setValue(next)}`;
   const onCommit=kind==='notification-mutation'?`next=>{window.hostPathCommits.push(structuredClone(next));next.path.end.y=NaN}`:`next=>window.hostPathCommits.push(structuredClone(next))`;
   await mount(`window.originalPath=${JSON.stringify(initial)};window.hostPathChanges=[];window.hostPathCommits=[];function Host(){const[value,setValue]=React.useState(${value});window.replaceHostPath=setValue;return <Subject.TextPathTypesetter ${kind==='readonly-text'?'text="Fixed phrase"':''} ${controlled?'value={value}':'defaultValue={'+value+'}'} ${kind==='readonly-layout'?'':'onValueChange={'+onChange+'}'} onValueCommit={${onCommit}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
   const before=await pose(),handle=page.locator('[data-demo="handle-c1"]');let invalid,during,editable,phrase;
   if(kind==='arriving-invalid'||kind==='recovery') {
    await page.evaluate(()=>window.replaceHostPath({...window.originalPath,path:{...window.originalPath.path,c1:{x:NaN,y:.3}}}));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));invalid=await pose();
    if(kind==='recovery')await page.evaluate(()=>window.replaceHostPath({...window.originalPath,path:{...window.originalPath.path,c1:{x:.6,y:.3}}}));
   } else if(['readonly-layout','refused-layout','notification-mutation'].includes(kind)) {
    await handle.focus();await handle.press('ArrowRight');
    if(kind==='readonly-layout'){await page.locator('[data-demo="phrase"]').fill('A writable phrase');phrase=await page.locator('textPath').textContent()}
   } else if(kind==='readonly-text')editable=await page.locator('[data-demo="phrase"]').isEditable();
   else if(kind==='unchanged-drop') {
    await handle.scrollIntoViewIfNeeded();const box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.up();
   } else if(session) {
    await handle.scrollIntoViewIfNeeded();const start=await handle.boundingBox(),canvas=await page.locator('.tpt-canvas svg[role="img"]').boundingBox();
    await handle.evaluate(node=>{window.hostPathCancels=0;node.addEventListener('pointercancel',()=>window.hostPathCancels++)});
    const x=start.x+start.width/2,y=start.y+start.height/2,endX=canvas.x+canvas.width*.4,endY=canvas.y+canvas.height*.7;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});
    for(let step=1;step<=12;step++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(endX-x)*step/12,y:y+(endY-y)*step/12,id:0}]});
    during=await pose();await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   }
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const after=await pose();
   assert.equal(after.finite,true,kind+' keeps finite SVG geometry');
   assert.doesNotMatch(await page.locator('#root').innerText(),/NaN|Infinity/,kind+' keeps its visible figures usable');
   if(['initial-invalid','invalid-parameters','invalid-default','arriving-invalid'].includes(kind)) {
    assert.equal(after.alerts,1,kind+' has a written state');if(kind==='arriving-invalid')assert.equal(after.d,before.d,'Arriving invalid data retains the last valid drawing');
   } else if(kind==='recovery') {
    assert.equal(invalid.alerts,1);assert.equal(invalid.finite,true);assert.equal(after.alerts,0);assert.notEqual(after.d,before.d);
   } else if(kind==='readonly-layout'||kind==='refused-layout') {
    assert.equal(after.d,before.d,kind+' retains the host drawing');assert.deepEqual(after.commits,[],kind+' cannot invent a commit');
    if(kind==='readonly-layout')assert.equal(phrase,'A writable phrase');else assert.equal(after.changes.length,1);
   } else if(kind==='notification-mutation') {
    assert.equal(after.alerts,0);assert.equal(after.originalStart,'0.1');assert.equal(after.originalEnd,'0.5');assert.equal(after.commits.length,1);
   } else if(kind==='readonly-text')assert.equal(editable,false);
   else if(kind==='unchanged-drop'){assert.deepEqual(after.commits,[]);assert.equal(after.d,before.d)}
   else {assert.notEqual(during.d,before.d,'The native touch must move the curve');assert.equal(after.cancelCount,1);assert.deepEqual(after.commits,[]);assert.equal(after.d,before.d,'Canceled touches restore the starting curve')}
  } finally {
   if(session){await session.send('Emulation.setTouchEmulationEnabled',{enabled:previousTouchPoints>0,maxTouchPoints:Math.max(1,previousTouchPoints)});await session.detach()}
  }
 }
}
