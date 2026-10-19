async function checkCopies({page,mount,assert}){
 await mount(`window.saved=[];window.notifications=[];createRoot(document.getElementById('root')).render(<Subject.PreferenceCenter onChange={values=>{window.notifications.push([...values]);values.push('invisible-choice')}} onSave={values=>{window.saved.push([...values])}}/>);`);
 await page.locator('[data-demo="preference-2"]').focus();await page.locator('[data-demo="preference-2"]').press('Space');await page.getByRole('button',{name:'Save preferences',exact:true}).click();
 await page.waitForFunction(()=>window.saved.length===1);
 assert.deepEqual(await page.evaluate(()=>window.saved),[['essential','digest','product']],'Change notifications cannot add invisible preferences to the saved snapshot');
 assert.deepEqual(await page.evaluate(()=>window.notifications),[['essential','digest','product']]);
}

async function checkReadonly({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.PreferenceCenter value={['essential','digest']}/>);`);
 assert.equal(await page.locator('[data-demo="preference-2"]').isDisabled(),true,'Controlled preferences without a writer are read-only');
}

async function checkEmpty({page,mount,assert}) {
 await mount(`window.saved=[];createRoot(document.getElementById('root')).render(<Subject.PreferenceCenter options={[]} onSave={values=>{window.saved.push(values)}}/>);`);
 assert.equal(await page.getByRole('button',{name:'Save preferences',exact:true}).isDisabled(),true,'An empty preference list cannot save hidden default choices');
 assert.equal(await page.getByText('No preferences available.',{exact:true}).count(),1);
}

async function checkRetirement({page,mount,assert}) {
 await mount(`function Host(){const[state,setState]=React.useState({options:[{id:'old',label:'Old choice',description:'The previous collection.'}],value:['old']});window.replacePreferences=()=>setState({options:[{id:'new',label:'New choice',description:'The current collection.'}],value:['new']});return <Subject.PreferenceCenter {...state} onChange={value=>setState(state=>({...state,value}))} onSave={()=>new Promise(resolve=>window.finishOldSave=resolve)}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 await page.getByRole('button',{name:'Save preferences',exact:true}).click();await page.waitForFunction(()=>!!window.finishOldSave);
 await page.evaluate(()=>window.replacePreferences());await page.getByRole('checkbox',{name:/New choice/}).waitFor();await page.evaluate(()=>window.finishOldSave());await page.waitForTimeout(80);
 assert.doesNotMatch(await page.getByRole('status').innerText(),/Preferences saved/,'A retired save cannot claim success for a replacement preference collection');
}

async function checkContrast({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.PreferenceCenter/>);`);
 const colors=await page.locator('[data-demo="preference-2"]').evaluate(input=>{const background=getComputedStyle(input.closest('section')).backgroundColor,border=getComputedStyle(input).borderTopColor,canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');const sample=color=>{context.clearRect(0,0,1,1);context.fillStyle=background;context.fillRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3)};return{border:sample(border),background:sample(background)}});
 const luminance=rgb=>rgb.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
 const a=luminance(colors.border),b=luminance(colors.background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 assert.ok(ratio>=3,'Unchecked preference boundaries retain3:1 contrast: '+JSON.stringify({ratio,colors}));
}

async function checkFocus({page,mount,assert}) {
 await mount(`function Host(){const[options,setOptions]=React.useState([{id:'a',label:'Alpha choice',description:'First setting.'},{id:'b',label:'Beta choice',description:'Second setting.'}]);window.reorderPreferences=()=>setOptions(options=>[...options].reverse());return <Subject.PreferenceCenter options={options} defaultValue={[]}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const input=page.getByRole('checkbox',{name:/Beta choice/});await input.focus();await input.press('Space');await page.evaluate(()=>window.reorderPreferences());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await input.evaluate(node=>node===document.activeElement),true,'Reordering preference IDs retains the focused checkbox');assert.equal(await input.isChecked(),true);
}

async function checkMotion({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'no-preference'});await mount(`function Host(){const[shown,setShown]=React.useState(false);window.showPreferences=()=>setShown(true);return shown?<Subject.PreferenceCenter/>:null};createRoot(document.getElementById('root')).render(<Host/>);`);await page.evaluate(()=>window.showPreferences());
 await page.waitForFunction(()=>{const section=document.querySelector('section'),opacity=Number(getComputedStyle(section).opacity);return opacity>0&&opacity<.9},null,{timeout:1500,polling:'raf'});
 await page.emulateMedia({reducedMotion:'reduce'});const frame=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const style=getComputedStyle(document.querySelector('section'));resolve({opacity:Number(style.opacity),y:new DOMMatrixReadOnly(style.transform).m42})}))));
 assert.deepEqual(frame,{opacity:1,y:0},'Live reduced motion immediately settles preference entry');
}

