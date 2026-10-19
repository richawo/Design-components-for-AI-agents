async function reorderRegression({page,mount,assert}) {
 await mount(`function Host(){const[items,setItems]=React.useState([{label:'Typography',query:'type'},{label:'Motion',query:'motion'}]);window.reorderTopics=()=>setItems(items=>[...items].reverse());return <Subject.EmptySearch suggestions={items} onSearch={()=>{}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const action=page.getByRole('button',{name:'Typography',exact:true});await action.focus();await page.evaluate(()=>window.reorderTopics());await page.waitForFunction(()=>document.querySelector('[data-demo="suggestion-0"]').textContent.includes('Motion'));assert.equal(await action.evaluate(node=>node===document.activeElement),true,'Reordering suggestions retains the focused topic');
}


async function clearedRegression({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.EmptySearch query=""/>);`);
 assert.equal(await page.getByText('No results for “”',{exact:true}).count(),0,'An empty search query has a starting state instead of a failed empty query');
 assert.ok(await page.getByRole('status').count()>0,'Search changes expose written live feedback');
}


async function motionRegression({page,mount,assert}) {
  await page.emulateMedia({reducedMotion:'no-preference'});await mount(`function Host(){const[show,setShow]=React.useState(false);window.showSubject=()=>setShow(true);return show?<Subject.EmptySearch/>:null};createRoot(document.getElementById('root')).render(<Host/>);`);await page.evaluate(()=>window.showSubject());
  await page.waitForFunction(()=>{const section=document.querySelector('section'),opacity=Number(getComputedStyle(section).opacity);return opacity>0&&opacity<.95},null,{timeout:1500,polling:'raf'});
  await page.emulateMedia({reducedMotion:'reduce'});
  const frame=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const style=getComputedStyle(document.querySelector('section'));resolve({opacity:Number(style.opacity),y:new DOMMatrixReadOnly(style.transform).m42})}))));
  assert.deepEqual(frame,{opacity:1,y:0},'Live reduced motion immediately settles empty-search entry');
}


async function workflow({page,mount,assert,capture}) {
 await mount(`window.searchCalls=[];function Host(){const[query,setQuery]=React.useState('kinetic typography');return <Subject.EmptySearch query={query} onSearch={next=>{window.searchCalls.push(['search',next]);setQuery(next)}} onClear={()=>{window.searchCalls.push(['clear']);setQuery('')}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 await page.getByRole('button',{name:'Motion studies',exact:true}).focus();await page.getByRole('button',{name:'Motion studies',exact:true}).press('Space');await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('“motion”'));assert.deepEqual(await page.evaluate(()=>window.searchCalls),[['search','motion']]);await capture('selected-motion-topic',{audit:true});
 await page.getByRole('button',{name:'Editorial layouts',exact:true}).focus();await page.getByRole('button',{name:'Editorial layouts',exact:true}).press('Enter');await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('“editorial”'));
 await page.getByRole('button',{name:'Clear search',exact:true}).focus();await page.getByRole('button',{name:'Clear search',exact:true}).press('Space');await page.waitForFunction(()=>document.querySelector('[role=status]').textContent==='Choose a topic to begin.');assert.deepEqual(await page.evaluate(()=>window.searchCalls),[['search','motion'],['search','editorial'],['clear']]);await capture('cleared-search',{audit:true});
}
async function controlled({page,mount,assert,capture}) {
 await mount(`window.searchCalls=[];createRoot(document.getElementById('root')).render(<Subject.EmptySearch query="retained phrase" onSearch={query=>window.searchCalls.push(query)} onClear={()=>window.searchCalls.push('clear')}/>);`);await page.getByRole('button',{name:'Typography',exact:true}).click();await page.getByRole('button',{name:'Clear search',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.searchCalls),['typography','clear']);assert.ok((await page.getByRole('status').innerText()).includes('“retained phrase”'));await capture('host-retained-query',{audit:true});
}
async function unconfigured({page,mount,assert,capture}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.EmptySearch/>);`);assert.equal(await page.getByRole('button').evaluateAll(nodes=>nodes.every(n=>n.disabled)),true);await capture('unconfigured-actions',{audit:true});
}
async function empty({page,mount,assert,capture}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.EmptySearch query="A later-arriving collection" suggestions={[]}/>);`);assert.equal(await page.locator('[data-demo^="suggestion-"]').count(),0);assert.ok((await page.getByRole('status').innerText()).includes('A later-arriving collection'));assert.equal(await page.getByRole('button',{name:'Clear search',exact:true}).isDisabled(),true);await capture('no-suggestions',{audit:true});
}
async function independent({page,mount,assert,capture}) {
 await page.setViewportSize({width:320,height:1800});await mount(`createRoot(document.getElementById('root')).render(<><Subject.EmptySearch title="Find a new direction for the research and documentation workspace" query="averylongsearchphrasethatmustwrapwithintheavailablewidth" suggestions={[{label:'A long typography and editorial research topic for the whole working group',query:'long-topic'},{label:'Repeated topic',query:'duplicate'},{label:'Repeated topic again',query:'duplicate'}]} onSearch={query=>window.longTopic=query}/><Subject.EmptySearch title="Independent results" query="Another phrase" suggestions={[]}/></>);`);assert.equal(await page.locator('section h2').evaluateAll(nodes=>new Set(nodes.map(n=>n.id)).size),2);await page.getByRole('button',{name:'A long typography and editorial research topic for the whole working group',exact:true}).click();assert.equal(await page.evaluate(()=>window.longTopic),'long-topic');const insets=await page.getByRole('button',{name:'A long typography and editorial research topic for the whole working group',exact:true}).evaluate(node=>{const outer=node.getBoundingClientRect(),inner=node.querySelector('span').getBoundingClientRect();return {top:inner.top-outer.top,bottom:outer.bottom-inner.bottom}});assert.ok(insets.top>=8&&insets.bottom>=8,JSON.stringify(insets));assert.ok((await page.locator('section').nth(1).getByRole('status').innerText()).includes('Another phrase'));assert.ok(await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)<=innerWidth));await capture('long-independent-results',{audit:true});await page.setViewportSize({width:390,height:1600});
}
export async function check({page,mount,assert,capture=async()=>{}}) {
 for(const test of [workflow,controlled,unconfigured,empty,independent])await test({page,mount,assert,capture});await motionRegression({page,mount,assert});await capture('live-reduced-motion',{audit:true});for(const test of [reorderRegression,clearedRegression])await test({page,mount,assert});await page.emulateMedia({reducedMotion:'reduce'});
}
