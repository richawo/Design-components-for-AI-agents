import fs from 'node:fs';

async function stalePermissionPreference({page,mount,assert,capture}) {
 const stale=`window.__settingsNativeMotionQuery=window.matchMedia.bind(window);window.matchMedia=query=>/prefers-reduced-motion/.test(query)?{matches:false,media:query,onchange:null,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){},dispatchEvent(){return true}}:window.__settingsNativeMotionQuery(query);`;
 await page.emulateMedia({reducedMotion:'no-preference'});
 await mount(stale+`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
 await page.getByRole('tab',{name:'Access policy',exact:true}).click();
 await page.locator('.pm-root').waitFor({state:'visible'});
 await page.waitForTimeout(45);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForTimeout(45);
 const state=await page.evaluate(()=>{
  const entries=[...document.querySelectorAll('.pm-root [data-pm-entry]')].filter(node=>!node.closest('[hidden],[inert]')&&node.getBoundingClientRect().width>0).map(node=>{
   const style=getComputedStyle(node);return {text:node.textContent?.slice(0,55),filter:style.filter,transform:style.transform,opacity:Number(style.opacity)};
  });
  return {nativeReduced:window.__settingsNativeMotionQuery('(prefers-reduced-motion: reduce)').matches,observedReduced:matchMedia('(prefers-reduced-motion: reduce)').matches,entries};
 });
 assert.equal(state.nativeReduced,true);
 assert.equal(state.observedReduced,false,'Exercise the native CSS boundary before JavaScript observes the new preference');
 assert.ok(state.entries.length>=9,'The policy must expose real entrance content');
 const actual=state.entries.filter(row=>!['none','blur(0px)'].includes(row.filter)||!['none','matrix(1, 0, 0, 1, 0, 0)'].includes(row.transform)||row.opacity!==1);
 await capture('live-motion-stale-policy-observer');
 const oldPermission=await page.locator('.pm-root [data-demo="permission-viewer-export"]').elementHandle();
 assert.ok(oldPermission,'Keep the actual policy control across retirement');
 assert.equal(await oldPermission.evaluate(node=>{node.focus();return node.ownerDocument.activeElement===node;}),true);
 await page.getByRole('tab',{name:'Profile',exact:true}).click();
 assert.equal(await oldPermission.evaluate(node=>{node.focus();return node.ownerDocument.activeElement===node;}),false,'A retired policy control cannot reclaim focus');
 await oldPermission.dispose();
 return {view:'Access policy with a stale preference observer',pass:!actual.length,actual};
}

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
 outcomes.push(await stalePermissionPreference({page,mount,assert,capture}));
 await page.emulateMedia({reducedMotion:'reduce'});
 const out=process.env.DFA_DRAFT_QA_OUT;if(out)fs.writeFileSync(out+'/live-motion-outcomes.json',JSON.stringify(outcomes,null,2)+'\n');assert.deepEqual(outcomes.filter(row=>!row.pass),[],'Every visible Settings entrance must settle immediately when reduced motion changes');
}
