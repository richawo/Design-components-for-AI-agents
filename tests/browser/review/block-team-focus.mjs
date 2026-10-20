const data = `
window.teamChannels=[{id:'alpha',name:'# alpha',description:'The alpha working room'},{id:'beta',name:'# beta',description:'The beta working room'}];
window.teamInitial={alpha:[{id:'original',authorId:'mara',body:'The original release note.',time:'09:00',reactions:[{id:'like',count:1}],replyCount:1}],beta:[]};
window.teamJobs=[];
function Host(){const[channels,setChannels]=React.useState(window.teamChannels);window.replaceTeamChannels=setChannels;return <><Subject.TeamWorkspace channels={channels} initialMessages={window.teamInitial} onSend={(body,channelId)=>new Promise((resolve,reject)=>window.teamJobs.push({body,channelId,resolve,reject}))}/><button type="button" id="outside">Outside action</button><div id="outside-space" style={{height:64,background:"#333"}}>Outside space</div></>};createRoot(document.getElementById('root')).render(<Host/>);`;
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.emulateMedia({reducedMotion:'reduce'});
  const failures=[];
  const attempt=async(name,run)=>{try{await run();console.log('PASS '+name)}catch(error){failures.push({name,message:String(error.message)});console.log('FAIL '+name+': '+error.message)}};
  const draft=id=>page.getByRole('textbox',{name:'Message # '+id,exact:true});
  const holdFocus=()=>page.evaluate(()=>{
    window.heldFocus=[];const native=requestAnimationFrame;
    window.restoreFocusFrames=()=>{window.requestAnimationFrame=native};
    window.requestAnimationFrame=callback=>{
      if(/\.focus\(/.test(String(callback))){window.heldFocus.push(callback);return 2147483000+window.heldFocus.length}
      return native(callback);
    };
  });
  const flushFocus=()=>page.evaluate(()=>{window.restoreFocusFrames();for(const callback of window.heldFocus.splice(0))callback(performance.now())});
  await attempt('thread opening respects newer outside focus',async()=>{
    await mount(data);await holdFocus();await page.locator('[data-demo="reply-original"]').click();
    assert.ok(await page.evaluate(()=>window.heldFocus.length)>0,'The actual focus frame was held');
    await page.getByRole('button',{name:'Outside action',exact:true}).click();await flushFocus();await frames(page);
    await capture('thread-open-outside-focus');assert.equal(await page.locator('#outside').evaluate(node=>node===document.activeElement),true);
  });
  await attempt('thread closure respects newer outside focus',async()=>{
    await mount(data);await page.locator('[data-demo="reply-original"]').click();await frames(page);await holdFocus();
    await page.getByRole('button',{name:'Close message thread',exact:true}).click();
    assert.ok(await page.evaluate(()=>window.heldFocus.length)>0,'The actual focus frame was held');
    await page.getByRole('button',{name:'Outside action',exact:true}).click();await flushFocus();await frames(page);
    await capture('thread-close-outside-focus');assert.equal(await page.locator('#outside').evaluate(node=>node===document.activeElement),true);
  });
  await attempt('sending respects newer outside focus before its frame',async()=>{
    await mount(data);await draft('alpha').fill('A focused send.');await draft('alpha').press('Control+Enter');
    await page.waitForFunction(()=>window.teamJobs.length===1);await holdFocus();
    await page.evaluate(()=>window.teamJobs[0].resolve({id:'accepted',authorId:'sam',body:'A focused send.',time:'09:20'}));
    await page.waitForFunction(()=>window.heldFocus.length>0);
    await page.getByRole('button',{name:'Outside action',exact:true}).click();await flushFocus();await frames(page);
    await capture('send-outside-focus');assert.equal(await page.locator('#outside').evaluate(node=>node===document.activeElement),true);
  });
  await attempt('normal open close and accepted-send focus',async()=>{
    await mount(data);const reply=page.locator('[data-demo="reply-original"]');await reply.focus();await reply.press('Enter');
    await page.waitForFunction(()=>document.activeElement?.getAttribute('data-demo')==='close-thread').catch(async error=>{throw Error('Opening focus: '+await page.evaluate(()=>JSON.stringify({tag:document.activeElement?.tagName,role:document.activeElement?.getAttribute('role'),demo:document.activeElement?.getAttribute('data-demo')}))+'; '+error.message)});
    await page.getByRole('button',{name:'Close message thread',exact:true}).press('Enter');
    await page.waitForFunction(()=>document.activeElement?.getAttribute('data-demo')==='reply-original').catch(async error=>{throw Error('Closing focus: '+await page.evaluate(()=>JSON.stringify({tag:document.activeElement?.tagName,role:document.activeElement?.getAttribute('role'),demo:document.activeElement?.getAttribute('data-demo')}))+'; '+error.message)});
    await draft('alpha').fill('A normal focused send.');await draft('alpha').press('Control+Enter');
    await page.waitForFunction(()=>window.teamJobs.length===1);await page.evaluate(()=>window.teamJobs[0].resolve({id:'normal',authorId:'sam',body:'A normal focused send.',time:'09:10'}));
    await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='textbox'&&document.activeElement.textContent==='').catch(async error=>{throw Error('Accepted-send focus: '+await page.evaluate(()=>JSON.stringify({tag:document.activeElement?.tagName,role:document.activeElement?.getAttribute('role'),demo:document.activeElement?.getAttribute('data-demo')}))+'; '+error.message)});
    await capture('normal-focus-restoration',{audit:true});
  });
  await attempt('thread opening respects a newer primary blank-space click',async()=>{
    await mount(data);await holdFocus();await page.locator('[data-demo="reply-original"]').click();
    assert.ok(await page.evaluate(()=>window.heldFocus.length)>0);await page.locator('#outside-space').click();
    const before=await page.evaluate(()=>{window.beforeFocus=document.activeElement;return document.activeElement?.getAttribute('data-demo')});
    await flushFocus();await frames(page);await capture('thread-open-blank-focus');
    assert.equal(await page.evaluate(()=>document.activeElement===window.beforeFocus),true,'The held handoff cannot overrule a newer primary click ('+before+')');
  });
  await attempt('thread opening respects window blur',async()=>{
    await mount(data);await holdFocus();await page.locator('[data-demo="reply-original"]').click();
    assert.ok(await page.evaluate(()=>window.heldFocus.length)>0);await page.evaluate(()=>{window.beforeFocus=document.activeElement;window.dispatchEvent(new Event('blur'))});
    await flushFocus();await frames(page);await capture('thread-open-window-blur');
    assert.equal(await page.evaluate(()=>document.activeElement===window.beforeFocus),true);
  });
  assert.deepEqual(failures,[],'Team focus ownership outcomes');
}
