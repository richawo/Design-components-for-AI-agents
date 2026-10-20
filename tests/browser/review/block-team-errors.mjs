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
  await attempt('failed send remains readable',async()=>{
    await mount(data);await draft('alpha').fill('Retain this failed message.');await draft('alpha').press('Control+Enter');
    await page.waitForFunction(()=>window.teamJobs.length===1);
    await page.evaluate(()=>window.teamJobs[0].reject(new Error('The connection is unavailable. Try again.')));
    await page.getByRole('alert').waitFor();await capture('failed-send',{audit:true});
    assert.equal(await draft('alpha').textContent(),'Retain this failed message.');
  });
  assert.deepEqual(failures,[],'Team error state outcomes');
}
