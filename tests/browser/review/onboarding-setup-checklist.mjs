async function copies({page,mount,assert}) {
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.SetupChecklist onChange={ids=>{window.changes.push([...ids]);ids.push('invisible-task')}}/>);`);
  await page.locator('[data-demo="complete-1"]').focus();await page.locator('[data-demo="complete-1"]').press('Space');
  await page.locator('[data-demo="complete-2"]').focus();await page.locator('[data-demo="complete-2"]').press('Space');
  assert.deepEqual(await page.evaluate(()=>window.changes),[['profile','sources'],['profile','sources','question']],'Setup notifications cannot mutate the stored completion draft');
}


async function readOnlyCase({page,mount,assert}) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SetupChecklist completed={[]}/>);`);
  assert.equal(await page.locator('[data-demo="complete-1"]').isDisabled(),true,'Controlled setup completion without a writer is read-only');
  await page.locator('[data-demo="setup-task-1"]').focus();await page.locator('[data-demo="setup-task-1"]').press('Enter');
  assert.equal(await page.locator('[data-demo="setup-task-1"]').getAttribute('aria-expanded'),'false');
}


async function focusCase({page,mount,assert}) {
  await mount(`function Host(){const[tasks,setTasks]=React.useState([{id:'a',title:'Alpha task',description:'One useful step.',duration:'2 min'},{id:'b',title:'Beta task',description:'The next useful step.',duration:'3 min'}]);window.reverseTasks=()=>setTasks(tasks=>[...tasks].reverse());return <Subject.SetupChecklist tasks={tasks} defaultCompleted={[]}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const check=page.getByRole('checkbox',{name:'Complete Beta task',exact:true});await check.focus();await check.press('Space');await page.evaluate(()=>window.reverseTasks());
  assert.equal(await check.evaluate(node=>node===document.activeElement),true,'Reordering task IDs retains checkbox focus');assert.equal(await check.isChecked(),true);
}


async function liveMotion({page,mount,assert}) {
  await page.emulateMedia({reducedMotion:'no-preference'});await mount(`createRoot(document.getElementById('root')).render(<Subject.SetupChecklist/>);`);
  await page.locator('[data-demo="complete-1"]').click();
  await page.waitForFunction(()=>{const offset=parseFloat(getComputedStyle(document.querySelector('svg circle:last-child')).strokeDashoffset);return offset>60&&offset<115},null,{timeout:1500,polling:'raf'});
  await page.emulateMedia({reducedMotion:'reduce'});
  const offset=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(parseFloat(getComputedStyle(document.querySelector('svg circle:last-child')).strokeDashoffset))))));
  assert.ok(Math.abs(offset-176/3)<.2,'Live reduced motion settles the setup completion ring: '+offset);
}


async function contrastCase({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.SetupChecklist/>);`);
 const colors=await page.locator('[data-demo="complete-2"]').evaluate(input=>{const background=getComputedStyle(input.closest('section')).backgroundColor,border=getComputedStyle(input).borderTopColor,canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');const sample=color=>{context.clearRect(0,0,1,1);context.fillStyle=background;context.fillRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3)};return{border:sample(border),background:sample(background)}});
 const luminance=rgb=>rgb.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
 const a=luminance(colors.border),b=luminance(colors.background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 assert.ok(ratio>=3,'Unchecked setup checkbox boundaries retain3:1 contrast: '+JSON.stringify({ratio,colors}));
}


async function singular({page,mount,assert}) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SetupChecklist/>);`);
  await page.locator('[data-demo="complete-1"]').focus();await page.locator('[data-demo="complete-1"]').press('Space');
  assert.equal(await page.getByRole('status').innerText(),'1 step left. Pick up wherever you like.','One remaining setup step uses singular copy');
}


export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:1800});
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.SetupChecklist onChange={ids=>window.changes.push([...ids])}/>);`);
  assert.equal(await page.getByRole('img').getAttribute('aria-label'),'1 of 3 steps complete');
  assert.equal(await page.locator('[data-demo="setup-task-1"]').getAttribute('aria-expanded'),'true');
  const sources=page.getByRole('checkbox',{name:'Complete Add your first source',exact:true});await sources.focus();await sources.press('Space');
  assert.equal(await sources.isChecked(),true);assert.equal(await sources.evaluate(node=>node===document.activeElement),true);
  assert.equal(await page.getByRole('img').getAttribute('aria-label'),'2 of 3 steps complete');
  assert.equal(await page.getByRole('status').innerText(),'1 step left. Pick up wherever you like.');await capture('one-step-left',{audit:true});
  const question=page.locator('[data-demo="setup-task-2"]');await question.focus();await question.press('Enter');
  assert.equal(await question.getAttribute('aria-expanded'),'true');assert.equal(await page.locator('[data-demo="setup-task-1"]').getAttribute('aria-expanded'),'false');
  const panelId=await question.getAttribute('aria-controls');assert.equal(await page.locator('[id='+JSON.stringify(panelId)+']').isVisible(),true);
  await capture('question-instructions',{audit:true});
  await page.getByRole('checkbox',{name:'Complete Ask a real question',exact:true}).focus();await page.getByRole('checkbox',{name:'Complete Ask a real question',exact:true}).press('Space');
  assert.equal(await page.getByRole('img').getAttribute('aria-label'),'3 of 3 steps complete');assert.equal(await page.getByRole('status').innerText(),'Everything on your list is complete.');
  await capture('all-complete',{audit:true});
  const profile=page.getByRole('checkbox',{name:'Complete Make it yours',exact:true});await profile.focus();await profile.press('Space');
  assert.equal(await page.getByRole('img').getAttribute('aria-label'),'2 of 3 steps complete');
  assert.deepEqual(await page.evaluate(()=>window.changes),[['profile','sources'],['profile','sources','question'],['sources','question']]);await capture('reopened-step',{audit:true});

  await mount(`window.proposals=[];window.accept=false;function Host(){const[completed,setCompleted]=React.useState([]);return <Subject.SetupChecklist completed={completed} onChange={ids=>{window.proposals.push([...ids]);if(window.accept)setCompleted(ids)}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const controlled=page.locator('[data-demo="complete-1"]');await controlled.focus();await controlled.press('Space');
  assert.equal(await controlled.isChecked(),false);assert.equal(await page.getByRole('img').getAttribute('aria-label'),'0 of 3 steps complete');
  await page.evaluate(()=>window.accept=true);await controlled.press('Space');assert.equal(await controlled.isChecked(),true);
  assert.deepEqual(await page.evaluate(()=>window.proposals),[['sources'],['sources']]);await capture('controlled-acknowledgement',{audit:true});

  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.SetupChecklist tasks={[{id:'a',title:'First setup step',description:'First instruction.',duration:'2 min'},{id:'b',title:'Second setup step',description:'Second instruction.',duration:'3 min'}]} defaultCompleted={['missing','a','a']} onChange={ids=>window.changes.push([...ids])}/>);`);
  assert.equal(await page.getByRole('img').getAttribute('aria-label'),'1 of 2 steps complete');await page.getByRole('checkbox',{name:'Complete Second setup step',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.changes),[['a','b']]);assert.equal(await page.getByRole('status').innerText(),'Everything on your list is complete.');await capture('normalized-completions',{audit:true});

  await mount(`function Host(){const[tasks,setTasks]=React.useState([]);window.loadTasks=()=>setTasks([{id:'next',title:'A useful first step',description:'Choose one source to get started.',duration:'2 min'}]);return <Subject.SetupChecklist tasks={tasks}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  assert.equal(await page.getByRole('status').innerText(),'No setup tasks configured.');assert.equal(await page.getByRole('checkbox').count(),0);assert.equal(await page.getByRole('img').getAttribute('aria-label'),'0 of 0 steps complete');
  await capture('empty-tasks',{audit:true});await page.evaluate(()=>window.loadTasks());
  const arrived=page.getByRole('checkbox',{name:'Complete A useful first step',exact:true});await arrived.waitFor();await arrived.click();
  assert.equal(await page.getByRole('img').getAttribute('aria-label'),'1 of 1 steps complete');assert.equal(await page.getByRole('status').innerText(),'Everything on your list is complete.');

  await page.setViewportSize({width:320,height:2200});
  await mount(`const tasks=[{id:'long',title:'Connect the research and design workspace for the international working group',description:'Choose one useful document and invite the people who will work with it. '.repeat(3),duration:'About five minutes with your team'}];createRoot(document.getElementById('root')).render(<><Subject.SetupChecklist title="A useful home for the research and design team" description="Start with the work you already have and build from there." tasks={tasks}/><Subject.SetupChecklist title="Independent checklist" tasks={tasks}/></>);`);
  const sections=page.locator('section');await sections.first().getByRole('button',{name:/Connect the research/}).click();await sections.first().getByRole('checkbox').click();
  assert.equal(await sections.last().getByRole('checkbox').isChecked(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);return ids.filter((id,index)=>ids.indexOf(id)!==index)}),[]);await capture('long-independent-checklists',{audit:true});

  await page.setViewportSize({width:390,height:1800});
  for(const test of [copies,readOnlyCase,focusCase,liveMotion,contrastCase,singular])await test({page,mount,assert});
  await page.emulateMedia({reducedMotion:'reduce'});
}
