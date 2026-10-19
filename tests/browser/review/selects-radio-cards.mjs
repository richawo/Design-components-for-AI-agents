import fs from 'node:fs';
async function readOnlyRegression({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.RadioCards value="explained"/>);`);
 assert.equal(await page.getByRole('radio').evaluateAll(nodes=>nodes.every(node=>node.disabled)),true,'Controlled radio cards without a writer are read-only');
}


async function reorderRegression({page,mount,assert}) {
 await mount(`function Host(){const[options,setOptions]=React.useState([{id:'a',label:'Option A',description:'First choice'},{id:'b',label:'Option B',description:'Second choice'}]);window.reverseOptions=()=>setOptions(options=>[...options].reverse());return <Subject.RadioCards options={options} defaultValue="a"/>};createRoot(document.getElementById('root')).render(<Host/>);`);const first=page.getByRole('radio',{name:/Option A/});await first.focus();await page.evaluate(()=>window.reverseOptions());await page.waitForFunction(()=>document.querySelector('input[type=radio]').value==='b');assert.equal(await first.evaluate(node=>node===document.activeElement),true,'Reordering radio cards retains focused option identity');
}


async function contrastRegression({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.RadioCards/>);`);
 const ratio=await page.getByRole('radio').first().locator('..').locator('div > span').evaluate(node=>{const rgb=color=>color.match(/[\d.]+/g).slice(0,3).map(Number),lum=color=>rgb(color).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0),a=lum(getComputedStyle(node).borderTopColor),b=lum(getComputedStyle(node.closest('fieldset')).backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
 assert.ok(ratio>=3,'Unchecked radio boundaries have at least 3:1 contrast against their panel');
}


async function markMotionRegression({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'no-preference'});await mount(`createRoot(document.getElementById('root')).render(<Subject.RadioCards/>);`);await page.getByRole('radio').first().locator('..').click();await page.waitForFunction(()=>{const node=document.querySelector('label input:checked')?.closest('label').querySelector('div > span > span');if(!node)return false;const style=getComputedStyle(node);return Number(style.opacity)>0&&Number(style.opacity)<.99},null,{timeout:1500,polling:'raf'});
 await page.emulateMedia({reducedMotion:'reduce'});const frame=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const node=document.querySelector('label input:checked').closest('label').querySelector('div > span > span'),style=getComputedStyle(node);resolve({opacity:Number(style.opacity),scale:new DOMMatrixReadOnly(style.transform).a})}))));assert.deepEqual(frame,{opacity:1,scale:1},'Live reduced motion immediately settles the selected radio mark');
}


