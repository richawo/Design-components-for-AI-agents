import {check as checkOrderPhone} from '../review/dashboard-orders-table-phone.mjs';
import {check as checkOrderContrast} from '../review/dashboard-orders-table-contrast.mjs';

export async function check(context){
 const {page,mount,assert,capture=async()=>{}}=context; const initialViewport=page.viewportSize();context={...context,capture};await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:1440,height:1500});await legacy(context);await modified(context);await brand(context);
 await checkOrderContrast(context);await checkOrderPhone(context);
 const prepareReturn=async()=>{
  const tab=page.getByRole('tab',{name:'Returns',exact:true});await tab.focus();await tab.press('Enter');
  await page.getByRole('checkbox',{name:'Return Merino crew',exact:true}).check();await page.getByRole('radio',{name:'The fit was not right',exact:true}).check();
 };
 const choosePeriod=async label=>{await page.getByRole('combobox').first().click();await page.getByRole('option',{name:label,exact:true}).click()};
 await mount(`window.returnJobs=[];createRoot(document.getElementById('root')).render(<Subject.CommerceWorkspace onReturn={payload=>new Promise((resolve,reject)=>window.returnJobs.push({payload:JSON.parse(JSON.stringify(payload)),resolve,reject}))}/>);`);
 await prepareReturn();await page.getByRole('textbox',{name:/Internal note/}).fill('Keep the original period attached to this request.');await page.getByRole('button',{name:'Review return',exact:true}).click();await page.getByRole('button',{name:'Submit return',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.returnJobs.length===1);
 assert.equal(await page.getByRole('button',{name:/Submitting/}).isDisabled(),true);await capture('pending-return',{audit:true});
 await choosePeriod('1–6 October');assert.equal(await page.getByRole('textbox',{name:/Internal note/}).inputValue(),'');await capture('different-period-pending',{audit:true});
 await page.evaluate(()=>window.returnJobs[0].resolve({reference:'RETURN-PENDING'}));
 const retiredReceipt=page.getByText('RETURN-PENDING · Return request recorded',{exact:true});
 // Retired panels are inert immediately and finish their visual fade separately.
 assert.equal(await retiredReceipt.evaluate(node=>Boolean(node.closest('[data-workspace-panel][inert][aria-hidden="true"]'))),true);
 assert.equal(await page.getByRole('status').filter({hasText:'RETURN-PENDING'}).count(),0);
 await retiredReceipt.waitFor({state:'hidden'});
 await choosePeriod('7–12 October');await page.getByText('RETURN-PENDING · Return request recorded',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.returnJobs.map(job=>job.payload)),[{periodId:'oct',request:{orderId:'ORD-1042',lines:[{itemId:'crew',quantity:1}],reasonId:'fit',resolution:'refund',note:'Keep the original period attached to this request.',expectedAmountMinor:'12500'}}]);
 await mount(`function Host(){const[periods,setPeriods]=React.useState([]);window.loadStorePeriod=()=>setPeriods([{id:'opening',label:'Opening week',metrics:[],orders:[],returns:[]}]);return <Subject.CommerceWorkspace periods={periods}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 assert.equal(await page.getByText('No reporting periods yet.',{exact:true}).count(),1);await page.evaluate(()=>window.loadStorePeriod());await page.getByText('No comparable store measures for this period.',{exact:true}).waitFor();await page.getByRole('tab',{name:'Returns',exact:true}).click();await page.getByText('No orders are available for return.',{exact:true}).waitFor();assert.equal((await page.getByRole('combobox').last().innerText()).trim(),'No orders to return');assert.equal(await page.getByRole('combobox').last().isDisabled(),true);await capture('arriving-empty-period',{audit:true});
 await mount(`createRoot(document.getElementById('root')).render(<Subject.CommerceWorkspace/>);`);await prepareReturn();await page.getByRole('button',{name:'Review return',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Submit return',exact:true}).isDisabled(),true);assert.equal(await page.getByText('Return requests are unavailable.',{exact:true}).count(),1);await capture('return-handler-unavailable',{audit:true});
 for(const width of[320,390]){
  await page.setViewportSize({width,height:940});await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
  for(const name of['Orders','Returns']){const tab=page.getByRole('tab',{name,exact:true});await tab.focus();await tab.press('Enter');await page.getByRole('heading',{name,exact:true}).waitFor();await capture('phone-'+width+'-'+name.toLowerCase(),{audit:true});}
  await page.getByRole('checkbox',{name:'Return Merino crew',exact:true}).check();await page.getByRole('radio',{name:'The fit was not right',exact:true}).check();const review=page.getByRole('button',{name:'Review return',exact:true});await review.focus();assert.equal(await review.evaluate(node=>{const r=node.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===node}),true,'Keyboard focus exposes the actual return action inside the phone pane');
 }
 if(initialViewport)await page.setViewportSize(initialViewport);
}

async function legacy({ page, mount, assert, capture=async()=>{} }) {
  await mount(
    `window.calls=[];window.attempt=0;createRoot(document.getElementById('root')).render(<Subject.CommerceWorkspace onReturn={async payload=>{window.calls.push(payload);if(!window.attempt++)throw Error('fixture');return {reference:'RETURN-FIXTURE'};}}/>);`,
  );
  await capture("overview",{audit:true});
  await page.getByRole("link", { name: "Open order workspace", exact: true }).click();
  await page.getByRole("heading", { name: "Order workspace", exact: true }).waitFor();
  await capture("order-workspace",{audit:true});
  await page.getByRole("link", { name: "Back to overview", exact: true }).click();
  await page.getByRole("tab", { name: "Returns", exact: true }).click();
  await page.getByRole("checkbox", { name: "Return Merino crew", exact: true }).check();
  await page.getByRole("radio", { name: "The fit was not right", exact: true }).check();
  const note = page.getByRole("textbox", { name: /Internal note/ });
  await note.fill("Please retain the reviewed return note.");
  const selector = page.getByRole("combobox").first();
  await selector.click();
  const labels = await page.getByRole("option").allTextContents();
  await page.getByRole("option").last().click();
  await selector.click();
  await page.getByRole("option", { name: labels[0].trim(), exact: true }).click();
  assert.equal(await note.inputValue(), "Please retain the reviewed return note.");
  await capture("retained-return",{audit:true});
  await page.getByRole("button", { name: /Review return/ }).click();
  await page.getByRole("button", { name: /Submit return/ }).click();
  await page.getByRole("alert").filter({ hasText: "fixture" }).waitFor();
  await capture("rejected-return",{audit:true});
  await page.getByRole("button", { name: /Submit return/ }).click();
  await page.getByText("RETURN-FIXTURE · Return request recorded", { exact: true }).waitFor();
  await capture("recorded-return",{audit:true});
  const calls = await page.evaluate(() => window.calls);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], {
    periodId: "oct",
    request: {
      orderId: "ORD-1042",
      lines: [{ itemId: "crew", quantity: 1 }],
      reasonId: "fit",
      resolution: "refund",
      note: "Please retain the reviewed return note.",
      expectedAmountMinor: "12500",
    },
  });
  assert.deepEqual(calls[0], calls[1]);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CommerceWorkspace periods={[]}/>);`);
  assert.ok(await page.getByText("No reporting periods yet.").isVisible());
  assert.equal((await page.getByRole("combobox").innerText()).trim(), "No reporting periods");
  assert.equal(await page.getByRole("combobox").isDisabled(), true);
  await capture("empty-periods",{audit:true});
}

async function modified({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.CommerceWorkspace/>);`);
 const link=page.getByRole('link',{name:'Open order workspace',exact:true});
 await link.evaluate(node=>{
  node.addEventListener('click',event=>event.preventDefault(),{once:true});
  node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0,metaKey:true}));
 });
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.getByRole('tab',{name:'Overview',exact:true}).getAttribute('aria-selected'),'true','Modified order links preserve the current workspace view');
}

async function brand({page,mount,assert,capture=async()=>{}}){
 await page.setViewportSize({width:1440,height:1500});await mount(`createRoot(document.getElementById('root')).render(<Subject.CommerceWorkspace brand="Dover Goods"/>);`);await page.getByRole('tab',{name:'Returns',exact:true}).click();
 const pane=page.getByRole('tabpanel',{name:'Returns',exact:true});assert.equal(await pane.getByText('Dover Goods',{exact:true}).evaluateAll(nodes=>nodes.filter(node=>!node.closest('[inert]')).length),1,'The return desk uses the same store identity as its workspace');await capture('custom-store-brand',{audit:true});
}
