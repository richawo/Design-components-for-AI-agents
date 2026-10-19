async function feedbackRegression({page,mount,assert}) {
 await mount(`function Host(){const[value,setValue]=React.useState(['Control','K']);window.clearChord=()=>setValue([]);return <Subject.ShortcutRecorder value={value} onChange={()=>{}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const record=page.locator('[data-demo="record-shortcut"]');await record.click();await record.press('Alt+P');assert.deepEqual(await page.locator('kbd').allTextContents(),['Control','K']);assert.notEqual(await page.getByRole('status').innerText(),'Shortcut recorded.','A refused controlled chord cannot claim to have been recorded');
 await page.evaluate(()=>window.clearChord());await page.waitForFunction(()=>document.querySelectorAll('kbd').length===0);assert.equal(await page.locator('kbd').count(),0);assert.notEqual(await page.getByRole('status').innerText(),'Shortcut recorded.');
}


async function copyRegression({page,mount,assert}) {
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.ShortcutRecorder onChange={keys=>{window.changes.push([...keys]);keys.push('host-mutation')}}/>);`);
  await page.locator('[data-demo="record-shortcut"]').click();await page.locator('[data-demo="record-shortcut"]').press('Control+Shift+L');
  assert.deepEqual(await page.evaluate(()=>window.changes),[['Control','Shift','L']]);
  assert.deepEqual(await page.locator('kbd').allTextContents(),['Control','Shift','L'],'Shortcut notifications cannot mutate the stored chord');
}