async function keyboardWorkflow({page,mount,assert,capture}) {
 await mount(`window.choices=[];createRoot(document.getElementById('root')).render(<Subject.RadioCards onChange={value=>window.choices.push(value)}/>);`);const radios=page.getByRole('radio');assert.deepEqual(await radios.evaluateAll(nodes=>nodes.map(n=>n.checked)),[false,true,false]);await radios.nth(1).focus();await radios.nth(1).press('ArrowRight');await page.waitForFunction(()=>document.querySelector('input[value="exploratory"]').checked);await radios.nth(2).press('ArrowRight');await page.waitForFunction(()=>document.querySelector('input[value="focused"]').checked);assert.deepEqual(await page.evaluate(()=>window.choices),['exploratory','focused']);await capture('keyboard-selected-card',{audit:true});
}
async function disabledOptions({page,mount,assert,capture}) {
 await mount(`window.choices=[];createRoot(document.getElementById('root')).render(<Subject.RadioCards defaultValue="a" options={[{id:'a',label:'Available A',description:'First choice'},{id:'b',label:'Unavailable B',description:'Disabled choice',disabled:true},{id:'c',label:'Available C',description:'Last choice'}]} onChange={value=>window.choices.push(value)}/>);`);const radios=page.getByRole('radio');assert.equal(await radios.nth(1).isDisabled(),true);await radios.nth(0).focus();await radios.nth(0).press('ArrowRight');await page.waitForFunction(()=>document.querySelector('input[value="c"]').checked);assert.equal(await radios.nth(2).evaluate(n=>n===document.activeElement),true);assert.deepEqual(await page.evaluate(()=>window.choices),['c']);await capture('skipped-unavailable-card',{audit:true});
}
async function controlledWorkflow({page,mount,assert,capture}) {
 await mount(`window.proposals=[];function Host(){const[value,setValue]=React.useState('focused');const[accept,setAccept]=React.useState(false);window.acceptChoices=()=>setAccept(true);window.clearChoice=()=>setValue('');return <Subject.RadioCards value={value} onChange={next=>{window.proposals.push(next);if(accept)setValue(next)}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);const radios=page.getByRole('radio');await radios.nth(2).locator('..').click();assert.deepEqual(await radios.evaluateAll(nodes=>nodes.map(n=>n.checked)),[true,false,false]);assert.deepEqual(await page.evaluate(()=>window.proposals),['exploratory']);await page.evaluate(()=>window.acceptChoices());await radios.nth(2).locator('..').click();await page.waitForFunction(()=>document.querySelector('input[value="exploratory"]').checked);await page.evaluate(()=>window.clearChoice());await page.waitForFunction(()=>!document.querySelector('input:checked'));assert.equal(await page.getByRole('radio',{checked:true}).count(),0);await capture('controlled-cleared-choice',{audit:true});
}
async function readOnlyWorkflow({page,mount,assert,capture}) {
 await readOnlyRegression({page,mount,assert});await capture('read-only-selection',{audit:true});
}
async function arrivingOptions({page,mount,assert,capture}) {
 await mount(`function Host(){const[options,setOptions]=React.useState([]);window.publishOptions=()=>setOptions([{id:'later',label:'Later option',description:'A newly available choice'}]);return <Subject.RadioCards options={options} defaultValue="later"/>};createRoot(document.getElementById('root')).render(<Host/>);`);assert.equal(await page.getByText('No options available.',{exact:true}).count(),1);assert.equal(await page.getByRole('radio').count(),0);await capture('no-options',{audit:true});await page.evaluate(()=>window.publishOptions());await page.getByRole('radio').waitFor();assert.equal(await page.getByRole('radio').isChecked(),true);await capture('arriving-options',{audit:true});
}
async function independentOptions({page,mount,assert,capture}) {
 await page.setViewportSize({width:320,height:2200});await mount(`createRoot(document.getElementById('root')).render(<><Subject.RadioCards label="Choose the response style for a research and editorial working group" defaultValue="long" options={[{id:'long',label:'Long-form research and documentation',description:'Read the sources, explain the reasoning and write a useful response with enough context for the next person.',meta:'For detailed research and decision records'},{id:'brief',label:'Brief answer',description:'Keep the answer focused.'}]} onChange={()=>{}}/><Subject.RadioCards label="Independent response setting"/></>);`);const groups=page.locator('fieldset');assert.equal(await page.getByRole('radio').evaluateAll(nodes=>new Set(nodes.map(n=>n.name)).size),2);await groups.nth(0).getByRole('radio').nth(1).locator('..').click();assert.equal(await groups.nth(0).getByRole('radio').nth(1).isChecked(),true);assert.equal(await groups.nth(1).getByRole('radio').nth(1).isChecked(),true);assert.ok(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth));await capture('long-independent-options',{audit:true});await page.setViewportSize({width:390,height:1600});
}
async function previewFraming({page,mount,assert,capture}) {
 const meta=JSON.parse(fs.readFileSync(process.env.DFA_DRAFT_QA_META??'registry/free/selects-radio-cards/meta.json'));
 await page.setViewportSize({width:320,height:meta.previewHeight});
 await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
 // The default demo fills the preview; remove the named-component fixture's outer padding.
 await page.locator('#root').evaluate(node=>{node.style.padding='0';node.style.maxWidth='none';node.style.width='100%';node.style.minHeight='100vh'});
 for(const width of [320,390]) {
  await page.setViewportSize({width,height:meta.previewHeight});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const geometry=await page.locator('fieldset').evaluate(node=>({...node.getBoundingClientRect().toJSON(),viewport:innerHeight,choices:[...node.querySelectorAll('label')].map(label=>label.getBoundingClientRect().toJSON())}));
  assert.equal(geometry.choices.length,3);
  assert.ok(geometry.top>=16&&geometry.bottom<=geometry.viewport-16,'The published phone preview retains all three default radio choices: '+JSON.stringify(geometry));
  assert.ok(geometry.choices.every(choice=>choice.top>=16&&choice.bottom<=geometry.viewport-16));
  await capture('complete-phone-preview-'+width,{audit:true});
 }
 await page.setViewportSize({width:390,height:1600});
}
export async function check({page,mount,assert,capture=async()=>{}}) {
 for(const test of [keyboardWorkflow,disabledOptions,controlledWorkflow,readOnlyWorkflow,arrivingOptions,independentOptions,previewFraming])await test({page,mount,assert,capture});await markMotionRegression({page,mount,assert});await capture('live-reduced-selection',{audit:true});for(const test of [reorderRegression,contrastRegression])await test({page,mount,assert});await page.emulateMedia({reducedMotion:'reduce'});
}
