const data = `
window.teamChannels=[{id:'alpha',name:'# alpha',description:'The alpha working room'},{id:'beta',name:'# beta',description:'The beta working room'}];
window.teamInitial={alpha:[{id:'original',authorId:'mara',body:'The original release note.',time:'09:00',reactions:[{id:'like',count:1}],replyCount:1}],beta:[]};
window.teamJobs=[];
function Host(){const[channels,setChannels]=React.useState(window.teamChannels);window.replaceTeamChannels=setChannels;return <><Subject.TeamWorkspace channels={channels} initialMessages={window.teamInitial} onSend={(body,channelId)=>new Promise((resolve,reject)=>window.teamJobs.push({body,channelId,resolve,reject}))}/><button type="button" id="outside">Outside action</button></>};createRoot(document.getElementById('root')).render(<Host/>);`;
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.emulateMedia({reducedMotion:'reduce'});
  const failures=[];
  const attempt=async(name,run)=>{try{await run();console.log('PASS '+name)}catch(error){failures.push({name,message:String(error.message)});console.log('FAIL '+name+': '+error.message)}};
  const draft=id=>page.getByRole('textbox',{name:'Message # '+id,exact:true});
  await attempt('removed channel cannot reclaim fallback selection',async()=>{
    await mount(data);
    await page.evaluate(()=>window.replaceTeamChannels([window.teamChannels[1]]));
    await page.getByRole('tab',{name:'# beta',exact:true}).waitFor();await frames(page);
    assert.equal(await page.getByRole('tab',{name:'# beta',exact:true}).getAttribute('aria-selected'),'true');
    await page.evaluate(()=>window.replaceTeamChannels(window.teamChannels));await frames(page);
    await capture('returning-channel-selection');
    assert.equal(await page.getByRole('tab',{name:'# beta',exact:true}).getAttribute('aria-selected'),'true');
  });
  await attempt('removing open thread returns to an available room',async()=>{
    await mount(data);await page.locator('[data-demo="reply-original"]').click();
    await page.getByRole('button',{name:'Close message thread',exact:true}).waitFor();
    await page.evaluate(()=>window.replaceTeamChannels([window.teamChannels[1]]));await frames(page);
    await capture('removed-thread-room');
    assert.equal(await page.getByRole('button',{name:'Close message thread',exact:true}).count(),0);
    assert.equal(await draft('beta').isVisible(),true);
  });
  await attempt('removed channel retires its send lock',async()=>{
    await mount(data);await draft('alpha').fill('A new generation.');await draft('alpha').press('Control+Enter');
    await page.waitForFunction(()=>window.teamJobs.length===1);
    await page.evaluate(()=>window.replaceTeamChannels([window.teamChannels[1]]));await frames(page);
    await page.evaluate(()=>window.replaceTeamChannels(window.teamChannels));await page.getByRole('tab',{name:'# alpha',exact:true}).click();
    await capture('returning-channel-send');
    assert.equal(await page.locator('[data-demo="send-alpha"]').isEnabled(),true);
    await draft('alpha').press('Control+Enter');assert.equal(await page.evaluate(()=>window.teamJobs.length),2);
    await page.evaluate(()=>window.teamJobs[0].resolve({id:'retired',authorId:'sam',body:'Retired completion.',time:'09:10'}));await frames(page);
    assert.equal(await page.getByText('Retired completion.',{exact:true}).count(),0);
    assert.equal(await draft('alpha').textContent(),'A new generation.');
    assert.equal(await page.locator('[data-demo="send-alpha"]').isEnabled(),false);
    await page.evaluate(()=>window.teamJobs[1].resolve({id:'current',authorId:'sam',body:'A new generation.',time:'09:11'}));
    await page.waitForFunction(()=>document.querySelector('[data-composer="alpha"] [role="textbox"]')?.textContent==='');
    assert.equal(await page.getByText('A new generation.',{exact:true}).isVisible(),true);
  });
  await attempt('retired completion cannot publish after channel returns',async()=>{
    await mount(data);await draft('alpha').fill('Original operation.');await draft('alpha').press('Control+Enter');
    await page.waitForFunction(()=>window.teamJobs.length===1);
    await page.evaluate(()=>window.replaceTeamChannels([window.teamChannels[1]]));await frames(page);
    await page.evaluate(()=>window.replaceTeamChannels(window.teamChannels));await page.getByRole('tab',{name:'# alpha',exact:true}).click();
    await draft('alpha').fill('New local draft.');
    await page.evaluate(()=>window.teamJobs[0].resolve({id:'retired',authorId:'sam',body:'Retired completion.',time:'09:10'}));await frames(page);
    await capture('retired-completion');assert.equal(await page.getByText('Retired completion.',{exact:true}).count(),0);
    assert.equal(await draft('alpha').textContent(),'New local draft.');
  });
  assert.deepEqual(failures,[],'Team channel state outcomes');
}
