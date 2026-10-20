const fixture=`window.liveSends=[];createRoot(document.getElementById('root')).render(<Subject.TeamWorkspace onSend={async(body,channelId)=>{window.liveSends.push({body,channelId});return{id:'posted-'+window.liveSends.length,authorId:'sam',body,time:'Now'}}}/>);`;
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
export async function check({page,mount,assert,capture=async()=>{}}){
  const outcomes=[];
  const touch=await page.evaluate(()=>matchMedia('(pointer:coarse)').matches);
  const sample=async(name)=>{
    await page.emulateMedia({reducedMotion:'reduce'});await frames(page);
    const proof=await page.evaluate(()=>{
      const root=document.querySelector('#root');
      return{theme:root.querySelector('main')?.classList.contains('bg-[#050505]')?'dark':'light',residual:[...root.querySelectorAll('[style], [data-token]')].flatMap(node=>{
        const box=node.getBoundingClientRect();if(!box.width||!box.height||box.bottom<=0||box.top>=innerHeight||node.closest('[inert], [hidden], [aria-hidden="true"]'))return[];
        const style=getComputedStyle(node),blur=Number(/blur\(([\d.]+)px\)/.exec(style.filter)?.[1]??0),moving=style.transform!=='none'&&!new DOMMatrixReadOnly(style.transform).isIdentity;
        return blur>.01||moving?[{tag:node.tagName,label:node.getAttribute('aria-label'),text:node.textContent?.trim().slice(0,90),filter:style.filter,transform:style.transform}]:[];
      })};
    });
    outcomes.push({name,...proof});
    await capture(name);
  };
  await page.setViewportSize({width:1440,height:940});await page.emulateMedia({reducedMotion:'no-preference'});await mount(fixture);
  const draft=page.getByRole('textbox',{name:'Message # studio',exact:true});await draft.fill('Ask @ma');
  const person=page.getByRole('option').filter({hasText:'Mara Vale'});if(touch)await person.tap();else await person.click();await page.waitForTimeout(35);await sample('live-mention-token');
  assert.equal(await draft.locator('[data-token="person"]').getAttribute('data-id'),'mara');
  assert.equal(await draft.evaluate(node=>node===document.activeElement),true,'Live reduction keeps the mention editor and caret');
  if(touch)await page.locator('[data-demo="send-studio"]').tap();else await draft.press('Control+Enter');await page.waitForFunction(()=>window.liveSends.length===1);
  await page.waitForFunction(()=>document.querySelector('[data-composer=\"studio\"] [role=\"textbox\"]')?.textContent==='');
  await page.getByRole('log',{name:'Messages',exact:true}).getByText('Ask @Mara',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.liveSends),[{body:'Ask @mara',channelId:'studio'}]);
  await capture('reduced-mention-sent',{audit:true});
  await page.emulateMedia({reducedMotion:'no-preference'});await mount(fixture);
  const row=page.getByRole('listitem',{name:'Mara Vale, 09:42',exact:true});if(touch){await row.tap();await page.locator('[data-demo="add-reaction-m1"]').tap()}else{await row.hover();await page.locator('[data-demo="add-reaction-m1"]').click()}
  const picker=page.getByRole('group',{name:'Add a reaction',exact:true});await picker.waitFor();await page.waitForTimeout(35);
  await page.evaluate(()=>{window.pickerFocus=document.activeElement});await sample('live-reaction-picker');
  assert.equal(await page.evaluate(()=>document.activeElement===window.pickerFocus),true,'Live reduction preserves the focused reaction option');
  if(touch)await picker.getByRole('button',{name:'Seen it',exact:true}).tap();else{await page.keyboard.press('End');await page.keyboard.press('Enter')}await sample('reduced-new-reaction');
  assert.equal(await page.locator('[data-demo="react-m1-seen"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(outcomes.filter(result=>result.residual.length),[],'Team mention and reaction motion must settle without losing focus');
}