async function readOnlyRegression({page,mount,assert}) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ShortcutRecorder value={['Control','K']}/>);`);
  assert.equal(await page.locator('[data-demo="record-shortcut"]').isDisabled(),true,'Controlled shortcuts without a writer are read-only');
  assert.equal(await page.getByRole('button',{name:'Reset shortcut',exact:true}).isDisabled(),true);
}


async function liveMotion({page,mount,assert}) {
  await page.emulateMedia({reducedMotion:'no-preference'});await mount(`function Host(){const[show,setShow]=React.useState(false);window.showRecorder=()=>setShow(true);return show?<Subject.ShortcutRecorder/>:null};createRoot(document.getElementById('root')).render(<Host/>);`);await page.evaluate(()=>window.showRecorder());
  await page.waitForFunction(()=>{const section=document.querySelector('section'),opacity=Number(getComputedStyle(section).opacity);return opacity>0&&opacity<.95},null,{timeout:1500,polling:'raf'});
  await page.emulateMedia({reducedMotion:'reduce'});
  const frame=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const style=getComputedStyle(document.querySelector('section'));resolve({opacity:Number(style.opacity),y:new DOMMatrixReadOnly(style.transform).m42})}))));
  assert.deepEqual(frame,{opacity:1,y:0},'Live reduced motion immediately settles shortcut recorder entry');
}


async function mainWorkflow({page,mount,assert,capture}) {
 await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.ShortcutRecorder onChange={keys=>window.changes.push([...keys])}/>);`);
 const record=()=>page.locator('[data-demo="record-shortcut"]'),reset=()=>page.getByRole('button',{name:'Reset shortcut',exact:true});
 await record().focus();await record().press('Enter');assert.equal(await record().getAttribute('aria-label'),'Recording shortcut. Escape to cancel.');await capture('recording',{audit:true});
 await record().press('j');assert.equal(await page.getByText('Include Control, Alt or Command, or use a function key.',{exact:true}).count(),1);assert.deepEqual(await page.evaluate(()=>window.changes),[]);await capture('invalid-unmodified-key',{audit:true});
 await record().press('Control');await record().press('Shift');assert.deepEqual(await page.evaluate(()=>window.changes),[]);
 await record().press('Escape');assert.equal(await page.getByRole('status').innerText(),'Recording cancelled.');assert.deepEqual(await page.locator('kbd').allTextContents(),['Control','Shift','K']);assert.equal(await record().evaluate(n=>n===document.activeElement),true);
 await record().press('Space');await record().press('Control+Alt+Shift+Meta+L');assert.deepEqual(await page.locator('kbd').allTextContents(),['Control','Alt','Shift','Meta','L']);assert.deepEqual(await page.evaluate(()=>window.changes),[['Control','Alt','Shift','Meta','L']]);assert.equal(await page.getByRole('status').innerText(),'Shortcut recorded.');await capture('recorded-all-modifiers',{audit:true});
 await reset().focus();await reset().press('Space');assert.deepEqual(await page.locator('kbd').allTextContents(),['Control','Shift','K']);assert.equal(await record().evaluate(n=>n===document.activeElement),true);assert.equal(await page.getByRole('status').innerText(),'Shortcut reset.');
 await record().press('Enter');await record().press('F8');assert.deepEqual(await page.locator('kbd').allTextContents(),['F8']);await record().click();await record().press('Tab');assert.equal(await reset().evaluate(n=>n===document.activeElement),true);assert.deepEqual(await page.locator('kbd').allTextContents(),['F8']);assert.equal(await page.getByText('Press a key combination…',{exact:true}).count(),0);assert.deepEqual(await page.evaluate(()=>window.changes),[['Control','Alt','Shift','Meta','L'],['Control','Shift','K'],['F8']]);await capture('function-key-tab-exit',{audit:true});
}
async function controlledWorkflow({page,mount,assert,capture}) {
 await mount(`function Host(){const[value,setValue]=React.useState(['Control','K']);const[accept,setAccept]=React.useState(false);window.changes=[];window.allowChord=()=>setAccept(true);window.clearChord=()=>setValue([]);return <Subject.ShortcutRecorder value={value} onChange={next=>{window.changes.push([...next]);if(accept)setValue(next)}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const record=()=>page.locator('[data-demo="record-shortcut"]');await record().click();await record().press('Alt+P');assert.deepEqual(await page.locator('kbd').allTextContents(),['Control','K']);assert.deepEqual(await page.evaluate(()=>window.changes),[['Alt','P']]);
 await page.evaluate(()=>window.allowChord());await record().click();await record().press('Alt+P');assert.deepEqual(await page.locator('kbd').allTextContents(),['Alt','P']);await page.evaluate(()=>window.clearChord());await page.waitForFunction(()=>document.querySelectorAll('kbd').length===0);assert.equal(await page.locator('kbd').count(),0);assert.notEqual(await page.getByRole('status').innerText(),'Shortcut recorded.');assert.ok((await record().getAttribute('aria-label')).endsWith('not set'));await capture('controlled-cleared',{audit:true});
}
async function readOnlyWorkflow({page,mount,assert,capture}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.ShortcutRecorder value={['Control','K']}/>);`);assert.equal(await page.locator('[data-demo="record-shortcut"]').isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Reset shortcut',exact:true}).isDisabled(),true);await capture('read-only-chord',{audit:true});
}
async function compositionWorkflow({page,mount,assert}) {
 await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<><Subject.ShortcutRecorder defaultValue={[]} onChange={next=>window.changes.push([...next])}/><input aria-label="Outside text"/></>);`);
 const record=page.locator('[data-demo="record-shortcut"]');assert.equal(await page.locator('kbd').count(),0);await record.click();await record.evaluate(node=>node.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'p',ctrlKey:true,isComposing:true})));await record.evaluate(node=>{for(const key of ['Dead','Process'])node.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key}));});assert.deepEqual(await page.evaluate(()=>window.changes),[]);assert.equal(await page.getByText('Press a key combination…',{exact:true}).count(),1);
 await page.getByRole('textbox',{name:'Outside text',exact:true}).fill('Write outside the recorder');assert.equal(await page.getByText('Press a key combination…',{exact:true}).count(),0);assert.deepEqual(await page.evaluate(()=>window.changes),[]);await page.getByRole('button',{name:'Reset shortcut',exact:true}).click();assert.equal(await page.locator('kbd').count(),0);assert.deepEqual(await page.evaluate(()=>window.changes),[[]]);
}
async function independentWorkflow({page,mount,assert,capture}) {
 await page.setViewportSize({width:320,height:1600});await mount(`createRoot(document.getElementById('root')).render(<><Subject.ShortcutRecorder label="Capture a thought for the research workspace" description="Choose the keyboard combination that opens a new research note without interrupting the work already in progress." defaultValue={['Control','Shift','VeryLongHostSuppliedKeyName']}/><Subject.ShortcutRecorder label="Independent command" defaultValue={['Alt','P']}/></>);`);assert.equal(await page.locator('section h2').evaluateAll(nodes=>new Set(nodes.map(n=>n.id)).size),2);const records=page.locator('[data-demo="record-shortcut"]');await records.nth(1).click();await records.nth(1).press('F9');assert.deepEqual(await page.locator('section').nth(0).locator('kbd').allTextContents(),['Control','Shift','VeryLongHostSuppliedKeyName']);assert.deepEqual(await page.locator('section').nth(1).locator('kbd').allTextContents(),['F9']);const insets=await page.locator('section').nth(0).locator('[data-demo="record-shortcut"]').evaluate(button=>{const b=button.getBoundingClientRect();return [...button.querySelectorAll('kbd')].map(key=>({top:key.getBoundingClientRect().top-b.top,bottom:b.bottom-key.getBoundingClientRect().bottom}));});assert.ok(insets.every(inset=>inset.top>=8&&inset.bottom>=8),'Wrapped keycaps keep clear vertical padding');const width=await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth));assert.ok(width<=320,'Long host key labels wrap without document overflow');await capture('long-independent-chords',{audit:true});await page.setViewportSize({width:390,height:1600});
}
async function liveWorkflow({page,mount,assert,capture}) {
 await liveMotion({page,mount,assert});await capture('live-reduced-motion',{audit:true});
}
export async function check({page,mount,assert,capture=async()=>{}}) {
 for(const check of [mainWorkflow,controlledWorkflow,readOnlyWorkflow,compositionWorkflow,independentWorkflow,liveWorkflow])await check({page,mount,assert,capture});
 for(const check of [copyRegression,readOnlyRegression,feedbackRegression])await check({page,mount,assert});await page.emulateMedia({reducedMotion:'reduce'});
}
