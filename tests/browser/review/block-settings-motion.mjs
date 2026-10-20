import fs from 'node:fs';
export async function check({page,mount,assert,capture=async()=>{}}) {
 const outcomes=[];
 for(const view of ['Profile','Notifications','Access policy']) {
  await page.setViewportSize({width:1440,height:940});await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`,{settle:view==='Profile'?0:800});
  if(view!=='Profile')await page.getByRole('tab',{name:view,exact:true}).click();
  await page.waitForTimeout(45);await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(45);
  const state=await page.locator('section [style*="filter"]').evaluateAll(nodes=>nodes.filter(node=>!node.closest('[hidden],[inert]')&&node.getBoundingClientRect().width>0).map(node=>({text:node.textContent?.slice(0,55),filter:getComputedStyle(node).filter,transform:getComputedStyle(node).transform})).filter(row=>!['none','blur(0px)'].includes(row.filter)||!['none','matrix(1, 0, 0, 1, 0, 0)'].includes(row.transform)));
  outcomes.push({view,pass:!state.length,actual:state});await capture('live-motion-'+view.replaceAll(' ','-').toLowerCase());
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 const out=process.env.DFA_DRAFT_QA_OUT;if(out)fs.writeFileSync(out+'/live-motion-outcomes.json',JSON.stringify(outcomes,null,2)+'\n');assert.deepEqual(outcomes.filter(row=>!row.pass),[],'Every visible Settings entrance must settle immediately when reduced motion changes');
}
