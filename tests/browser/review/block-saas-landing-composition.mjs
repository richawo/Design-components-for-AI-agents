import fs from 'node:fs';
async function checkControls({page,mount,assert,capture=async()=>{}}){
 const outcomes=[];
 for(const width of [320,390]){
  await page.setViewportSize({width,height:1050});await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
  await page.getByText('Report export',{exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(500);
  const data=await page.getByRole('tablist',{name:'Choose a plan to compare',exact:true}).evaluate(list=>{
   const header=document.querySelector('[data-demo="header"]').getBoundingClientRect();
   const tabs=[...list.querySelectorAll('[role="tab"]')].map(tab=>{const box=tab.getBoundingClientRect();return {label:tab.textContent.trim(),box:box.toJSON(),centerHitsTab:tab.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2))}});
   const bar=list.parentElement,unit=[...bar.querySelectorAll('span')].find(node=>node.textContent.trim()==='per workspace / month');
   return {header:header.toJSON(),tabs,unit:unit?{box:unit.getBoundingClientRect().toJSON(),scrollWidth:unit.scrollWidth,clientWidth:unit.clientWidth,text:unit.textContent}:null};
  });
  outcomes.push({name:'phone-'+width+'-comparison-tabs-clear-header',pass:data.tabs.every(tab=>tab.box.y>=data.header.bottom-1&&tab.centerHitsTab),data});
  outcomes.push({name:'phone-'+width+'-complete-price-unit',pass:!!data.unit&&data.unit.scrollWidth<=data.unit.clientWidth+1,data:data.unit});
  await capture('phone-'+width+'-comparison-header',{viewport:true,audit:process.env.DFA_ORIGINAL_PROOF!=='1'});
 }
 await page.setViewportSize({width:1440,height:1050});await mount(`createRoot(document.getElementById('root')).render(<Subject.default groups={[]}/>);`);await page.getByRole('heading',{name:'Choose the room you need.',exact:true}).scrollIntoViewIfNeeded();
 const collapse=page.getByRole('button',{name:'Collapse all',exact:true});outcomes.push({name:'empty-features-no-enabled-collapse',pass:await collapse.count()===0||await collapse.isDisabled()});await capture('empty-feature-groups',{viewport:true,audit:process.env.DFA_ORIGINAL_PROOF!=='1'});
 await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
 outcomes.push({name:'hero-word-rotation-label',pass:await page.getByRole('button',{name:'Show the next word',exact:true}).count()===1&&await page.getByRole('button',{name:/client name/i}).count()===0});await capture('hero-rotation-label',{viewport:true,audit:process.env.DFA_ORIGINAL_PROOF!=='1'});
 if(process.env.DFA_DRAFT_QA_OUT)fs.writeFileSync(process.env.DFA_DRAFT_QA_OUT+'/composition-outcomes.json',JSON.stringify(outcomes,null,2)+'\n');
 assert.deepEqual(outcomes.filter(outcome=>!outcome.pass),[],'Landing composition controls and price copy');
}

async function checkOffer({page,mount,assert,capture=async()=>{}}){
 const records=[];
 for(const width of [320,390]){
  await page.setViewportSize({width,height:1050});await mount(`createRoot(document.getElementById('root')).render(<Subject.SaasLanding plans={[{id:'research',name:'Research studio',price:'£24',unit:'per workspace / calendar month, billed annually',blurb:'Shared client and project records'}]} groups={[]} onStart={async()=>{}}/>);`);
  const link=page.getByRole('link',{name:'Choose Research studio',exact:true});await link.scrollIntoViewIfNeeded();await page.waitForTimeout(350);
  const data=await link.evaluate(link=>{const grid=link.parentElement,price=grid.querySelectorAll('p')[1],range=document.createRange();range.selectNodeContents(price.querySelector('[aria-hidden="true"]')??price);const text=range.getBoundingClientRect(),button=link.getBoundingClientRect();return {price:text.toJSON(),button:button.toJSON(),document:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),viewport:innerWidth}});
  records.push({width,pass:data.document<=width+1&&(data.price.right+6<=data.button.x||data.price.bottom+6<=data.button.y),data});await capture('phone-'+width+'-complete-offer',{viewport:true,audit:process.env.DFA_ORIGINAL_PROOF!=='1'});
 }
 if(process.env.DFA_DRAFT_QA_OUT)fs.writeFileSync(process.env.DFA_DRAFT_QA_OUT+'/offer-bounds.json',JSON.stringify(records,null,2)+'\n');assert.deepEqual(records.filter(record=>!record.pass),[],'A supplied plan name cannot make its action cover the price');
}

async function checkLiveScroll({page,mount,assert,capture=async()=>{}}){
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1050});await mount(`createRoot(document.getElementById('root')).render(<Subject.SaasLanding/>);`);
 await page.evaluate(()=>{window.__landingScrollRequests=[];const original=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){window.__landingScrollRequests.push({id:this.id,options});return original.call(this,options)}});
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Show the next word',exact:true}).waitFor();
 await page.locator('header').getByRole('link',{name:'Workflow',exact:true}).click();const requests=await page.evaluate(()=>window.__landingScrollRequests);if(process.env.DFA_DRAFT_QA_OUT)fs.writeFileSync(process.env.DFA_DRAFT_QA_OUT+'/live-scroll.json',JSON.stringify(requests,null,2)+'\n');await capture('live-reduced-navigation',{viewport:true});assert.ok(requests.length>0);assert.equal(requests.at(-1).options.behavior,'auto','Landing reads the current motion preference for navigation');
}

