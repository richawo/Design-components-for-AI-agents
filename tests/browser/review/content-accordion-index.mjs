import fs from 'node:fs';
async function reorderRegression({page,mount,assert}) {
 await mount(`function Host(){const[items,setItems]=React.useState([{id:'a',question:'Question A',answer:'Answer A'},{id:'b',question:'Question B',answer:'Answer B'}]);window.reverseQuestions=()=>setItems(items=>[...items].reverse());return <Subject.AccordionIndex items={items} defaultOpen="a"/>};createRoot(document.getElementById('root')).render(<Host/>);`);const target=page.getByRole('button',{name:/Question A/});await target.focus();await page.evaluate(()=>window.reverseQuestions());await page.waitForFunction(()=>document.querySelector('h3 button').textContent.includes('Question B'));assert.equal(await target.evaluate(n=>n===document.activeElement),true,'Reordering questions retains the focused disclosure');assert.equal(await target.getAttribute('aria-expanded'),'true');
}


async function motionRegression({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'no-preference'});await mount(`createRoot(document.getElementById('root')).render(<Subject.AccordionIndex defaultOpen=""/>);`);await page.getByRole('button',{name:/What arrives/}).click();await page.waitForFunction(()=>{const p=document.querySelector('[role=region]:not([hidden]) p'),opacity=Number(getComputedStyle(p).opacity);return opacity>0&&opacity<.95},null,{polling:'raf'});await page.emulateMedia({reducedMotion:'reduce'});const pose=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const style=getComputedStyle(document.querySelector('[role=region]:not([hidden]) p'));resolve({opacity:Number(style.opacity),y:new DOMMatrixReadOnly(style.transform).m42})}))));assert.deepEqual(pose,{opacity:1,y:0},'Live reduced motion settles the revealed answer immediately');
}


