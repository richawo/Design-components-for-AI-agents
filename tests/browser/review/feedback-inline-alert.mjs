async function revisionRegression({page,mount,assert}) {
 await mount(`window.jobs=[];function Host(){const[revision,setRevision]=React.useState(0);window.replaceAlert=()=>setRevision(1);return <Subject.InlineAlert title={revision?'Second export':'First export'} onAction={()=>new Promise((resolve,reject)=>window.jobs.push({resolve,reject}))}/>};createRoot(document.getElementById('root')).render(<Host/>);`);await page.locator('[data-demo="alert-action"]').click();await page.evaluate(()=>window.replaceAlert());await page.getByRole('heading',{name:'Second export',exact:true}).waitFor();assert.equal(await page.locator('[data-demo="alert-action"]').isDisabled(),false,'Replacing the alert retires the prior pending action');await page.locator('[data-demo="alert-action"]').click();await page.evaluate(()=>window.jobs[0].reject(new Error('retired export')));await page.waitForTimeout(50);assert.equal(await page.locator('[data-demo="alert-action"]').isDisabled(),true,'Retired completion cannot unlock a newer action');assert.equal(await page.getByRole('status').innerText(),'');await page.evaluate(()=>window.jobs[1].resolve());await page.waitForFunction(()=>document.querySelector('[data-demo="alert-action"]').getAttribute('aria-busy')==='false');
}


async function immediateDismissLock({page,mount,assert}) {
 await mount(`window.dismisses=0;createRoot(document.getElementById('root')).render(<Subject.InlineAlert onAction={()=>new Promise(()=>{})} onDismiss={()=>window.dismisses++}/>);`);await page.evaluate(()=>{document.querySelector('[data-demo="alert-action"]').click();document.querySelector('[data-demo="dismiss"]').click();});assert.equal(await page.evaluate(()=>window.dismisses),0,'Pending action locks dismissal in the same event turn');
}


async function motionRegression({page,mount,assert}) {
  await page.emulateMedia({reducedMotion:'no-preference'});await mount(`function Host(){const[show,setShow]=React.useState(false);window.showSubject=()=>setShow(true);return show?<Subject.InlineAlert/>:null};createRoot(document.getElementById('root')).render(<Host/>);`);await page.evaluate(()=>window.showSubject());
  await page.waitForFunction(()=>{const section=document.querySelector('section'),opacity=Number(getComputedStyle(section).opacity);return opacity>0&&opacity<.95},null,{timeout:1500,polling:'raf'});
  await page.emulateMedia({reducedMotion:'reduce'});
  const frame=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const style=getComputedStyle(document.querySelector('section'));resolve({opacity:Number(style.opacity),y:new DOMMatrixReadOnly(style.transform).m42})}))));
  assert.deepEqual(frame,{opacity:1,y:0},'Live reduced motion immediately settles inline alert entry');
}


