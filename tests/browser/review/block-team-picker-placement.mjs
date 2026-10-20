const fixture=`createRoot(document.getElementById('root')).render(<Subject.TeamWorkspace/>);`;
export async function check({page,mount,assert,capture=async()=>{}}){
  await page.emulateMedia({reducedMotion:'reduce'});const outcomes=[];
  const geometry=()=>page.evaluate(()=>{
    const trigger=document.querySelector('[data-demo="add-reaction-m1"]');const log=trigger.closest('[role="log"]'),clip=log.getBoundingClientRect();
    const test=node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{label:node.getAttribute('aria-label'),width:r.width,height:r.height,visibleWidth:Math.max(0,Math.min(r.right,clip.right)-Math.max(r.left,clip.left)),visibleHeight:Math.max(0,Math.min(r.bottom,clip.bottom)-Math.max(r.top,clip.top)),hit:!!hit&&(node===hit||node.contains(hit))}};
    const bar=trigger.parentElement.parentElement.getBoundingClientRect(),row=trigger.closest('li[aria-label]');const headerOverlap=[...row.querySelectorAll('h3, time')].some(node=>{const r=node.getBoundingClientRect();return Math.max(0,Math.min(r.right,bar.right)-Math.max(r.left,bar.left))*Math.max(0,Math.min(r.bottom,bar.bottom)-Math.max(r.top,bar.top))>.5});
    return{coarse:matchMedia('(pointer:coarse)').matches,headerOverlap,trigger:test(trigger),options:[...document.querySelectorAll('[aria-label="Add a reaction"] button')].map(test)};
  });
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:940});await mount(fixture);
    const row=page.getByRole('listitem',{name:'Mara Vale, 09:42',exact:true});
    if(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches))await row.tap();else await row.hover();
    if(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches))await page.locator('[data-demo="add-reaction-m1"]').tap();else await page.locator('[data-demo="add-reaction-m1"]').click();await page.getByRole('group',{name:'Add a reaction',exact:true}).waitFor();
    await capture('picker-first-'+width,{audit:true});const proof=await geometry();outcomes.push({name:'first-row-'+width,...proof});
    if(proof.options.length===4&&proof.options.every(item=>item.hit)){
      if(proof.coarse)await page.getByRole('button',{name:'Seen it',exact:true}).tap();else await page.getByRole('button',{name:'Seen it',exact:true}).click();
      assert.equal(await page.locator('[data-demo="react-m1-seen"]').getAttribute('aria-pressed'),'true');
    }
    await mount(fixture);const noor=page.getByRole('listitem',{name:'Noor Ali, 09:44',exact:true});
    if(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches))await noor.tap();else await noor.hover();
    const trigger=page.locator('[data-demo="add-reaction-m2"]');const touch=await page.evaluate(()=>matchMedia('(pointer:coarse)').matches);if(touch)await trigger.tap();else await trigger.click();await page.getByRole('group',{name:'Add a reaction',exact:true}).waitFor();
    if(touch)await trigger.tap();else await trigger.click();await page.waitForTimeout(300);const open=await page.getByRole('group',{name:'Add a reaction',exact:true}).count();outcomes.push({name:'trigger-toggle-'+width,open});await capture('picker-toggle-'+width);
  }
  assert.deepEqual(outcomes.filter(result=>result.options?(result.headerOverlap||result.options.length!==4||!result.options.every(item=>item.hit&&item.visibleHeight>=item.height-.5&&item.visibleWidth>=item.width-.5)||!result.trigger.hit||result.trigger.visibleHeight<result.trigger.height-.5):result.open!==0),[],'Reaction controls must remain fully visible, accept pointer clicks and close on their trigger');
}