async function checkJourney({page,mount,assert,capture=async()=>{}}){
 for(const width of [320,1440]){
  await page.setViewportSize({width,height:1050});await page.emulateMedia({reducedMotion:'reduce'});
  await mount(`window.landingJourney=[];createRoot(document.getElementById('root')).render(<Subject.SaasLanding onStart={async request=>{window.landingJourney.push(request)}}/>);`);
  const navigate=async name=>{
   const menu=page.getByRole('button',{name:'Open menu',exact:true});
   if(await menu.isVisible()){await menu.press('Enter');await page.getByRole('dialog',{name:'Site menu',exact:true}).getByRole('link',{name,exact:true}).press('Enter');await page.getByRole('dialog',{name:'Site menu',exact:true}).waitFor({state:'hidden'});assert.notEqual(await page.locator('body').evaluate(node=>getComputedStyle(node).overflow),'hidden')}
   else await page.locator('header').getByRole('link',{name,exact:true}).press('Enter');
  };
  await navigate('Workflow');
  for(const [index,name] of ['Review','Record','Allocate'].entries()){
   const panel=page.getByRole('img',{name:'Ledgerline app: '+name,exact:true});
   if(width>=1024){await page.getByRole('button',{name:`Go to step ${index+2}: ${name}`,exact:true}).press('Enter')}
   else await panel.scrollIntoViewIfNeeded();
   await panel.waitFor();if(width>=1024)assert.equal(await page.getByRole('button',{name:`Go to step ${index+2}: ${name}`,exact:true}).getAttribute('aria-current'),'step');
   if(name==='Review'){assert.match(await panel.innerText(),/£3,000/);assert.doesNotMatch(await panel.innerText(),/GBP/)}
  }
  if(width>=1024)assert.equal(await page.getByRole('button',{name:'Next step',exact:true}).isDisabled(),true);await capture('journey-'+width+'-allocated-workflow',{viewport:true,audit:true});
  await navigate('Plans');if(width<768)await page.getByRole('tab',{name:'Team',exact:true}).press('Enter');
  await page.getByRole('link',{name:'Choose Team',exact:true}).press('Enter');await page.getByRole('heading',{name:'Your Team workspace.',exact:true}).waitFor();
  const input=page.getByRole('textbox',{name:'Email address',exact:true});await input.fill('member@team.example');
  await capture('journey-'+width+'-team-draft',{viewport:true,audit:true});await input.press('Enter');await page.getByText('Your Team workspace request is received.',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.landingJourney),[{email:'member@team.example',planId:'team'}]);await capture('journey-'+width+'-team-received',{viewport:true,audit:true});
 }
}

async function checkIndependentInstances({page,mount,assert,capture=async()=>{}}){
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:1050});
 await mount(`window.separateRequests=[];createRoot(document.getElementById('root')).render(<><div data-instance="first"><Subject.SaasLanding onStart={request=>{window.separateRequests.push({instance:'first',...request});return new Promise(resolve=>window.finishFirst=resolve)}}/></div><div data-instance="second"><Subject.SaasLanding onStart={async request=>{window.separateRequests.push({instance:'second',...request})}}/></div></>);`);
 const first=page.locator('[data-instance=first]'),second=page.locator('[data-instance=second]');
 await first.getByRole('link',{name:'Choose Studio',exact:true}).press('Enter');await first.getByRole('textbox',{name:'Email address',exact:true}).fill('first@studio.example');await first.getByRole('button',{name:'Request',exact:true}).press('Enter');await page.waitForFunction(()=>!!window.finishFirst);
 await second.getByRole('link',{name:'Choose Team',exact:true}).press('Enter');const input=second.getByRole('textbox',{name:'Email address',exact:true});await input.fill('second@team.example');await input.press('Enter');await second.getByText('Your Team workspace request is received.',{exact:true}).waitFor();await second.getByRole('button',{name:'Use a different email',exact:true}).press('Enter');await input.fill('next@team.example');
 await page.evaluate(()=>window.finishFirst());await first.getByText('Your Studio workspace request is received.',{exact:true}).waitFor();
 assert.equal(await input.evaluate(node=>node===document.activeElement),true,'A separate accepted reply cannot take the active draft focus');assert.equal(await input.inputValue(),'next@team.example');assert.deepEqual(await page.evaluate(()=>window.separateRequests),[{instance:'first',email:'first@studio.example',planId:'studio'},{instance:'second',email:'second@team.example',planId:'team'}]);
 const ids=await page.locator('[id]').evaluateAll(nodes=>nodes.map(node=>node.id));assert.equal(new Set(ids).size,ids.length,'Independent landing pages retain distinct control and anchor IDs');await capture('independent-page-next-draft',{viewport:true,audit:true});
}

export async function check(context){
 if(process.env.DFA_DRAFT_QA_OUT)fs.mkdirSync(process.env.DFA_DRAFT_QA_OUT,{recursive:true});
 await checkControls(context);await checkOffer(context);await checkJourney(context);await checkLiveScroll(context);await checkIndependentInstances(context);
}
