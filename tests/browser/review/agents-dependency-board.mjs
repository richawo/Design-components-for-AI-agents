// Keyboard task selection, host-owned retry receipts, empty plans and invalid dependencies.
export async function check({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'reduce'});
 await mount(`window.dependencyJobs=[];window.dependencySelections=[];const tasks=[{id:'schema',title:'Prepare schema',agent:'Atlas',estimate:2,status:'done',dependsOn:[]},{id:'repair',title:'Repair the invoice export',agent:'Forge',estimate:6,status:'failed',dependsOn:['schema'],note:'The PDF export timed out.'}];function Host(){const[plan,setPlan]=React.useState(tasks);return <Subject.AgentsDependencyBoard tasks={plan} layout="down" defaultSelectedId="schema" onSelect={task=>window.dependencySelections.push(task.id)} onAction={(task,action)=>new Promise((resolve,reject)=>window.dependencyJobs.push({task:JSON.parse(JSON.stringify(task)),action,reject,resolve:()=>{setPlan(old=>old.map(item=>item.id===task.id?{...item,status:'running',progress:0}:item));resolve()}}))}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const schema=page.locator('[data-demo="node-schema"]'),repair=page.locator('[data-demo="node-repair"]');
 await schema.focus();await schema.press('ArrowDown');
 assert.equal(await repair.evaluate(node=>node===document.activeElement),true);
 assert.equal(await page.evaluate(()=>window.dependencySelections.at(-1)),'repair');
 const action=page.locator('[data-demo="task-action"]');await action.focus();await action.press('Enter');
 await page.waitForFunction(()=>window.dependencyJobs.length===1);
 assert.equal(await action.getAttribute('aria-busy'),'true');
 await action.press('Enter');assert.equal(await page.evaluate(()=>window.dependencyJobs.length),1,'Pending retry sends one request');
 await page.evaluate(()=>window.dependencyJobs[0].reject(new Error('The runner is temporarily unavailable.')));
 await page.getByRole('alert').filter({hasText:'The runner is temporarily unavailable.'}).waitFor();
 assert.equal(await page.getByText('The PDF export timed out.',{exact:true}).count(),1);
 await action.focus();await action.press('Space');await page.waitForFunction(()=>window.dependencyJobs.length===2);
 const calls=await page.evaluate(()=>window.dependencyJobs.map(({task,action})=>({task,action})));
 assert.deepEqual(calls,[{task:{id:'repair',title:'Repair the invoice export',agent:'Forge',estimate:6,status:'failed',dependsOn:['schema'],note:'The PDF export timed out.'},action:'retry'},{task:{id:'repair',title:'Repair the invoice export',agent:'Forge',estimate:6,status:'failed',dependsOn:['schema'],note:'The PDF export timed out.'},action:'retry'}]);
 await page.evaluate(()=>window.dependencyJobs[1].resolve());
 await page.waitForFunction(()=>document.querySelector('[data-demo="node-repair"]').getAttribute('aria-label').includes('Running'));
 await page.getByRole('alert').waitFor({state:'hidden'}); assert.equal(await page.getByRole('alert').count(),0);assert.equal(await action.getAttribute('aria-busy'),'false');
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AgentsDependencyBoard tasks={[]}/>);`);
 assert.equal(await page.locator('[data-node]').count(),0);assert.equal(await page.locator('[data-demo="task-action"]').count(),0);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AgentsDependencyBoard tasks={[{id:'missing',title:'Wait for unavailable input',agent:'Atlas',estimate:3,status:'queued',dependsOn:['absent']},{id:'loop',title:'Review dependency loop',agent:'Forge',estimate:1,status:'queued',dependsOn:['loop']}]}/>);`);
 assert.ok((await page.getByRole('note').allTextContents()).some(text=>text.includes('absent')));
 assert.ok((await page.getByRole('note').allTextContents()).some(text=>text.includes('loops')));
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AgentsDependencyBoard tasks={[{id:'first',title:'First cyclic task',agent:'Atlas',estimate:3,status:'queued',dependsOn:['second']},{id:'second',title:'Second cyclic task',agent:'Forge',estimate:1,status:'queued',dependsOn:['first']},{id:'first',title:'Duplicate must not render',agent:'Atlas',estimate:2,status:'queued',dependsOn:[]}]}/>);`);
 assert.equal(await page.locator('[data-node]').count(),2);
 assert.equal(await page.getByText('Duplicate must not render',{exact:true}).count(),0);
 assert.match((await page.getByRole('note').allTextContents()).join(' '),/One dependency loops/);
 assert.equal(await page.locator('svg').evaluateAll(nodes=>nodes.every(node=>![...node.querySelectorAll('[d],[transform]')].some(child=>/NaN|Infinity/.test((child.getAttribute('d')??'')+' '+(child.getAttribute('transform')??''))))),true,'Removing cyclic edges keeps finite graph geometry');
 assert.equal(await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)<=innerWidth),true);
}
