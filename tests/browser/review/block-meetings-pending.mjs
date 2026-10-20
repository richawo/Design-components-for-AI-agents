export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});
  await mount(`window.mediaJobs=[];createRoot(document.getElementById('root')).render(<Subject.MeetingsWorkspace onJoin={async()=>{}} onLeave={()=>{}} onMicrophoneChange={(id,value,signal)=>new Promise((resolve,reject)=>window.mediaJobs.push({id,value,signal,resolve,reject}))}/>);`);
  await page.getByRole('button',{name:'Join selected room',exact:true}).click();
  await page.getByRole('button',{name:'Leave room',exact:true}).waitFor();
  const microphone=page.getByRole('button',{name:'Unmute microphone',exact:true});
  await microphone.click();await page.waitForFunction(()=>window.mediaJobs.length===1);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await capture('pending-host-microphone',{audit:true});
  assert.equal(await microphone.getAttribute('aria-busy'),'true','The microphone keeps its own pending state until the host settles');
  await page.evaluate(()=>window.mediaJobs[0].resolve());
  await page.getByRole('button',{name:'Mute microphone',exact:true}).waitFor();
}