export async function check({page,mount,assert,capture=async()=>{}}) {
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:1500});
 await mount(`window.calls=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.PreferenceCenter onSave={async values=>{window.calls.push([...values]);if(window.fail)throw Error('Offline');await new Promise(resolve=>window.finishSave=resolve)}}/>);`);
 const product=page.locator('[data-demo="preference-2"]'),digest=page.locator('[data-demo="preference-1"]'),essential=page.locator('[data-demo="preference-0"]');
 assert.equal(await essential.isChecked(),true);assert.equal(await essential.isDisabled(),true);await product.focus();await product.press('Space');assert.equal(await product.isChecked(),true);
 const save=page.getByRole('button',{name:'Save preferences',exact:true});await save.click();await page.getByRole('status').filter({hasText:'Preferences could not be saved.'}).waitFor();
 assert.equal(await product.isChecked(),true);assert.equal(await save.evaluate(node=>node===document.activeElement),true);await capture('retained-save-failure',{audit:true});
 await page.evaluate(()=>window.fail=false);await save.click();await page.waitForFunction(()=>!!window.finishSave);
 const pending=page.getByRole('button',{name:'Saving…',exact:true});assert.equal(await pending.getAttribute('aria-busy'),'true');assert.equal(await product.getAttribute('aria-disabled'),'true');
 await product.focus();await product.press('Space');assert.equal(await product.isChecked(),true);await digest.focus();await digest.press('Space');assert.equal(await digest.isChecked(),true);await pending.focus();await pending.press('Enter');assert.equal(await page.evaluate(()=>window.calls.length),2);await capture('pending-save',{audit:true});
 await page.evaluate(()=>window.finishSave());await page.getByRole('status').filter({hasText:'Preferences saved.'}).waitFor();assert.deepEqual(await page.evaluate(()=>window.calls),[['essential','digest','product'],['essential','digest','product']]);await capture('saved-preferences',{audit:true});
 await digest.focus();await digest.press('Space');assert.equal(await page.getByRole('status').innerText(),'');assert.equal(await product.isChecked(),true);

 await mount(`window.requests=[];window.releases=[];function Host(){const[state,setState]=React.useState({options:[{id:'old',label:'Old choice',description:'The previous options.'}],value:['old']});window.swapPreferences=()=>setState({options:[{id:'new',label:'New choice',description:'Current options.'}],value:['new']});return <Subject.PreferenceCenter {...state} onChange={value=>setState(state=>({...state,value}))} onSave={values=>{window.requests.push([...values]);return new Promise(resolve=>window.releases.push(resolve))}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 await page.getByRole('button',{name:'Save preferences',exact:true}).click();await page.evaluate(()=>window.swapPreferences());await page.getByRole('checkbox',{name:/New choice/}).waitFor();
 await page.getByRole('button',{name:'Saving…',exact:true}).press('Enter');assert.equal(await page.evaluate(()=>window.requests.length),1,'A replaced collection does not create overlapping writes');await page.evaluate(()=>window.releases[0]());await page.getByRole('button',{name:'Save preferences',exact:true}).waitFor();assert.equal(await page.getByRole('status').innerText(),'');
 await page.getByRole('button',{name:'Save preferences',exact:true}).click();assert.equal(await page.evaluate(()=>window.requests.length),2);await page.evaluate(()=>window.releases[1]());await page.getByRole('status').filter({hasText:'Preferences saved.'}).waitFor();assert.deepEqual(await page.evaluate(()=>window.requests),[['old'],['new']]);await capture('replacement-acknowledgement',{audit:true});

 await mount(`window.finish=null;function Host(){const[options,setOptions]=React.useState([{id:'a',label:'Alpha choice',description:'First option.'},{id:'b',label:'Beta choice',description:'Second option.'}]);window.reverseOptions=()=>setOptions(options=>[...options].reverse());return <Subject.PreferenceCenter options={options} defaultValue={['a']} onSave={()=>new Promise(resolve=>window.finish=resolve)}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 await page.getByRole('button',{name:'Save preferences',exact:true}).click();await page.evaluate(()=>window.reverseOptions());await page.evaluate(()=>window.finish());await page.getByRole('status').filter({hasText:'Preferences saved.'}).waitFor();await capture('reordered-pending-options',{audit:true});

 await mount(`window.snapshots=[];createRoot(document.getElementById('root')).render(<Subject.PreferenceCenter defaultValue={['missing','digest','digest']} onSave={values=>{window.snapshots.push([...values]);values.push('foreign')}}/>);`);
 assert.equal(await page.locator('[data-demo="preference-0"]').isChecked(),true);await page.getByRole('button',{name:'Save preferences',exact:true}).click();await page.getByRole('status').filter({hasText:'Preferences saved.'}).waitFor();assert.deepEqual(await page.evaluate(()=>window.snapshots),[['digest','essential']]);await capture('normalized-available-choices',{audit:true});

 await mount(`createRoot(document.getElementById('root')).render(<Subject.PreferenceCenter/>);`);assert.equal(await page.getByRole('button',{name:'Save preferences',exact:true}).isDisabled(),true);await capture('unconfigured-save',{audit:true});

 await mount(`createRoot(document.getElementById('root')).render(<><Subject.PreferenceCenter title="Communication preferences for an international research and design team" description="Choose the useful messages while keeping required account notices enabled." options={[{id:'a',label:'Required account updates for the entire workspace',description:'Security notices and billing changes that affect your account. '.repeat(3),required:true},{id:'b',label:'Research and release notes across every working group',description:'A useful summary for the teams working across regions. '.repeat(3)}]} defaultValue={['b']} onSave={()=>{}}/><Subject.PreferenceCenter title="Independent preferences"/></>);`);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);return ids.filter((id,index)=>ids.indexOf(id)!==index)}),[]);await capture('long-independent-preferences',{audit:true});
 await checkCopies({page,mount,assert});await checkReadonly({page,mount,assert});await checkEmpty({page,mount,assert});await checkRetirement({page,mount,assert});await checkContrast({page,mount,assert});await checkFocus({page,mount,assert});await checkMotion({page,mount,assert});await page.emulateMedia({reducedMotion:'reduce'});
}
