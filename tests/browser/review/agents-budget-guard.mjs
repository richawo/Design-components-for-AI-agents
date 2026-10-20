// Decision retry snapshots, panel focus ownership and invalid budget boundaries.
export async function check({page,mount,assert}) {
 await mount(`window.guardJobs=[];createRoot(document.getElementById('root')).render(<Subject.AgentsBudgetGuard onDecision={decision=>new Promise((resolve,reject)=>window.guardJobs.push({decision:{...decision},resolve,reject}))}/>);`);
 const raise=page.locator('[data-demo="raise"]');await raise.focus();await raise.press('r');
 const cap=page.getByRole('textbox',{name:'New spend cap',exact:true});await cap.waitFor();await cap.fill('75');await cap.press('Enter');
 const confirm=page.locator('[data-demo="raise-confirm"]');await confirm.focus();await confirm.press('Space');
 assert.equal(await confirm.isDisabled(),true);assert.equal(await page.evaluate(()=>window.guardJobs.length),1);
 await page.evaluate(()=>window.guardJobs[0].reject(new Error('The decision service is offline.')));
 await page.getByRole('alert').filter({hasText:'The decision service is offline.'}).waitFor();
 assert.match(await cap.inputValue(),/75/);assert.equal(await confirm.isEnabled(),true);
 await confirm.focus();await confirm.press('Enter');await page.waitForFunction(()=>window.guardJobs.length===2);
 const requests=await page.evaluate(()=>window.guardJobs.map(job=>job.decision));
 assert.deepEqual(requests.map(({verdict,cap})=>({verdict,cap})),[{verdict:'raise',cap:75},{verdict:'raise',cap:75}]);
 assert.ok(requests.every(request=>Number.isFinite(request.at)&&request.at>0));
 await page.evaluate(()=>window.guardJobs[1].resolve());
 await page.getByText(/Spend cap raised to.*75/).first().waitFor();
 await page.locator('[data-demo="raise-confirm"]').waitFor({state:'hidden'});
 assert.equal(await page.getByRole('alert').count(),0);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AgentsBudgetGuard history={[]}/>);`);
 await page.locator('[data-demo="raise"]').focus();await page.locator('[data-demo="raise"]').press('r');
 const restoredCap=page.getByRole('textbox',{name:'New spend cap',exact:true});await restoredCap.waitFor();assert.equal(await restoredCap.evaluate(node=>node===document.activeElement),true);await page.keyboard.press('Escape');
 await page.getByRole('group',{name:'Raise the spend cap',exact:true}).waitFor({state:'hidden'});
 assert.equal(await page.locator('[data-demo="raise"]').evaluate(node=>node===document.activeElement),true);
 const stop=page.locator('[data-demo="stop"]');await stop.focus();await stop.press('s');
 const paused=page.getByRole('button',{name:'Keep it paused',exact:true});await paused.waitFor();assert.equal(await paused.evaluate(node=>node===document.activeElement),true);
 await page.keyboard.press('Escape');await page.getByRole('group',{name:'Stop the run',exact:true}).waitFor({state:'hidden'});await stop.waitFor();assert.equal(await stop.evaluate(node=>node===document.activeElement),true);
 // The outgoing action/panel remains mounted briefly. An outside choice owns focus throughout that wait.
 for(const removed of [false,true]){
  await page.evaluate(()=>{const outside=document.createElement('button');outside.id='outside-guard';outside.textContent='Another task';document.body.append(outside);const opener=document.querySelector('[data-demo="raise"]');opener.focus();opener.click();outside.focus();});
  await restoredCap.waitFor();assert.equal(await page.locator('#outside-guard').evaluate(node=>node===document.activeElement),true,'Opening a delayed panel cannot steal outside focus');
  await restoredCap.focus();
  await restoredCap.evaluate((input,remove)=>{input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));const outside=document.getElementById('outside-guard');outside.focus();if(remove)outside.remove();},removed);
  await page.getByRole('group',{name:'Raise the spend cap',exact:true}).waitFor({state:'hidden'});await page.locator('[data-demo="raise"]').waitFor();
  assert.equal(await page.evaluate(remove=>document.activeElement===(remove?document.body:document.getElementById('outside-guard')),removed),true,'A returning action cannot recover focus after an outside interaction');
  await page.locator('#outside-guard').evaluateAll(nodes=>nodes.forEach(node=>node.remove()));
 }
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AgentsBudgetGuard budgets={[]} history={[]}/>);`);
 assert.equal(await page.getByRole('list',{name:'Budgets after this step',exact:true}).getByRole('listitem').count(),0);
 assert.equal(await page.locator('[data-demo="raise"]').count(),0);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AgentsBudgetGuard budgets={[{id:'bad',label:'Invalid spend',kind:'money',used:NaN,next:1,cap:10},{id:'count',label:'Tool calls',kind:'count',used:2,next:1,cap:5}]} history={[]}/>);`);
 assert.equal(await page.getByRole('list',{name:'Budgets after this step',exact:true}).getByRole('listitem').count(),1);
 assert.equal(await page.getByText('Invalid spend',{exact:true}).count(),0);
 assert.ok(await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)<=innerWidth));
}
