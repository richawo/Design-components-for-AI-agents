async function clearFocusRegression({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.ShortcutReference/>);`);const search=page.getByRole('textbox',{name:'Find a shortcut',exact:true});await search.fill('writing');await page.getByRole('button',{name:'Clear shortcut search',exact:true}).click();assert.equal(await search.inputValue(),'');assert.equal(await search.evaluate(node=>node===document.activeElement),true,'Clearing the shortcut filter returns focus to the search field');
}


async function contrastRegression({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.ShortcutReference/>);`);
 const ratio=await page.getByRole('textbox').locator('..').evaluate(node=>{const rgb=color=>color.match(/[\d.]+/g).slice(0,3).map(Number),lum=color=>rgb(color).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0),a=lum(getComputedStyle(node).borderTopColor),b=lum(getComputedStyle(node.closest('section')).backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
 assert.ok(ratio>=3,'Shortcut search boundary has at least 3:1 contrast against its panel');
}


async function motionRegression({page,mount,assert}) {
  await page.emulateMedia({reducedMotion:'no-preference'});await mount(`function Host(){const[show,setShow]=React.useState(false);window.showSubject=()=>setShow(true);return show?<Subject.ShortcutReference/>:null};createRoot(document.getElementById('root')).render(<Host/>);`);await page.evaluate(()=>window.showSubject());
  await page.waitForFunction(()=>{const section=document.querySelector('section[aria-labelledby]'),opacity=Number(getComputedStyle(section).opacity);return opacity>0&&opacity<.95},null,{timeout:1500,polling:'raf'});
  await page.emulateMedia({reducedMotion:'reduce'});
  const frame=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const style=getComputedStyle(document.querySelector('section[aria-labelledby]'));resolve({opacity:Number(style.opacity),y:new DOMMatrixReadOnly(style.transform).m42})}))));
  assert.deepEqual(frame,{opacity:1,y:0},'Live reduced motion immediately settles shortcut-reference entry');
}


async function searchWorkflow({page,mount,assert,capture}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.ShortcutReference/>);`);const input=page.getByRole('textbox',{name:'Find a shortcut',exact:true});assert.equal(await page.locator('dt').count(),5);await input.fill('writing');await page.waitForFunction(()=>document.querySelectorAll('dt').length===3);assert.deepEqual(await page.locator('dt').allTextContents(),['New document','Toggle preview','Save changes']);assert.deepEqual(await page.locator('h3').allTextContents(),['Writing']);await capture('filtered-writing-group',{audit:true});
 await page.getByRole('button',{name:'Clear shortcut search',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('dt').length===5);assert.equal(await input.inputValue(),'');assert.equal(await input.evaluate(n=>n===document.activeElement),true);
 await input.fill('  PREVIEW  ');await page.waitForFunction(()=>document.querySelectorAll('dt').length===1);assert.deepEqual(await page.locator('dt').allTextContents(),['Toggle preview']);await capture('trimmed-case-insensitive-query',{audit:true});await input.press('Escape');await page.waitForFunction(()=>document.querySelectorAll('dt').length===5);assert.equal(await input.inputValue(),'');assert.equal(await input.evaluate(n=>n===document.activeElement),true);
 await input.fill('no-such-shortcut');assert.equal(await page.getByRole('status').innerText(),'No matching shortcuts.');assert.equal(await page.locator('dt').count(),0);await capture('unmatched-query',{audit:true});
}
async function keySearch({page,mount,assert,capture}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.ShortcutReference/>);`);await page.getByRole('textbox').fill('⌘ ⇧');await page.waitForFunction(()=>document.querySelectorAll('dt').length===2);assert.deepEqual(await page.locator('dt').allTextContents(),['Switch workspace','Toggle preview']);await capture('rendered-modifier-search',{audit:true});
}
async function arrivingItems({page,mount,assert,capture}) {
 await mount(`function Host(){const[items,setItems]=React.useState([]);window.publishShortcuts=()=>setItems([{id:'rotate',label:'Rotate view',keys:['Alt','R'],group:'Canvas'}]);return <Subject.ShortcutReference items={items}/>};createRoot(document.getElementById('root')).render(<Host/>);`);const input=page.getByRole('textbox');await input.fill('rotate');assert.equal(await page.getByRole('status').innerText(),'No matching shortcuts.');await page.evaluate(()=>window.publishShortcuts());await page.getByText('Rotate view',{exact:true}).waitFor();assert.equal(await input.inputValue(),'rotate');assert.equal(await input.evaluate(n=>n===document.activeElement),true);assert.deepEqual(await page.locator('kbd').allTextContents(),['Alt','R']);await capture('arriving-filtered-items',{audit:true});
}
async function emptyItems({page,mount,assert,capture}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.ShortcutReference items={[]}/>);`);assert.equal(await page.getByRole('status').innerText(),'No matching shortcuts.');assert.equal(await page.locator('dt').count(),0);assert.equal(await page.getByRole('button',{name:'Clear shortcut search',exact:true}).count(),0);await capture('empty-reference',{audit:true});
}
async function independentReferences({page,mount,assert,capture}) {
 await page.setViewportSize({width:320,height:1900});await mount(`createRoot(document.getElementById('root')).render(<><Subject.ShortcutReference title="The research and editorial workspace keyboard reference" searchPlaceholder="Find research shortcuts" items={[{id:'long',label:'Open the shared research and documentation workspace for the working group',keys:['Control','Shift','VeryLongHostSuppliedKeyName'],group:'Research and documentation'},{id:'unicode',label:'Ångström view',keys:['Alt','Å'],group:'Measurements'}]}/><Subject.ShortcutReference title="Independent keyboard reference" searchPlaceholder="Find other shortcuts"/></>);`);const first=page.getByRole('textbox',{name:'Find research shortcuts',exact:true});await first.fill('ångström');await page.getByText('Ångström view',{exact:true}).waitFor();assert.equal(await page.locator('section[aria-labelledby]').evaluateAll(nodes=>new Set(nodes.map(n=>n.getAttribute('aria-labelledby'))).size),2);assert.equal(await page.getByRole('textbox',{name:'Find other shortcuts',exact:true}).inputValue(),'');assert.equal(await page.getByText('Search everywhere',{exact:true}).count(),1);await first.press('Escape');await page.getByText('Open the shared research and documentation workspace for the working group',{exact:true}).waitFor();assert.ok(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth));await capture('long-independent-references',{audit:true});await page.setViewportSize({width:390,height:1600});
}
export async function check({page,mount,assert,capture=async()=>{}}) {
 for(const test of [searchWorkflow,keySearch,arrivingItems,emptyItems,independentReferences])await test({page,mount,assert,capture});await motionRegression({page,mount,assert});await capture('live-reduced-motion',{audit:true});for(const test of [clearFocusRegression,contrastRegression])await test({page,mount,assert});await page.emulateMedia({reducedMotion:'reduce'});
}