async function retryWorkflow({page,mount,assert,capture}) {
 await mount(`window.jobs=[];window.dismisses=0;createRoot(document.getElementById('root')).render(<Subject.InlineAlert errorMessage="The archive is offline. Try again." onAction={()=>new Promise((resolve,reject)=>window.jobs.push({resolve,reject}))} onDismiss={()=>window.dismisses++}/>);`);const action=page.locator('[data-demo="alert-action"]'),dismiss=page.getByRole('button',{name:'Dismiss notification',exact:true});await action.focus();await action.press('Enter');assert.equal(await action.getAttribute('aria-busy'),'true');assert.equal(await action.isDisabled(),true);assert.equal(await dismiss.isDisabled(),true);await page.evaluate(()=>document.querySelector('[data-demo="alert-action"]').click());assert.equal(await page.evaluate(()=>window.jobs.length),1);await capture('pending-action',{audit:true});await page.evaluate(()=>window.jobs[0].reject(new Error('offline')));await page.waitForFunction(()=>document.querySelector('[data-demo="alert-action"]').getAttribute('aria-busy')==='false');assert.equal(await page.getByRole('status').innerText(),'The archive is offline. Try again.');assert.equal(await dismiss.isDisabled(),false);await capture('failed-action',{audit:true});await action.focus();await action.press('Space');assert.equal(await page.getByRole('status').innerText(),'');await page.evaluate(()=>window.jobs[1].resolve());await page.waitForFunction(()=>document.querySelector('[data-demo="alert-action"]').getAttribute('aria-busy')==='false');assert.equal(await page.getByRole('status').innerText(),'');await dismiss.click();assert.equal(await page.evaluate(()=>window.dismisses),1);assert.equal(await page.getByRole('heading',{name:'Your export is ready',exact:true}).count(),1,'Dismissal remains a synchronous host request until the host removes the notice');assert.equal(await page.evaluate(()=>window.jobs.length),2);
}
async function equivalentRerender({page,mount,assert,capture}) {
 await mount(`function Host(){const[tick,setTick]=React.useState(0);const[error,setError]=React.useState('Old failure copy');window.refreshAlert=()=>setTick(tick=>tick+1);window.rewordError=()=>setError('Current failure copy');window.alertTick=tick;window.currentAlertError=error;return <Subject.InlineAlert errorMessage={error} onAction={()=>new Promise((resolve,reject)=>window.job={resolve,reject})}/>};createRoot(document.getElementById('root')).render(<Host/>);`);const action=page.locator('[data-demo="alert-action"]');await action.click();await page.evaluate(()=>window.refreshAlert());await page.waitForFunction(()=>window.alertTick===1);assert.equal(await action.isDisabled(),true,'Equivalent host renders retain the pending action despite a new callback identity');await page.evaluate(()=>window.rewordError());await page.waitForFunction(()=>window.currentAlertError==='Current failure copy');assert.equal(await action.isDisabled(),true);await capture('retained-pending-render',{audit:true});await page.evaluate(()=>window.job.reject(new Error('failure')));await page.waitForFunction(()=>document.querySelector('[role=status]').textContent==='Current failure copy');assert.equal(await action.isDisabled(),false);
}
async function changedRevision({page,mount,assert,capture}) {
 await revisionRegression({page,mount,assert});assert.equal(await page.getByRole('status').innerText(),'');await capture('retired-reply-isolated',{audit:true});
}
async function unmountWorkflow({page,mount,assert,capture}) {
 await mount(`window.jobs=[];function Host(){const[shown,setShown]=React.useState(true);window.hideAlert=()=>setShown(false);window.showAlert=()=>setShown(true);return shown?<Subject.InlineAlert onAction={()=>new Promise((resolve,reject)=>window.jobs.push({resolve,reject}))}/>:null};createRoot(document.getElementById('root')).render(<Host/>);`);await page.locator('[data-demo="alert-action"]').click();await page.evaluate(()=>window.hideAlert());await page.waitForFunction(()=>!document.querySelector('section'));await page.evaluate(()=>window.showAlert());await page.locator('[data-demo="alert-action"]').waitFor();await page.locator('[data-demo="alert-action"]').click();await page.evaluate(()=>window.jobs[0].reject(new Error('retired instance')));await page.waitForTimeout(50);assert.equal(await page.locator('[data-demo="alert-action"]').isDisabled(),true);assert.equal(await page.getByRole('status').innerText(),'');await page.evaluate(()=>window.jobs[1].resolve());await page.waitForFunction(()=>document.querySelector('[data-demo="alert-action"]').getAttribute('aria-busy')==='false');await capture('fresh-instance-after-unmount',{audit:true});
}
async function unconfiguredWorkflow({page,mount,assert,capture}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.InlineAlert/>);`);assert.equal(await page.getByRole('button').count(),0);assert.equal(await page.getByRole('heading',{name:'Your export is ready',exact:true}).count(),1);await capture('informational-alert',{audit:true});
}
async function independentAlerts({page,mount,assert,capture}) {
 await page.setViewportSize({width:320,height:1800});await mount(`window.actions=[];createRoot(document.getElementById('root')).render(<><Subject.InlineAlert title="The research and editorial document archive is ready for the whole working group" description="The completed archive includes every original document, the shared research notes and the full set of supporting attachments." actionLabel="Open the complete research and documentation archive" onAction={()=>window.actions.push('first')} onDismiss={()=>window.actions.push('dismiss-first')}/><Subject.InlineAlert title="Independent archive" tone="warning" actionLabel="Open second archive" onAction={()=>window.actions.push('second')}/></>);`);await page.getByRole('button',{name:'Open second archive',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.actions),['second']);assert.equal(await page.locator('section h2').evaluateAll(nodes=>new Set(nodes.map(n=>n.id)).size),2);assert.ok(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth));await capture('long-independent-alerts',{audit:true});await page.setViewportSize({width:390,height:1600});
}
async function pendingFocusRegression({page,mount,assert,capture}) {
 await mount(`window.alertRuns=0;createRoot(document.getElementById('root')).render(<><Subject.InlineAlert onAction={()=>{window.alertRuns++;return new Promise(resolve=>window.completeAlert=resolve)}}/><button type="button">Outside notice</button></>);`);
 const action=page.locator('[data-demo="alert-action"]');await action.focus();await action.press('Enter');
 await page.waitForFunction(()=>document.querySelector('[data-demo="alert-action"]').getAttribute('aria-busy')==='true');
 assert.equal(await action.evaluate(node=>node===document.activeElement),true,'Pending alert action retains keyboard focus while activation is locked');
 assert.equal(await action.getAttribute('aria-disabled'),'true');
 await action.press('Enter');await action.press('Space');await page.evaluate(()=>document.querySelector('[data-demo="alert-action"]').click());
 assert.equal(await page.evaluate(()=>window.alertRuns),1,'Locked keyboard and pointer actions cannot start a second operation');
 await capture('pending-focus-retained',{audit:true});
 await page.evaluate(()=>window.completeAlert());
 await page.waitForFunction(()=>document.querySelector('[data-demo="alert-action"]').getAttribute('aria-busy')==='false');
 assert.equal(await action.evaluate(node=>node===document.activeElement),true);
 await action.press('Space');await page.waitForFunction(()=>document.querySelector('[data-demo="alert-action"]').getAttribute('aria-busy')==='true');
 await action.press('Tab');const outside=page.getByRole('button',{name:'Outside notice',exact:true});assert.equal(await outside.evaluate(node=>node===document.activeElement),true);
 await page.evaluate(()=>window.completeAlert());await page.waitForFunction(()=>document.querySelector('[data-demo="alert-action"]').getAttribute('aria-busy')==='false');
 assert.equal(await outside.evaluate(node=>node===document.activeElement),true,'An accepted action leaves focus outside after the user tabs away');
 assert.equal(await page.evaluate(()=>window.alertRuns),2);
}
export async function check({page,mount,assert,capture=async()=>{}}) {
 for(const test of [retryWorkflow,equivalentRerender,changedRevision,unmountWorkflow,unconfiguredWorkflow,independentAlerts,pendingFocusRegression])await test({page,mount,assert,capture});await immediateDismissLock({page,mount,assert});await motionRegression({page,mount,assert});await capture('live-reduced-motion',{audit:true});await page.emulateMedia({reducedMotion:'reduce'});
}
