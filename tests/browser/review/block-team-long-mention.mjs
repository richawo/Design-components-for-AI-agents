const fixture=`window.longSends=[];createRoot(document.getElementById('root')).render(<Subject.TeamWorkspace onSend={async(body,channelId)=>{window.longSends.push({body,channelId});return{id:'long-post',authorId:'sam',body,time:'Now'}}}/>);`;
export async function check({page,mount,assert,capture=async()=>{}}){
 await page.emulateMedia({reducedMotion:'reduce'});const touch=await page.evaluate(()=>matchMedia('(pointer:coarse)').matches),outcomes=[];
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:940});await mount(fixture);
  const body=Array.from({length:40},(_,i)=>'Draft line '+(i+1)+': keep the complete message.').join('\n');
  const field=page.getByRole('textbox',{name:'Message # studio',exact:true});await field.fill(body);
  await field.evaluate(node=>{node.focus();const r=document.createRange();r.selectNodeContents(node);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r)});
  await field.pressSequentially(' @ma');await page.getByRole('option').waitFor();
  await capture('long-mention-open-'+width);
  const proof=await page.getByRole('option').evaluate(node=>{const r=node.getBoundingClientRect();let top=0,bottom=innerHeight,left=0,right=innerWidth;for(let p=node.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowY)){top=Math.max(top,b.top+p.clientTop);bottom=Math.min(bottom,b.top+p.clientTop+p.clientHeight)}if(/auto|scroll|hidden|clip/.test(s.overflowX)){left=Math.max(left,b.left+p.clientLeft);right=Math.min(right,b.left+p.clientLeft+p.clientWidth)}}const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{width:r.width,height:r.height,visibleWidth:Math.max(0,Math.min(r.right,right)-Math.max(r.left,left)),visibleHeight:Math.max(0,Math.min(r.bottom,bottom)-Math.max(r.top,top)),hit:!!hit&&(node===hit||node.contains(hit))}});
  const fits=proof.height>=44&&proof.visibleWidth>=proof.width-.5&&proof.visibleHeight>=proof.height-.5&&proof.hit;outcomes.push({width,...proof,fits});
  if(fits){
   const option=page.getByRole('option').filter({hasText:'Mara Vale'});if(touch)await option.tap();else await option.click();
   assert.equal(await field.locator('[data-token="person"]').getAttribute('data-id'),'mara');
   if(touch)await page.locator('[data-demo="send-studio"]').tap();else await field.press('Control+Enter');
   await page.waitForFunction(()=>window.longSends.length===1&&document.querySelector('[data-composer="studio"] [role="textbox"]')?.textContent==='');
   assert.deepEqual(await page.evaluate(()=>window.longSends),[{body:body+' @mara',channelId:'studio'}]);await capture('long-mention-sent-'+width,{audit:true});
  }
 }
 assert.deepEqual(outcomes.filter(result=>!result.fits),[],'Long-draft mention choices fit the actual clipped workspace and accept pointer selection');
}
