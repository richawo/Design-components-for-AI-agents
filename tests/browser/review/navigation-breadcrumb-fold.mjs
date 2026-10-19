import fs from 'node:fs';
async function reorderRegression({page,mount,assert}) {
 await mount(`function Host(){const[items,setItems]=React.useState([{label:'Workspace A',href:'#a'},{label:'Projects B',href:'#b'},{label:'Current C',href:'#c'}]);window.reverseAncestors=()=>setItems(items=>[items[1],items[0],items[2]]);return <Subject.BreadcrumbFold items={items}/>};createRoot(document.getElementById('root')).render(<Host/>);`);const target=page.getByRole('link',{name:'Workspace A',exact:true});await target.focus();await page.evaluate(()=>window.reverseAncestors());await page.waitForFunction(()=>document.querySelector('nav a').textContent.includes('Projects B'));assert.equal(await target.evaluate(n=>n===document.activeElement),true,'Changing ancestor positions retains focused breadcrumb identity');
}


async function shortFocusRegression({page,mount,assert}) {
 await mount(`function Host(){const[items,setItems]=React.useState([{label:'Workspace',href:'#workspace'},{label:'Projects',href:'#projects'},{label:'Studio',href:'#studio'},{label:'Identity',href:'#identity'},{label:'Specimens',href:'#specimens'}]);window.shortenPath=()=>setItems([{label:'Current location',href:'#current'}]);return <Subject.BreadcrumbFold items={items}/>};createRoot(document.getElementById('root')).render(<Host/>);`);await page.getByRole('button',{name:'Show full path',exact:true}).click();await page.getByRole('button',{name:'Collapse path',exact:true}).focus();await page.evaluate(()=>window.shortenPath());await page.getByText('Current location',{exact:true}).waitFor();assert.equal(await page.getByRole('navigation').evaluate(n=>n===document.activeElement),true,'Removing focused path controls retains focus on the breadcrumb landmark');
}


async function motionRegression({page,mount,assert}) {
  await page.emulateMedia({reducedMotion:'no-preference'});await mount(`function Host(){const[show,setShow]=React.useState(false);window.showSubject=()=>setShow(true);return show?<Subject.BreadcrumbFold/>:null};createRoot(document.getElementById('root')).render(<Host/>);`);await page.evaluate(()=>window.showSubject());
  await page.waitForFunction(()=>{const section=document.querySelector('nav'),opacity=Number(getComputedStyle(section).opacity);return opacity>0&&opacity<.95},null,{timeout:1500,polling:'raf'});
  await page.emulateMedia({reducedMotion:'reduce'});
  const frame=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const style=getComputedStyle(document.querySelector('nav'));resolve({opacity:Number(style.opacity),y:new DOMMatrixReadOnly(style.transform).m42})}))));
  assert.deepEqual(frame,{opacity:1,y:0},'Live reduced motion immediately settles breadcrumb entry');
}