async function workflow({page,mount,assert,capture}) {
 await mount(`window.disclosures=[];createRoot(document.getElementById('root')).render(<Subject.AccordionIndex onOpenChange={id=>window.disclosures.push(id)}/>);`);assert.equal(await page.locator('[role=region]:not([hidden])').count(),1);const timeline=page.getByRole('button',{name:/How long does a sprint take/});await timeline.focus();await timeline.press('Enter');await page.waitForFunction(()=>document.querySelector('[data-demo="question-1"]').getAttribute('aria-expanded')==='true');assert.equal(await page.locator('[data-demo="question-0"]').getAttribute('aria-expanded'),'false');assert.ok((await page.locator('[role=region]:not([hidden])').innerText()).includes('Two focused weeks.'));await capture('opened-timeline',{audit:true});await timeline.press('Space');await page.waitForFunction(()=>document.querySelectorAll('[role=region]:not([hidden])').length===0);assert.equal(await timeline.evaluate(n=>n===document.activeElement),true);await capture('all-answers-closed',{audit:true});await page.getByRole('button',{name:/What if the brief changes/}).focus();await page.getByRole('button',{name:/What if the brief changes/}).press('Space');await page.waitForFunction(()=>document.querySelector('[data-demo="question-2"]').getAttribute('aria-expanded')==='true');assert.deepEqual(await page.evaluate(()=>window.disclosures),['timeline',null,'changes']);for(const button of await page.locator('h3 button').all()){const target=await button.getAttribute('aria-controls');assert.equal(await page.locator('[id='+JSON.stringify(target)+']').count(),1);}await capture('opened-change-answer',{audit:true});
}
async function localWithoutObserver({page,mount,assert,capture}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AccordionIndex defaultOpen=""/>);`);assert.equal(await page.locator('[role=region]:not([hidden])').count(),0);await page.getByRole('button',{name:/How long/}).click();await page.waitForFunction(()=>document.querySelector('[data-demo="question-1"]').getAttribute('aria-expanded')==='true');assert.equal(await page.locator('[role=region]:not([hidden])').count(),1);await capture('local-disclosure',{audit:true});
}
async function arrivingQuestions({page,mount,assert,capture}) {
 await mount(`function Host(){const[items,setItems]=React.useState([]);window.publishQuestions=()=>setItems([{id:'a',question:'Question A',answer:'Answer A'},{id:'b',question:'Question B',answer:'Answer B'}]);window.replaceQuestions=()=>setItems([{id:'c',question:'Question C',answer:'Answer C'}]);return <Subject.AccordionIndex items={items} defaultOpen="a"/>};createRoot(document.getElementById('root')).render(<Host/>);`);assert.equal(await page.getByText('No questions published yet.',{exact:true}).count(),1);assert.equal(await page.getByRole('button').count(),0);await capture('empty-questions',{audit:true});await page.evaluate(()=>window.publishQuestions());await page.getByRole('button',{name:/Question A/}).waitFor();assert.equal(await page.getByRole('button',{name:/Question A/}).getAttribute('aria-expanded'),'true');assert.equal(await page.locator('[role=region]:not([hidden])').innerText(),'Answer A');await page.evaluate(()=>window.replaceQuestions());await page.getByRole('button',{name:/Question C/}).waitFor();assert.equal(await page.locator('[role=region]:not([hidden])').count(),0);assert.equal(await page.getByRole('button',{name:/Question C/}).getAttribute('aria-expanded'),'false');await capture('replacement-questions',{audit:true});
}
async function independentQuestions({page,mount,assert,capture}) {
 await page.setViewportSize({width:320,height:2000});await mount(`createRoot(document.getElementById('root')).render(<><Subject.AccordionIndex title="Useful answers for a research and editorial working group" kicker="Before the next sprint" defaultOpen="long" items={[{id:'long',question:'What happens when the research and documentation direction needs to change?',answer:'Discuss the new information with the working group, keep a record of the decision and agree a clear next step before changing the plan.'},{id:'later',question:'What comes next?',answer:'A concrete next step.'}]}/><Subject.AccordionIndex title="Independent answers" defaultOpen=""/></>);`);const roots=page.locator('section');await roots.nth(1).getByRole('button',{name:/How long/}).click();await page.waitForFunction(()=>document.querySelectorAll('section')[1].querySelector('[data-demo="question-1"]').getAttribute('aria-expanded')==='true');assert.equal(await roots.nth(0).getByRole('button',{name:/What happens/}).getAttribute('aria-expanded'),'true');assert.equal(await page.locator('[id]').evaluateAll(nodes=>new Set(nodes.map(n=>n.id)).size===nodes.length),true);assert.ok(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth));await capture('long-independent-answers',{audit:true});await page.setViewportSize({width:390,height:1600});
}
async function publishedPhonePreview({page,mount,assert,capture}) {
 const meta=JSON.parse(fs.readFileSync(process.env.DFA_DRAFT_QA_META??'registry/free/content-accordion-index/meta.json'));
 for(const width of [320,390]) {
  await page.setViewportSize({width,height:meta.previewHeight});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
  await page.locator('#root').evaluate(node=>{node.style.padding='0';node.style.maxWidth='none';node.style.width='100%';node.style.minHeight='100vh'});
  for(let index=0;index<3;index++) {
   if(index)await page.locator('[data-demo="question-'+index+'"]').click();
   await page.waitForTimeout(350);
   const box=await page.locator('section').boundingBox();
   assert.ok(box.y>=16&&box.y+box.height<=meta.previewHeight-16,'The published phone preview contains the full question index in every demo state');
   assert.equal(await page.locator('[role=region]:not([hidden])').count(),1);
  }
  await capture('published-phone-'+width,{audit:true});
 }
 await page.setViewportSize({width:390,height:1600});
}
export async function check({page,mount,assert,capture=async()=>{}}) {
 for(const test of [workflow,localWithoutObserver,arrivingQuestions,independentQuestions,publishedPhonePreview])await test({page,mount,assert,capture});await reorderRegression({page,mount,assert});await motionRegression({page,mount,assert});await capture('live-reduced-answer',{audit:true});await page.emulateMedia({reducedMotion:'reduce'});
}
