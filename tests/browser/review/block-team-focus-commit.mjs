import fs from 'node:fs';
export async function check({page,mount,assert,capture=async()=>{}}){
  await page.emulateMedia({reducedMotion:'reduce'});
  await mount(`window.teamJobs=[];createRoot(document.getElementById('root')).render(<Subject.TeamWorkspace channels={[{id:'alpha',name:'# alpha',description:'A working room'}]} initialMessages={{alpha:[]}} onSend={(body,channelId)=>new Promise(resolve=>window.teamJobs.push({body,channelId,resolve}))}/>);`);
  const draft=page.getByRole('textbox',{name:'Message # alpha',exact:true});
  await draft.fill('Keep the editor ready.');await draft.press('Control+Enter');await page.waitForFunction(()=>window.teamJobs.length===1);
  await page.evaluate(async()=>{
    const native=requestAnimationFrame;const frames=[];window.oldEditor=document.activeElement;
    window.requestAnimationFrame=callback=>{
      if(/\.focus\(/.test(String(callback))){frames.push(callback);return 2147483000+frames.length}
      return native(callback);
    };
    window.teamJobs[0].resolve({id:'accepted',authorId:'sam',body:'Keep the editor ready.',time:'09:20'});
    await Promise.resolve();
    window.earlyFocus={frames:frames.length,oldEditorConnected:window.oldEditor.isConnected};
    for(const callback of frames)callback(performance.now());
    window.requestAnimationFrame=native;
  });
  await page.waitForFunction(()=>!window.oldEditor.isConnected&&document.querySelector('[data-composer="alpha"] [role="textbox"]')?.textContent==='');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await capture('accepted-send-after-commit',{audit:true});
  const proof=await page.evaluate(()=>({early:window.earlyFocus,active:{tag:document.activeElement?.tagName,role:document.activeElement?.getAttribute('role')},accepted:document.body.innerText.includes('Keep the editor ready.')}));
  if(process.env.DFA_DRAFT_QA_OUT)fs.writeFileSync(process.env.DFA_DRAFT_QA_OUT+'/focus-commit-proof.json',JSON.stringify(proof,null,2)+'\n');
  assert.equal(proof.accepted,true);assert.equal(proof.active.role,'textbox','A pre-commit focus frame must not strand focus when the editor is replaced');
}
