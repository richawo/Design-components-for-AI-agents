const fixture=`createRoot(document.getElementById('root')).render(<Subject.TeamWorkspace onSend={async(body)=>({id:'preview-post',authorId:'sam',body,time:'Now'})}/>);`;
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
export async function check({page,mount,assert,capture=async()=>{}}){
  const outcomes=[];
  const sample=async(name)=>{
    await page.emulateMedia({reducedMotion:'reduce'});await frames(page);
    const proof=await page.evaluate(()=>{
      const root=document.querySelector('#root');
      const residual=[...root.querySelectorAll('[style]')].flatMap(node=>{
        const box=node.getBoundingClientRect();if(!box.width||!box.height||box.bottom<=0||box.top>=innerHeight||node.closest('[inert], [hidden], [aria-hidden="true"]'))return[];
        const style=getComputedStyle(node);const blur=Number(/blur\(([\d.]+)px\)/.exec(style.filter)?.[1]??0);
        const moving=style.transform!=='none'&&!new DOMMatrixReadOnly(style.transform).isIdentity;
        return blur>.01||moving?[{tag:node.tagName,label:node.getAttribute('aria-label'),demo:node.getAttribute('data-demo'),text:node.textContent?.trim().slice(0,90),filter:style.filter,transform:style.transform}]:[];
      });
      return{width:innerWidth,theme:root.querySelector('main')?.classList.contains('bg-[#050505]')?'dark':'light',residual};
    });
    outcomes.push({name,...proof});
    await capture(name);
  };
  for(const width of [390,1440]){
    await page.setViewportSize({width,height:940});await page.emulateMedia({reducedMotion:'no-preference'});await mount(fixture,{settle:0});await page.waitForTimeout(80);await sample('live-entry-'+width);
  }
  await page.setViewportSize({width:1440,height:940});await page.emulateMedia({reducedMotion:'no-preference'});await mount(fixture);
  await page.locator('[data-demo="reply-m1"]').click();await page.waitForTimeout(45);await sample('live-thread-entry');
  await page.emulateMedia({reducedMotion:'no-preference'});await mount(fixture);await page.locator('[data-demo="react-m1-like"]').click();await page.waitForTimeout(35);await sample('live-reaction');
  assert.deepEqual(outcomes.filter(result=>result.residual.length),[],'Team visible transforms and blur must settle within two frames after live reduction');
}
