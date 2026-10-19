export async function check(context){
 const{page,mount,assert,capture=async()=>{}}=context;
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:900,height:1600});
 await mount(`function Host(){const[view,setView]=React.useState('one');window.setWorkspaceView=setView;return <><Subject.WorkspaceShell title="A working group" activeId={view} onNavigate={setView} links={[{id:'one',label:'First view',href:'#one'},{id:'two',label:'Second view',href:'#two'}]}><Subject.WorkspacePanels activeId={view} panels={[{id:'one',content:<section id="one" role="tabpanel" aria-label="First view"><button type="button" onClick={()=>setView('two')}>Finish first view</button></section>},{id:'two',content:<section id="two" role="tabpanel" aria-label="Second view"><label>Retained draft<input aria-label="Retained draft" defaultValue=""/></label></section>}]}/></Subject.WorkspaceShell><button type="button">Outside action</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const first=page.getByRole('tab',{name:'First view',exact:true}),second=page.getByRole('tab',{name:'Second view',exact:true});
 await page.getByRole('button',{name:'Finish first view',exact:true}).focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.activeElement?.dataset.demo==='nav-two');assert.equal(await second.getAttribute('aria-selected'),'true');assert.equal(await page.locator('[data-workspace-panel="one"]').getAttribute('inert'),'');
 const draft=page.getByRole('textbox',{name:'Retained draft',exact:true});await draft.fill('Keep the research note through view changes.');await capture('retained-draft',{audit:true});
 await first.focus();await first.press('Enter');assert.equal(await page.getByRole('textbox',{name:'Retained draft',exact:true}).count(),0);
 await first.press('ArrowRight');await draft.waitFor();assert.equal(await draft.inputValue(),'Keep the research note through view changes.');assert.equal(await second.evaluate(node=>node===document.activeElement),true);await capture('keyboard-view',{audit:true});
 const external=page.getByRole('button',{name:'Outside action',exact:true});await external.focus();await page.evaluate(()=>window.setWorkspaceView('one'));await page.getByRole('button',{name:'Finish first view',exact:true}).waitFor();assert.equal(await external.evaluate(node=>node===document.activeElement),true,'Explicit host focus stays with the host');
 await mount(`createRoot(document.getElementById('root')).render(<Subject.WorkspaceShell title="A new workspace" links={[]}><Subject.WorkspacePanels activeId="missing" panels={[]}/></Subject.WorkspaceShell>);`);assert.equal(await page.getByRole('tab').count(),0);assert.equal(await page.locator('[data-workspace-panel]').count(),0);await capture('empty-workspace',{audit:true});
 for(const test of[outside,heading,height,changedHeading,narrowIdentity])await test(context);await page.emulateMedia({reducedMotion:'reduce'});
}

async function changedHeading({page,assert,capture=async()=>{}}) {
 const base=process.env.PREVIEW_BASE??'http://localhost:3100';
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1440,height:940});
 await page.goto(base+'/preview/layout-workspace-shell',{waitUntil:'domcontentloaded'});
 await page.locator('[data-preview-slug="layout-workspace-shell"][data-preview-ready="true"]').waitFor({timeout:45000});
 await page.evaluate(()=>document.fonts.ready);
 for(const [view,title]of[['projects','Projects'],['activity','Activity'],['overview','Monday, 13 October'],['projects','Projects']]){
  await page.locator(`[data-demo="nav-${view}"]:visible`).click();
  await page.waitForFunction(title=>{
   const heading=document.querySelector('header h2'),subtitle=heading?.nextElementSibling;
   return heading?.textContent===title&&getComputedStyle(heading).opacity==='1'&&
    getComputedStyle(heading).filter==='none'&&subtitle&&getComputedStyle(subtitle).opacity==='1';
  },title,{polling:'raf',timeout:2000});
  assert.equal(await page.locator('header h2').first().innerText(),title);
 }
 await capture('changed-heading');
}

async function outside({page,mount,assert}) {
 await page.setViewportSize({width:900,height:1600});
 await mount(`function Host(){const[view,setView]=React.useState('one');window.replaceWorkspaceView=()=>setView('two');return <Subject.WorkspaceShell className="h-[500px]" title="A working group" activeId={view} onNavigate={setView} links={[{id:'one',label:'First view',href:'#one'},{id:'two',label:'Second view',href:'#two'}]}><Subject.WorkspacePanels fill activeId={view} panels={[{id:'one',content:<button type="button">First action</button>},{id:'two',content:<button type="button">Second action</button>}]}/></Subject.WorkspaceShell>};createRoot(document.getElementById('root')).render(<Host/>);`);
 await page.locator('#root > div').evaluate(node=>node.style.height='500px');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.getByRole('button',{name:'First action',exact:true}).focus();
 assert.equal(await page.evaluate(()=>document.hasFocus()),true,'The focus fixture owns the active document');
 const box=await page.locator('#root > div').boundingBox();assert.ok(box.y+box.height+32<1600);
 await page.mouse.click(4,box.y+box.height+32);
 assert.equal(await page.evaluate(()=>document.activeElement===document.body),true);
 await page.evaluate(()=>window.replaceWorkspaceView());
 await page.waitForFunction(()=>document.querySelector('[data-workspace-panel="two"]').getAttribute('inert')===null);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.evaluate(()=>document.activeElement===document.body),true,'A primary blank-space click retires workspace focus ownership');
}

async function heading({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'no-preference'});
 await mount(`function Host(){const[shown,setShown]=React.useState(false);window.showWorkspace=()=>setShown(true);return shown?<Subject.WorkspaceShell title="A working group" subtitle="A shared view of the current work."/>:null};createRoot(document.getElementById('root')).render(<Host/>);`);
 await page.evaluate(()=>window.showWorkspace());
 await page.waitForFunction(()=>{const heading=document.querySelector('h2');if(!heading)return false;const opacity=Number(getComputedStyle(heading).opacity);return opacity>0&&opacity<.9},null,{polling:'raf'});
 await page.emulateMedia({reducedMotion:'reduce'});
 const pose=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const style=getComputedStyle(document.querySelector('h2'));resolve({y:new DOMMatrixReadOnly(style.transform).m42,blur:style.filter==='none'?0:Number(style.filter.match(/blur\(([^p]+)px\)/)?.[1]??0)})}))));
 assert.ok(Math.abs(pose.y)<.01&&Math.abs(pose.blur)<.01,'Live reduced motion settles workspace heading transforms immediately');
}

async function height({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'no-preference'});
 await mount(`function Host(){const[view,setView]=React.useState('one');window.expandWorkspace=()=>setView('two');return <Subject.WorkspacePanels activeId={view} panels={[{id:'one',content:<div style={{height:120}}>First view</div>},{id:'two',content:<div style={{height:440}}>Second view</div>}]}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 assert.ok(Math.abs((await page.locator('#root > div').boundingBox()).height-120)<1,'The first measured panel has its actual content height');
 await page.evaluate(()=>window.expandWorkspace());
 await page.waitForFunction(()=>{const h=document.querySelector('#root > div').getBoundingClientRect().height;return h>140&&h<400},null,{polling:'raf'});
 await page.emulateMedia({reducedMotion:'reduce'});
 const height=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(document.querySelector('#root > div').getBoundingClientRect().height)))));
 assert.ok(Math.abs(height-440)<1,'Live reduced motion settles the measured workspace panel height immediately');
}


