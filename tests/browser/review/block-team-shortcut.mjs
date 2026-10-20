const data=`window.teamJobs=[];createRoot(document.getElementById('root')).render(<Subject.TeamWorkspace channels={[{id:'alpha',name:'# alpha',description:'A working room'}]} initialMessages={{alpha:[]}} onSend={(body,channelId)=>new Promise((resolve,reject)=>window.teamJobs.push({body,channelId,resolve,reject}))}/>);`;
export async function check({page,mount,assert,capture=async()=>{}}){
  await page.emulateMedia({reducedMotion:'reduce'});
  const draft=()=>page.getByRole('textbox',{name:'Message # alpha',exact:true});
  const results=[];
  for(const modifier of ['Control','Meta']){
    await mount(data);await draft().fill('Keep this exact draft.');await draft().press(modifier+'+Enter');await page.waitForFunction(()=>window.teamJobs.length===1);
    await capture('shortcut-'+modifier.toLowerCase()+'-pending',{audit:true});
    const text=await draft().textContent();results.push({name:modifier+' keeps the draft exact',pass:text==='Keep this exact draft.',text});
    assert.deepEqual(await page.evaluate(()=>window.teamJobs.map(({body,channelId})=>({body,channelId}))),[{body:'Keep this exact draft.',channelId:'alpha'}]);
  }
  await mount(data);await draft().fill('An unfinished composition.');
  await draft().dispatchEvent('keydown',{key:'Enter',code:'Enter',ctrlKey:true,isComposing:true,keyCode:229,bubbles:true,cancelable:true});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  results.push({name:'composition does not send',pass:await page.evaluate(()=>window.teamJobs.length===0)});
  await capture('composing-shortcut',{audit:true});
  assert.deepEqual(results.filter(result=>!result.pass),[],'Team send shortcut outcomes');
  await mount(data);await draft().fill('First line.');await draft().press('End');await draft().press('Enter');await page.keyboard.type('Second line.');await draft().press('Control+Enter');
  await page.waitForFunction(()=>window.teamJobs.length===1);
  assert.deepEqual(await page.evaluate(()=>window.teamJobs.map(({body,channelId})=>({body,channelId}))),[{body:'First line.\nSecond line.',channelId:'alpha'}]);
}
