import fs from 'node:fs';
export async function check({page,mount,assert,capture=async()=>{}}) {
 assert.equal(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches),true);
 const results=[];
 await mount(`createRoot(document.getElementById('root')).render(<Subject.default scopes={[]}/>);`);
 assert.equal(await page.getByRole('combobox').isDisabled(),true);
 assert.equal(await page.getByRole('combobox').innerText(),'No departments available');
 await page.getByText('No departments yet.',{exact:true}).waitFor();
 await capture('touch-empty-departments',{audit:true});
 for(const width of [320,390]){
  await page.setViewportSize({width,height:940});await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
  const measure=async view=>{
   const targets=await page.locator('button:not(:disabled),select:not(:disabled),input[type=checkbox]:not(:disabled),[role=option]').evaluateAll(nodes=>nodes.filter(node=>!node.closest('[inert],[hidden],[aria-hidden="true"]')&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden').map(node=>{const hit=node.labels?.[0]??node,b=hit.getBoundingClientRect();return{name:node.getAttribute('aria-label')??node.textContent.trim(),width:b.width,height:b.height}}));
   assert.equal(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth+1),true,'Phone document width stays bounded');
   const frame=await page.locator('[class~="h-[820px]"]').boundingBox(),footer=await page.locator('footer').boundingBox();assert.ok(footer.y+footer.height<=frame.y+frame.height+1&&footer.y+footer.height<=940,'Phone footer stays in its frame');
   results.push({width,view,targets});await capture(`touch-${width}-${view}`,{audit:true});
  };
  await measure('people');
  await page.getByRole('button',{name:'Department: All departments',exact:true}).tap();await measure('department-options');await page.getByRole('listbox',{name:'Departments',exact:true}).locator('[data-value="Commercial"]').tap();await page.getByRole('radio',{name:'60d',exact:true}).tap();
  await page.getByRole('tab',{name:'Onboarding',exact:true}).tap();await measure('onboarding');
  await page.getByRole('button',{name:/^Workspace and account access/}).tap();
  await page.getByRole('textbox',{name:'Completion note',exact:true}).fill('Access checked on phone.');
  await page.getByRole('checkbox',{name:'I confirm this step is complete for Noor Ali.',exact:true}).tap();await measure('task');
  await page.getByRole('button',{name:'Record completion',exact:true}).tap();await page.getByRole('status').filter({hasText:'Step recorded'}).waitFor();await measure('completion');
  const team=page.getByRole('checkbox',{name:'Mark “Meet the team” done for Noor Ali',exact:true});await page.locator('label').filter({has:team}).tap({position:{x:2,y:2}});await page.getByRole('status').filter({hasText:'Step recorded · Meet the team'}).waitFor();assert.equal(await page.getByRole('checkbox',{name:'Mark “Meet the team” not done for Noor Ali',exact:true}).isChecked(),true);assert.equal(await page.getByRole('button',{name:'Record completion',exact:true}).count(),0);await measure('quick-tick');
  await page.getByRole('tab',{name:'Leave review',exact:true}).tap();await measure('leave');
  await page.getByRole('textbox',{name:'Note to Noor',exact:true}).fill('Coverage checked on phone.');
  await page.getByRole('button',{name:'Approve',exact:true}).tap();await page.getByRole('status').filter({hasText:'Leave approved'}).waitFor();await measure('decision');
 }
 const theme=await page.evaluate(()=>getComputedStyle(document.querySelector('header')).colorScheme==='light'?'light':'dark');
 if(process.env.DFA_DRAFT_QA_OUT)fs.writeFileSync(process.env.DFA_DRAFT_QA_OUT+'/touch-targets-'+theme+'.json',JSON.stringify(results,null,2)+'\n');
 assert.deepEqual(results.flatMap(row=>row.targets.filter(target=>target.width<43.5||target.height<43.5).map(target=>({viewport:row.width,view:row.view,...target}))),[],'Every enabled phone action has a44px target');
}
