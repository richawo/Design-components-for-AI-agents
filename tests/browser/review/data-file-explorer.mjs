async function checkCopies({page,mount,assert}){
 await mount(`window.nodes=[{id:'file',name:'button.tsx',kind:'file',detail:'A complete fixture.',children:[{id:'nested',name:'source.ts',kind:'file'}]}];window.chosen=[];createRoot(document.getElementById('root')).render(<Subject.FileExplorer nodes={window.nodes} onSelect={file=>{window.chosen.push(structuredClone(file));file.name='Host mutation';file.children[0].name='Nested mutation'}}/>);`);
 await page.getByRole('button',{name:'button.tsx',exact:true}).focus();await page.getByRole('button',{name:'button.tsx',exact:true}).press('Enter');
 assert.deepEqual(await page.evaluate(()=>window.nodes),[{id:'file',name:'button.tsx',kind:'file',detail:'A complete fixture.',children:[{id:'nested',name:'source.ts',kind:'file'}]}],'Selection notifications cannot mutate the original file graph');
 assert.deepEqual(await page.evaluate(()=>window.chosen),[{id:'file',name:'button.tsx',kind:'file',detail:'A complete fixture.',children:[{id:'nested',name:'source.ts',kind:'file'}]}]);
}

async function checkFocus({page,mount,assert}) {
 await mount(`window.rows=[{id:'a',name:'alpha.tsx',kind:'file',detail:'First file.'},{id:'b',name:'beta.tsx',kind:'file',detail:'Second file.'}];function Host(){const[nodes,setNodes]=React.useState(window.rows);window.reorderFiles=()=>setNodes(rows=>[...rows].reverse());return <Subject.FileExplorer nodes={nodes}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const file=page.getByRole('button',{name:'alpha.tsx',exact:true});await file.focus();await file.press('Enter');await page.evaluate(()=>window.reorderFiles());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await file.evaluate(node=>node===document.activeElement),true,'Reordering file IDs retains the logical file focus');
}

async function checkDepth({page,mount,assert}) {
 await page.setViewportSize({width:320,height:1000});
 await mount(`let node={id:'leaf',kind:'file',name:'final.tsx',detail:'Reachable after the nested folders.'};for(let level=0;level<12;level++)node={id:'folder-'+level,kind:'folder',name:'Folder '+level,children:[node]};createRoot(document.getElementById('root')).render(<Subject.FileExplorer nodes={[node]}/>);`);
 const nav=page.getByRole('navigation');
 const leaf=page.getByRole('button',{name:'final.tsx',exact:true});await leaf.focus();await leaf.scrollIntoViewIfNeeded();
 const geometry=await leaf.evaluate(node=>{const nav=node.closest('nav'),r=node.getBoundingClientRect(),n=nav.getBoundingClientRect();return{width:r.width,left:r.left,right:r.right,navLeft:n.left,navRight:n.right,navScrollLeft:nav.scrollLeft,rootScroll:node.closest('section').scrollLeft};});
 assert.ok(geometry.width>=44&&geometry.left>=geometry.navLeft-.5&&geometry.right<=geometry.navRight+.5,'Deep files remain reachable inside their own navigation region: '+JSON.stringify(geometry));
 assert.equal(geometry.rootScroll,0,'Reading deep files cannot scroll the project heading offscreen');
 assert.equal(await leaf.evaluate(node=>node===document.activeElement),true);await leaf.press('Enter');
 assert.equal(await page.getByText('Reachable after the nested folders.',{exact:true}).count(),1);
}

async function checkReadonly({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.FileExplorer selectedId="readme"/>);`);
 assert.equal(await page.getByRole('button',{name:'button.tsx',exact:true}).isDisabled(),true,'Controlled file selection without a writer is read-only');
 const folder=page.getByRole('button',{name:'src',exact:true});assert.equal(await folder.isEnabled(),true);await folder.click();assert.equal(await folder.getAttribute('aria-expanded'),'false');
 assert.equal(await page.getByText('README.md',{exact:true}).count(),2);
}

async function checkMotion({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'no-preference'});
 await mount(`createRoot(document.getElementById('root')).render(<Subject.FileExplorer/>);`);
 const file=page.getByRole('button',{name:'button.tsx',exact:true});await file.click();
 await page.waitForFunction(()=>{const node=document.querySelector('section > div > div');return node&&Number(getComputedStyle(node).opacity)>0&&Number(getComputedStyle(node).opacity)<.95},null,{timeout:1500,polling:'raf'});
 await page.emulateMedia({reducedMotion:'reduce'});
 const frame=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const node=document.querySelector('section > div > div'),style=getComputedStyle(node);resolve({opacity:Number(style.opacity),y:new DOMMatrixReadOnly(style.transform).m42})}))));
 assert.deepEqual(frame,{opacity:1,y:0},'Live reduced motion immediately finishes the selected file inspector');
 assert.equal(await file.evaluate(node=>node===document.activeElement),true);
}

