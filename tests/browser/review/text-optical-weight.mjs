// Accepted values, retained retries, completed gestures, detached callbacks and unavailable fonts.
export async function check({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'reduce'});
 await mount(`window.opticalRequests=[];window.opticalCommits=[];createRoot(document.getElementById('root')).render(<Subject.TextOpticalWeight value={{weight:420,size:112}} onValueChange={value=>window.opticalRequests.push(structuredClone(value))} onValueCommit={value=>window.opticalCommits.push(structuredClone(value))}/>);`);
 let weight=page.getByRole('slider',{name:/^Weight/});await weight.focus();await weight.press('ArrowRight');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.deepEqual(await page.evaluate(()=>window.opticalRequests),[{weight:421,size:112}]);
 assert.equal(await weight.inputValue(),'420','An unacknowledged proposal cannot change the controlled specimen');
 assert.deepEqual(await page.evaluate(()=>window.opticalCommits),[],'A rejected controlled proposal cannot emit a saved gesture');
 await mount(`window.opticalCommits=[];window.acceptOptical=false;function Host(){const[value,setValue]=React.useState({weight:420,size:112});return <Subject.TextOpticalWeight value={value} onValueChange={next=>{if(!window.acceptOptical)throw Error('Typography request rejected');setValue(next)}} onValueCommit={next=>window.opticalCommits.push(structuredClone(next))}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const exact=page.getByRole('spinbutton',{name:'Weight, exact value',exact:true});await exact.fill('750');await exact.press('Enter');
 await page.getByRole('alert').filter({hasText:'Typography request rejected'}).waitFor();assert.equal(await exact.inputValue(),'750');assert.equal(await page.getByRole('slider',{name:/^Weight/}).inputValue(),'420');assert.deepEqual(await page.evaluate(()=>window.opticalCommits),[]);
 await page.evaluate(()=>window.acceptOptical=true);await exact.press('Enter');await page.waitForFunction(()=>window.opticalCommits.length===1);
 assert.deepEqual(await page.evaluate(()=>window.opticalCommits),[{weight:750,size:112}]);
 assert.match(await page.locator('.tow-reading').evaluate(node=>getComputedStyle(node).fontVariationSettings),/"wght"\s+750/);
 await exact.fill('not a number');await exact.press('Enter');assert.equal(await exact.getAttribute('aria-invalid'),'true');await exact.press('Escape');assert.equal(await exact.inputValue(),'750');
 await mount(`createRoot(document.getElementById('root')).render(<Subject.TextOpticalWeight value={{weight:420,size:112}}/>);`);
 for(const slider of await page.getByRole('slider').all())assert.equal(await slider.isDisabled(),true);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.TextOpticalWeight text="" weightAxis={{min:900,max:100,step:1}}/>);`);
 assert.ok((await page.getByRole('alert').innerText()).includes('axis'));
 assert.ok((await page.locator('#root').innerText()).includes('Give this face a few words'));
 for(const slider of await page.getByRole('slider').all())assert.equal(await slider.isDisabled(),true);
 await mount(`window.fontRetries=0;function Host(){const[status,setStatus]=React.useState('unavailable'),[error,setError]=React.useState('Font unavailable');return <Subject.TextOpticalWeight status={status} error={error} defaultValue={{weight:600,size:96}} onRetry={()=>{window.fontRetries++;if(window.fontRetries===1)setError('Font still unavailable');else {setError('');setStatus('ready')}}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const retry=page.getByRole('button',{name:'Retry the face',exact:true});await retry.focus();await retry.press('Enter');await page.getByRole('alert').filter({hasText:'Font still unavailable'}).waitFor();await retry.press('Enter');
 await page.waitForFunction(()=>window.fontRetries===2);weight=page.getByRole('slider',{name:/^Weight/});assert.equal(await weight.isDisabled(),false);assert.equal(await weight.inputValue(),'600');assert.equal(await page.getByRole('slider',{name:/^Size/}).inputValue(),'96');
 await checkGestures({page,mount,assert});
}

async function checkGestures({page,mount,assert}) {
 for(const kind of ['range-release','range-cancel','held-stepper','uncontrolled-retry','notification-mutation']) {
  let session,previousTouchPoints;
  try {
   if(kind==='range-cancel') {
    previousTouchPoints=await page.evaluate(()=>navigator.maxTouchPoints);
    session=await page.context().newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
   }
   const change=kind==='uncontrolled-retry'?`next=>{window.gestureChanges.push({...next});if(!window.acceptGesture)throw Error('Gesture request refused')}`:kind==='notification-mutation'?`next=>{window.gestureChanges.push({...next});next.weight=900}`:`next=>window.gestureChanges.push({...next})`;
   await mount(`window.gestureChanges=[];window.gestureCommits=[];window.acceptGesture=false;createRoot(document.getElementById('root')).render(<Subject.TextOpticalWeight defaultValue={{weight:420,size:112}} onValueChange={${change}} onValueCommit={next=>window.gestureCommits.push({...next})}/>);`);
   const range=page.getByRole('slider',{name:/^Weight/}),exact=page.getByRole('spinbutton',{name:'Weight, exact value',exact:true});
   if(kind==='range-release'||kind==='range-cancel') {
    await range.scrollIntoViewIfNeeded();
    const box=await range.boundingBox(),limits=await range.evaluate(node=>({min:Number(node.min),max:Number(node.max),value:Number(node.value)}));
    const start=box.x+9+(box.width-18)*(limits.value-limits.min)/(limits.max-limits.min),end=box.x+9+(box.width-18)*.75,y=box.y+box.height/2;
    if(session) {
     await range.evaluate(node=>{window.gestureCancels=0;node.addEventListener('pointercancel',()=>window.gestureCancels++)});
     await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y,id:0}]});
     for(let step=1;step<=12;step++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start+(end-start)*step/12,y,id:0}]});
     assert.notEqual(await range.inputValue(),'420','The native touch gesture must actually move the weight');
     await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
     await page.waitForFunction(()=>document.querySelector('[data-demo="optical-weight"]').value==='420');
     assert.equal(await page.evaluate(()=>window.gestureCancels),1);assert.deepEqual(await page.evaluate(()=>window.gestureCommits),[]);
    } else {
     await page.mouse.move(start,y);await page.mouse.down();await page.mouse.move(end,y,{steps:12});
     assert.deepEqual(await page.evaluate(()=>window.gestureCommits),[],'Dragging is not a finished gesture');await page.mouse.up();
    }
   } else if(kind==='held-stepper') {
    const button=page.getByRole('button',{name:'More weight',exact:true});await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(650);
    assert.deepEqual(await page.evaluate(()=>window.gestureCommits),[],'A held stepper commits when the person releases it');await page.mouse.up();
   } else {
    await exact.fill('750');await exact.press('Enter');
    if(kind==='uncontrolled-retry') {
     await page.getByRole('alert').filter({hasText:'Gesture request refused'}).waitFor();assert.equal(await range.inputValue(),'420');assert.equal(await exact.inputValue(),'750');assert.deepEqual(await page.evaluate(()=>window.gestureCommits),[]);
     await page.evaluate(()=>window.acceptGesture=true);await exact.press('Enter');
     assert.deepEqual(await page.evaluate(()=>window.gestureChanges),[{weight:750,size:112},{weight:750,size:112}]);
    }
   }
   if(kind!=='range-cancel') {
    await page.waitForFunction(()=>window.gestureCommits.length===1);
    const accepted=Number(await range.inputValue());assert.notEqual(accepted,420);assert.deepEqual(await page.evaluate(()=>window.gestureCommits),[{weight:accepted,size:112}]);
    if(kind==='notification-mutation'||kind==='uncontrolled-retry')assert.equal(accepted,750);
   }
  } finally {
   if(session){await session.send('Emulation.setTouchEmulationEnabled',{enabled:previousTouchPoints>0,maxTouchPoints:Math.max(1,previousTouchPoints)});await session.detach()}
  }
 }
}