async function workflow({page,mount,assert,capture}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.BreadcrumbFold/>);`);assert.equal(await page.getByRole('link').count(),2);assert.equal(await page.locator('[aria-current="page"]').innerText(),'Type specimens');const expand=()=>page.getByRole('button',{name:'Show full path',exact:true});await expand().focus();await expand().press('Enter');await page.waitForFunction(()=>document.activeElement?.getAttribute('data-demo')==='collapse-path');assert.equal(await page.getByRole('link').count(),4);assert.equal(await page.locator('[aria-current="page"]').evaluate(n=>n.tagName),'SPAN');await capture('expanded-path',{audit:true});await page.getByRole('link',{name:'Projects',exact:true}).focus();await page.getByRole('link',{name:'Projects',exact:true}).press('Enter');assert.ok(page.url().endsWith('#projects'));const collapse=page.getByRole('button',{name:'Collapse path',exact:true});await collapse.focus();await collapse.press('Space');await page.waitForFunction(()=>document.activeElement?.getAttribute('data-demo')==='expand-path');assert.equal(await page.getByRole('link').count(),2);assert.equal(await page.getByRole('link',{name:'Projects',exact:true}).count(),0);assert.equal(await expand().getAttribute('aria-expanded'),'false');const id=await expand().getAttribute('aria-controls');assert.equal(await page.locator('[id='+JSON.stringify(id)+']').count(),1);await capture('folded-path-focus',{audit:true});
}
async function shortPaths({page,mount,assert,capture}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.BreadcrumbFold items={[]}/>);`);assert.equal(await page.getByText('No location selected',{exact:true}).count(),1);assert.equal(await page.getByRole('link').count(),0);assert.equal(await page.getByRole('button').count(),0);await capture('empty-location',{audit:true});await mount(`createRoot(document.getElementById('root')).render(<Subject.BreadcrumbFold items={[{label:'Current only',href:'#current'}]}/>);`);assert.equal(await page.getByRole('link').count(),0);assert.equal(await page.getByRole('button').count(),0);assert.equal(await page.locator('[aria-current="page"]').innerText(),'Current only');await capture('single-location',{audit:true});await mount(`createRoot(document.getElementById('root')).render(<Subject.BreadcrumbFold items={[{label:'Workspace',href:'#workspace'},{label:'Projects',href:'#projects'},{label:'Current',href:'#current'}]}/>);`);assert.equal(await page.getByRole('link').count(),2);assert.equal(await page.getByRole('button').count(),0);assert.equal(await page.locator('[aria-current="page"]').innerText(),'Current');
}
async function independentPaths({page,mount,assert,capture}) {
 await page.setViewportSize({width:320,height:1800});await mount(`createRoot(document.getElementById('root')).render(<><Subject.BreadcrumbFold label="Research path" items={[{label:'Research and editorial workspace',href:'#research'},{label:'Shared project records',href:'#shared'},{label:'Documentation for the whole working group',href:'#documentation'},{label:'The current research and typography specimen',href:'#current'}]}/><Subject.BreadcrumbFold label="Independent path"/></>);`);const first=page.getByRole('navigation',{name:'Research path',exact:true}),second=page.getByRole('navigation',{name:'Independent path',exact:true});await first.getByRole('button',{name:'Show full path',exact:true}).click();await first.getByRole('button',{name:'Collapse path',exact:true}).waitFor();assert.equal(await second.getByRole('button',{name:'Show full path',exact:true}).getAttribute('aria-expanded'),'false');assert.equal(await page.locator('ol').evaluateAll(nodes=>new Set(nodes.map(n=>n.id)).size),2);assert.ok(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth));await capture('long-independent-paths',{audit:true});await page.setViewportSize({width:390,height:1600});
}
async function outsideFocus({page,mount,assert}) {
 await mount(`function Host(){const[items,setItems]=React.useState([{label:'Workspace',href:'#workspace'},{label:'Projects',href:'#projects'},{label:'Studio',href:'#studio'},{label:'Identity',href:'#identity'},{label:'Current',href:'#current'}]);window.replacePath=()=>setItems([{label:'New location',href:'#new'}]);return <><Subject.BreadcrumbFold items={items}/><button type="button">Outside path</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);await page.getByRole('button',{name:'Show full path',exact:true}).click();const outside=page.getByRole('button',{name:'Outside path',exact:true});await outside.focus();await page.evaluate(()=>window.replacePath());await page.getByText('New location',{exact:true}).waitFor();assert.equal(await outside.evaluate(n=>n===document.activeElement),true,'A later path replacement keeps focus outside when the user has left the breadcrumb');
}
async function blankSpaceFocus({page,mount,assert}) {
 await mount(`function Host(){const[items,setItems]=React.useState([{label:'Workspace',href:'#workspace'},{label:'Projects',href:'#projects'},{label:'Studio',href:'#studio'},{label:'Identity',href:'#identity'},{label:'Current',href:'#current'}]);window.replacePath=()=>setItems([]);return <Subject.BreadcrumbFold items={items}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 await page.getByRole('button',{name:'Show full path',exact:true}).click();
 await page.getByRole('button',{name:'Collapse path',exact:true}).focus();
 await page.mouse.click(4,800);
 assert.equal(await page.evaluate(()=>document.activeElement===document.body),true);
 await page.evaluate(()=>window.replacePath());
 await page.getByText('No location selected',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.activeElement===document.body),true,'Replacing a path after a primary blank-space click does not reclaim focus');
}
async function publishedPhonePreview({page,mount,assert,capture}) {
 const meta=JSON.parse(fs.readFileSync(process.env.DFA_DRAFT_QA_META??'registry/free/navigation-breadcrumb-fold/meta.json'));
 for(const width of [320,390]) {
  await page.setViewportSize({width,height:meta.previewHeight});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
  await page.locator('#root').evaluate(node=>{node.style.padding='0';node.style.maxWidth='none';node.style.width='100%';node.style.minHeight='100vh'});
  for(let state=0;state<3;state++) {
   if(state===1)await page.locator('[data-demo="expand-path"]').click();
   if(state===2)await page.locator('[data-demo="collapse-path"]').click();
   const box=await page.getByRole('navigation').boundingBox();
   assert.ok(box.y>=16&&box.y+box.height<=meta.previewHeight-16,'The published phone preview contains every folded and expanded ancestor');
   assert.equal(await page.getByRole('link').count(),state===1?4:2);
  }
  await capture('published-phone-'+width,{audit:true});
 }
 await page.setViewportSize({width:390,height:1600});
}
export async function check({page,mount,assert,capture=async()=>{}}) {
 for(const test of [workflow,shortPaths,independentPaths,outsideFocus,blankSpaceFocus,publishedPhonePreview])await test({page,mount,assert,capture});await reorderRegression({page,mount,assert});await shortFocusRegression({page,mount,assert});await capture('shortened-path-focus',{audit:true});await motionRegression({page,mount,assert});await capture('live-reduced-path',{audit:true});await page.emulateMedia({reducedMotion:'reduce'});
}