export async function check({page,mount,assert,capture=async()=>{}}) {
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:1800});
 await mount(`window.selected=[];createRoot(document.getElementById('root')).render(<Subject.FileExplorer onSelect={file=>window.selected.push(file)}/>);`);
 const src=page.getByRole('button',{name:'src',exact:true});
 await src.focus();await src.press('Space');assert.equal(await src.getAttribute('aria-expanded'),'false');assert.equal(await page.getByRole('button',{name:'button.tsx',exact:true}).count(),0);
 await src.press('Enter');assert.equal(await src.getAttribute('aria-expanded'),'true');
 const file=page.getByRole('button',{name:'button.tsx',exact:true});await file.focus();await file.press('Enter');
 assert.equal(await file.getAttribute('aria-pressed'),'true');
 assert.equal(await page.getByRole('region',{name:'button.tsx',exact:true}).getByText('A small, accessible action with honest loading feedback.',{exact:true}).count(),1);
 assert.deepEqual(await page.evaluate(()=>window.selected),[{id:'button',name:'button.tsx',kind:'file',detail:'A small, accessible action with honest loading feedback.'}]);
 await capture('selected-file',{audit:true});
 const folder=page.getByRole('button',{name:'components',exact:true});await folder.focus();await folder.press('Space');
 assert.equal(await page.getByRole('button',{name:'button.tsx',exact:true}).count(),0);assert.equal(await page.getByRole('region',{name:'button.tsx',exact:true}).count(),1);
 await capture('collapsed-folder',{audit:true});

 await mount(`window.accept=false;window.chosen=[];window.files=[{id:'a',name:'alpha.tsx',kind:'file',detail:'Alpha details.'},{id:'b',name:'beta.tsx',kind:'file',detail:'Beta details.'}];function Host(){const[selected,setSelected]=React.useState('a');return <Subject.FileExplorer nodes={window.files} selectedId={selected} onSelect={file=>{window.chosen.push(structuredClone(file));if(window.accept)setSelected(file.id);file.detail='External mutation'}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const beta=page.getByRole('button',{name:'beta.tsx',exact:true});await beta.click();assert.equal(await page.getByRole('region',{name:'alpha.tsx',exact:true}).count(),1);assert.equal(await beta.getAttribute('aria-pressed'),'false');
 await page.evaluate(()=>window.accept=true);await beta.focus();await beta.press('Enter');
 assert.equal(await beta.getAttribute('aria-pressed'),'true');assert.equal(await page.getByRole('region',{name:'beta.tsx',exact:true}).getByText('Beta details.',{exact:true}).count(),1);
 assert.equal(await beta.evaluate(node=>node===document.activeElement),true);assert.equal(await page.evaluate(()=>window.chosen.length),2);assert.equal(await page.evaluate(()=>window.files[1].detail),'Beta details.');
 await capture('controlled-selection',{audit:true});

 await mount(`function Host(){const[nodes,setNodes]=React.useState([]);window.replaceFiles=setNodes;return <Subject.FileExplorer nodes={nodes} defaultSelectedId="missing"/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 assert.equal(await page.getByText('No files in this project.',{exact:true}).count(),1);assert.equal(await page.getByRole('region',{name:'Select a file',exact:true}).count(),1);await capture('empty-project',{audit:true});
 await page.evaluate(()=>window.replaceFiles([{id:'arrived',kind:'file',name:'arrived.tsx',detail:'A newly received file.'}]));await page.getByRole('button',{name:'arrived.tsx',exact:true}).click();assert.equal(await page.getByRole('region',{name:'arrived.tsx',exact:true}).count(),1);await capture('arriving-files',{audit:true});
 await page.evaluate(()=>window.replaceFiles([]));await page.getByRole('region',{name:'Select a file',exact:true}).waitFor();assert.equal(await page.getByRole('region',{name:'arrived.tsx',exact:true}).count(),0);assert.equal(await page.getByRole('region',{name:'Select a file',exact:true}).count(),1);

 await mount(`createRoot(document.getElementById('root')).render(<><Subject.FileExplorer title="A project with a long international release name and documentation" nodes={[{id:'folder [one]',name:'Long working directory',kind:'folder',children:[{id:'opaque \\" file [2]',kind:'file',name:'A_very_long_filename_without_breaks_for_the_international_release.tsx',detail:'Read the complete file description without moving the project title out of view. '.repeat(5)}]}]}/><Subject.FileExplorer title="Independent project"/></>);`);
 const long=page.getByRole('button',{name:'A_very_long_filename_without_breaks_for_the_international_release.tsx',exact:true});await long.focus();await long.press('Enter');assert.equal(await page.getByRole('region',{name:'A_very_long_filename_without_breaks_for_the_international_release.tsx',exact:true}).count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);return ids.filter((id,index)=>ids.indexOf(id)!==index)}),[]);await capture('long-data-independent-projects',{audit:true});

 await mount(`createRoot(document.getElementById('root')).render(<Subject.FileExplorer nodes={Array.from({length:40},(_,index)=>({id:'file-'+index,kind:'file',name:'file-'+String(index).padStart(2,'0')+'.tsx',detail:'A reachable file in a scrolling project.'}))}/>);`);
 const nav=page.getByRole('navigation');await nav.focus();await nav.press('End');const last=page.getByRole('button',{name:'file-39.tsx',exact:true});await last.focus();await last.press('Enter');
 assert.ok(await nav.evaluate(node=>node.scrollTop>0));assert.equal(await last.evaluate(node=>node===document.activeElement),true);assert.equal(await page.getByRole('region',{name:'file-39.tsx',exact:true}).count(),1);assert.equal(await page.locator('section').evaluate(node=>node.scrollLeft),0);await capture('keyboard-scrolled-project',{audit:true});

 await mount(`const loop={id:'loop',name:'Nested folder',kind:'folder',children:[]};loop.children=[loop];createRoot(document.getElementById('root')).render(<Subject.FileExplorer nodes={[loop]}/>);`);
 const limit=page.getByText('Folder depth limit reached.',{exact:true});await limit.scrollIntoViewIfNeeded();assert.equal(await limit.isVisible(),true);assert.ok(await page.getByRole('button').count()<=26);assert.equal(await page.locator('section').evaluate(node=>node.scrollLeft),0);await capture('bounded-circular-tree',{audit:true});
 await checkCopies({page,mount,assert});await checkFocus({page,mount,assert});await checkDepth({page,mount,assert});await checkReadonly({page,mount,assert});await checkMotion({page,mount,assert});
 await page.emulateMedia({reducedMotion:'reduce'});
}
