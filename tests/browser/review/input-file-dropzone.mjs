async function smallBytes({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.FileDropzone accept=".txt" maxBytes={32} defaultFiles={[new File(['Useful research.'],'research.txt',{type:'text/plain',lastModified:1})]}/>);`);
 assert.equal(await page.getByText('.txt · up to 32 B each',{exact:true}).count(),1,'Small byte limits must not be rounded to zero megabytes');
 assert.equal(await page.getByText('16 B',{exact:true}).count(),1,'Non-empty small files retain their actual byte count');
}


async function copies({page,mount,assert}) {
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.FileDropzone onChange={files=>{window.changes.push(files.map(file=>file.name));files.length=0}}/>);`);
  await page.locator('input[type="file"]').setInputFiles({name:'research.md',mimeType:'text/markdown',buffer:Buffer.from('# Useful research')});
  assert.deepEqual(await page.evaluate(()=>window.changes),[['research.md']]);
  assert.equal(await page.getByRole('button',{name:'Remove research.md',exact:true}).count(),1,'File notifications cannot mutate the stored selected-file array');
}


async function readOnlyCase({page,mount,assert}) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.FileDropzone files={[new File(['Research'],'research.md',{type:'text/markdown',lastModified:0})]}/>);`);
  assert.equal(await page.getByRole('button',{name:'Choose files',exact:true}).isDisabled(),true,'Controlled files without a writer cannot expose an active chooser');
  assert.equal(await page.getByRole('button',{name:'Remove research.md',exact:true}).isDisabled(),true);
}


async function reorderFocus({page,mount,assert}) {
  await mount(`function Host(){const[files,setFiles]=React.useState([new File(['A'],'alpha.md',{type:'text/markdown',lastModified:1}),new File(['B'],'beta.md',{type:'text/markdown',lastModified:2})]);window.reverseFiles=()=>setFiles(files=>[...files].reverse());return <Subject.FileDropzone files={files} onChange={setFiles}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const remove=page.getByRole('button',{name:'Remove beta.md',exact:true});await remove.focus();await page.evaluate(()=>window.reverseFiles());
  assert.equal(await remove.evaluate(node=>node===document.activeElement),true,'Reordering selected files retains the focused removal action');
}


async function removalFocus({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.FileDropzone defaultFiles={[new File(['A'],'alpha.md',{type:'text/markdown',lastModified:1}),new File(['B'],'beta.md',{type:'text/markdown',lastModified:2})]}/>);`);
 await page.getByRole('button',{name:'Remove alpha.md',exact:true}).focus();await page.getByRole('button',{name:'Remove alpha.md',exact:true}).press('Enter');
 assert.equal(await page.getByRole('button',{name:'Remove beta.md',exact:true}).evaluate(node=>node===document.activeElement),true,'Removing a file retains keyboard focus on the next removal action');
}


async function textDrag({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.FileDropzone/>);`);
 const area=page.locator('section > div').first(),before=await area.evaluate(node=>getComputedStyle(node).backgroundColor);
 await area.evaluate(node=>{const transfer=new DataTransfer();transfer.setData('text/plain','A paragraph');node.dispatchEvent(new DragEvent('dragenter',{bubbles:true,cancelable:true,dataTransfer:transfer}));});await page.waitForTimeout(250);
 assert.equal(await area.evaluate(node=>getComputedStyle(node).backgroundColor),before,'Text drags do not advertise a file drop target');
}