async function narrowIdentity({ page, mount, assert, capture = async () => {} }) {
 const viewport = page.viewportSize();
 await page.emulateMedia({ reducedMotion: 'reduce' });
 try {
  for (const width of [320, 390]) {
   await page.setViewportSize({ width, height: 940 });
   await mount(`createRoot(document.getElementById('root')).render(<Subject.WorkspaceShell brand="Lex Spring Commercial and Property" title="A long service agreement for the Northline international operations team" links={[]} className="h-[820px]"><p>Review the current matter and its reporting dates.</p></Subject.WorkspaceShell>);`);
   const geometry = await page.evaluate(() => {
    const frame = document.querySelector('aside').parentElement.parentElement.getBoundingClientRect();
    const label = document.querySelector('aside span.truncate'), box = label.getBoundingClientRect();
    return { width: innerWidth, overflow: document.documentElement.scrollWidth, frame: frame.toJSON(), label: box.toJSON() };
   });
   assert.ok(geometry.overflow <= width + 1, 'A long workspace identity cannot widen the phone document');
   assert.ok(geometry.label.left >= geometry.frame.left && geometry.label.right <= geometry.frame.right, 'The brand remains inside its rail');
   assert.equal(await page.getByRole('heading', { name: 'A long service agreement for the Northline international operations team', exact: true }).isVisible(), true);
   await capture('long-identity-' + width, { audit: true });
  }
 } finally {
  if (viewport) await page.setViewportSize(viewport);
 }
}
