export async function check({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'reduce'});
 await mount(`window.contextJobs=[];window.contextChanges=[];createRoot(document.getElementById('root')).render(<Subject.AiContextBudget sources={[{id:'system',label:'Workspace rules',kind:'instructions',tokens:1000,required:true},{id:'doc',label:'Release notes',kind:'doc',tokens:4000,relevance:0.2}]} defaultValue={['doc']} budget={5000} reservedTokens={1000} maxReserve={2000} onValueChange={ids=>window.contextChanges.push([...ids])} onConfirm={(ids,total)=>new Promise((resolve,reject)=>window.contextJobs.push({ids:[...ids],total,resolve,reject}))}/>);`);
 const confirm=page.locator('[data-demo="confirm"]');assert.equal(await confirm.isDisabled(),true);
 const trim=page.getByRole('button',{name:'Trim to fit',exact:true});await trim.focus();await trim.press('Enter');
 const optional=page.getByRole('switch',{name:'Include Release notes',exact:true});await page.waitForFunction(()=>document.querySelector('[data-demo="toggle-doc"]').checked===false);
 assert.deepEqual(await page.evaluate(()=>window.contextChanges),[[]]);
 await optional.focus();await optional.press('Space');assert.equal(await optional.isChecked(),true);assert.equal(await confirm.isDisabled(),true);
 await optional.press('Space');assert.equal(await optional.isChecked(),false);
 await confirm.focus();await confirm.press('Enter');await page.waitForFunction(()=>window.contextJobs.length===1);assert.equal(await confirm.getAttribute('aria-busy'),'true');
 await page.evaluate(()=>window.contextJobs[0].reject(new Error('The attachment service is offline.')));
 await page.getByRole('alert').filter({hasText:'The attachment service is offline.'}).waitFor();assert.equal(await optional.isChecked(),false);
 await confirm.focus();await confirm.press('Space');await page.waitForFunction(()=>window.contextJobs.length===2);
 assert.deepEqual(await page.evaluate(()=>window.contextJobs.map(({ids,total})=>({ids,total}))),[{ids:['system'],total:2000},{ids:['system'],total:2000}]);
 await page.evaluate(()=>window.contextJobs[1].resolve());await page.getByRole('button',{name:'Context attached',exact:true}).waitFor();
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AiContextBudget sources={[]} budget={5000} reservedTokens={0}/>);`);assert.equal(await page.getByRole('switch').count(),0);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AiContextBudget sources={[]} status="loading"/>);`);assert.equal(await page.locator('[data-demo="confirm"]').isDisabled(),true);
 assert.equal(await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)<=innerWidth),true);
}