async function disableDrag({page,mount,assert}) {
 await mount(`function Host(){const[disabled,setDisabled]=React.useState(false);window.disableDrop=()=>setDisabled(true);return <Subject.FileDropzone disabled={disabled}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const area=page.locator('section > div').first(),before=await area.evaluate(node=>getComputedStyle(node).backgroundColor);
 await area.evaluate(node=>{const transfer=new DataTransfer();transfer.items.add(new File(['Research'],'research.md',{type:'text/markdown'}));node.dispatchEvent(new DragEvent('dragenter',{bubbles:true,cancelable:true,dataTransfer:transfer}));});await page.waitForTimeout(250);
 assert.notEqual(await area.evaluate(node=>getComputedStyle(node).backgroundColor),before);await page.evaluate(()=>window.disableDrop());await page.waitForTimeout(250);
 assert.equal(await page.getByRole('button',{name:'Choose files',exact:true}).isDisabled(),true);
 assert.equal(await area.evaluate(node=>getComputedStyle(node).backgroundColor),before,'Disabling a dropzone clears the active drag highlight');
}


async function dropFiles(area, descriptors) {
 await area.evaluate((node,files)=>{const transfer=new DataTransfer();for(const file of files)transfer.items.add(new File([file.text],file.name,{type:file.type,lastModified:file.lastModified??1}));for(const type of ['dragenter','dragover','drop'])node.dispatchEvent(new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:transfer}));},descriptors);
}

export async function check({page,mount,assert,capture=async()=>{}}) {
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:2000});
 await mount(`window.batches=[];window.received=[];createRoot(document.getElementById('root')).render(<Subject.FileDropzone accept=".txt,.md" maxBytes={32} maxFiles={3} onChange={files=>{window.received=files;window.batches.push(files.map(file=>({name:file.name,size:file.size,type:file.type})))}}/>);`);
 const browse=page.getByRole('button',{name:'Choose files',exact:true});
 const chooserPromise=page.waitForEvent('filechooser');await browse.focus();await browse.press('Enter');const chooser=await chooserPromise;await chooser.setFiles({name:'research.txt',mimeType:'text/plain',buffer:Buffer.from('Useful research.')});
 await page.getByRole('button',{name:'Remove research.txt',exact:true}).waitFor();assert.equal(await page.getByRole('status').innerText(),'1 of 3 files selected.');assert.equal(await page.evaluate(()=>window.received[0].text()),'Useful research.');assert.equal(await browse.evaluate(node=>node===document.activeElement),true);await capture('file-picker-selection',{audit:true});
 const area=page.locator('section > div').first();
 await dropFiles(area,[{name:'notes.md',text:'# Notes',type:'text/markdown',lastModified:2},{name:'photo.png',text:'pixels',type:'image/png',lastModified:3},{name:'large.txt',text:'x'.repeat(40),type:'text/plain',lastModified:4}]);
 assert.equal(await page.getByRole('button',{name:'Remove notes.md',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Remove photo.png',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Remove large.txt',exact:true}).count(),0);assert.match(await page.getByRole('status').innerText(),/photo.png: unsupported type/);assert.match(await page.getByRole('status').innerText(),/large.txt: too large/);
 assert.deepEqual(await page.evaluate(()=>window.batches),[[{name:'research.txt',size:16,type:'text/plain'}],[{name:'research.txt',size:16,type:'text/plain'},{name:'notes.md',size:7,type:'text/markdown'}]]);await capture('mixed-drop-rejections',{audit:true});
 await area.evaluate(node=>{const transfer=new DataTransfer();transfer.items.add(window.received[0]);node.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));});assert.match(await page.getByRole('status').innerText(),/research.txt: already added/);assert.equal(await page.evaluate(()=>window.batches.length),2);
 await dropFiles(area,[{name:'plan.txt',text:'Next steps',type:'text/plain',lastModified:5}]);assert.equal(await browse.isDisabled(),true);assert.equal(await page.getByRole('status').innerText(),'3 of 3 files selected.');await capture('at-capacity',{audit:true});
 await dropFiles(area,[{name:'extra.md',text:'Extra',type:'text/markdown',lastModified:6}]);assert.match(await page.getByRole('status').innerText(),/extra.md: file limit reached/);assert.equal(await page.evaluate(()=>window.batches.length),3);
 const research=page.getByRole('button',{name:'Remove research.txt',exact:true});await research.focus();await research.press('Enter');const notes=page.getByRole('button',{name:'Remove notes.md',exact:true});assert.equal(await notes.evaluate(node=>node===document.activeElement),true);assert.equal(await browse.isDisabled(),false);assert.equal(await page.getByRole('status').innerText(),'2 of 3 files selected.');await notes.press('Enter');const plan=page.getByRole('button',{name:'Remove plan.txt',exact:true});assert.equal(await plan.evaluate(node=>node===document.activeElement),true);await plan.press('Enter');assert.equal(await browse.evaluate(node=>node===document.activeElement),true);assert.equal(await page.getByRole('status').innerText(),'0 of 3 files selected.');

 await mount(`createRoot(document.getElementById('root')).render(<Subject.FileDropzone files={[new File(['Fixed'],'fixed.md',{type:'text/markdown',lastModified:1})]}/>);`);
 const locked=page.locator('section > div').first(),background=await locked.evaluate(node=>getComputedStyle(node).backgroundColor);assert.equal(await page.getByRole('button',{name:'Choose files',exact:true}).isDisabled(),true);await dropFiles(locked,[{name:'ignored.md',text:'Ignored',type:'text/markdown'}]);await page.waitForTimeout(200);assert.equal(await page.getByRole('button',{name:'Remove fixed.md',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Remove ignored.md',exact:true}).count(),0);assert.equal(await locked.evaluate(node=>getComputedStyle(node).backgroundColor),background);await capture('read-only-files',{audit:true});

 await mount(`window.proposals=[];function Host(){const[files,setFiles]=React.useState([new File(['A'],'alpha.md',{type:'text/markdown',lastModified:1}),new File(['B'],'beta.md',{type:'text/markdown',lastModified:2})]);window.publishFiles=()=>setFiles(window.pendingFiles);return <><Subject.FileDropzone files={files} onChange={next=>{window.pendingFiles=next;window.proposals.push(next.map(file=>file.name))}}/><button id="host-focus">Another host action</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const alpha=page.getByRole('button',{name:'Remove alpha.md',exact:true});await alpha.focus();await alpha.press('Enter');assert.equal(await alpha.count(),1);assert.equal(await alpha.evaluate(node=>node===document.activeElement),true);assert.deepEqual(await page.evaluate(()=>window.proposals),[['beta.md']]);
 const host=page.getByRole('button',{name:'Another host action',exact:true});await host.focus();await page.evaluate(()=>window.publishFiles());await page.getByRole('button',{name:'Remove beta.md',exact:true}).waitFor();assert.equal(await alpha.count(),0);assert.equal(await host.evaluate(node=>node===document.activeElement),true,'A refused removal retires its focus request before later host acknowledgement');await capture('late-controlled-acknowledgement',{audit:true});

 await mount(`createRoot(document.getElementById('root')).render(<Subject.FileDropzone maxFiles={0} defaultFiles={[new File(['Old'],'old.md',{type:'text/markdown',lastModified:1})]}/>);`);
 const last=page.getByRole('button',{name:'Remove old.md',exact:true});await last.focus();await last.press('Enter');assert.equal(await page.getByRole('button',{name:'Choose files',exact:true}).isDisabled(),true);assert.equal(await page.locator('section').evaluate(node=>node===document.activeElement),true);assert.equal(await page.getByRole('status').innerText(),'0 of 0 files selected.');await capture('zero-capacity-focus',{audit:true});

 await page.setViewportSize({width:320,height:2200});
 await mount(`const files=[new File(['Research'],'research-findings-and-working-group-notes-for-the-international-design-team.md',{type:'text/markdown',lastModified:1})];createRoot(document.getElementById('root')).render(<><Subject.FileDropzone title="Bring the research and design source material for the wider working group" hint="Choose the documents that explain the work you want to do next." defaultFiles={files}/><Subject.FileDropzone title="Independent source files" defaultFiles={files}/></>);`);
 const sections=page.locator('section');await sections.first().getByRole('button',{name:/Remove research-findings/}).click();assert.equal(await sections.last().getByRole('button',{name:/Remove research-findings/}).count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);return ids.filter((id,index)=>ids.indexOf(id)!==index)}),[]);await capture('long-independent-dropzones',{audit:true});

 await page.setViewportSize({width:390,height:1800});await page.emulateMedia({reducedMotion:'no-preference'});
 await mount(`function Host(){const[show,setShow]=React.useState(false);window.showDrop=()=>setShow(true);return show?<Subject.FileDropzone defaultFiles={[new File(['Live'],'live.md',{type:'text/markdown',lastModified:1})]}/>:null};createRoot(document.getElementById('root')).render(<Host/>);`);await page.evaluate(()=>window.showDrop());
 await page.waitForFunction(()=>{const section=document.querySelector('section'),opacity=Number(getComputedStyle(section).opacity);return opacity>0&&opacity<.9},null,{timeout:1500,polling:'raf'});await page.emulateMedia({reducedMotion:'reduce'});
 const motion=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve([...document.querySelectorAll('section,li')].map(node=>{const style=getComputedStyle(node);return{opacity:Number(style.opacity),y:new DOMMatrixReadOnly(style.transform).m42}}))))));assert.deepEqual(motion,[{opacity:1,y:0},{opacity:1,y:0}]);await capture('live-reduced-motion',{audit:true});
 for(const test of [copies,readOnlyCase,reorderFocus,removalFocus,textDrag,disableDrag,smallBytes])await test({page,mount,assert});await page.emulateMedia({reducedMotion:'reduce'});
}
