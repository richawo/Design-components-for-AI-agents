export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.setViewportSize({width:1400,height:1000});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
  await page.getByRole('tab',{name:'Your collection',exact:true}).click();
  const library=page.getByRole('tabpanel',{name:'Your collection',exact:true});
  await library.getByRole('button',{name:'Play Paper Lanterns by Mara Vale',exact:true}).click();
  await page.waitForFunction(()=>{const audio=document.querySelector('audio');return audio&&!audio.paused&&audio.currentTime>0;});
  const before=await page.locator('audio').evaluate(audio=>({time:audio.currentTime,duration:audio.duration}));
  assert.ok(before.time<before.duration-2,'Pause is checked during the track, separately from natural ending');
  const pause=library.getByRole('button',{name:'Pause Paper Lanterns by Mara Vale',exact:true});
  await pause.evaluate(button=>button.addEventListener('click',event=>{
    const audio=document.querySelector('audio');
    window.musicPauseDispatch={time:audio.currentTime,duration:audio.duration,trusted:event.isTrusted};
  },{once:true,capture:true}));
  await pause.click();
  const dispatch=await page.evaluate(()=>window.musicPauseDispatch);
  assert.equal(dispatch.trusted,true,'Pause is measured from the actual native click');
  assert.ok(dispatch.time<dispatch.duration-2,'The click precedes natural ending');
  await page.waitForFunction(()=>document.querySelector('audio')?.paused===true,{},{timeout:1500});
  assert.ok(await page.locator('audio').evaluate((audio,time)=>audio.currentTime<=time+1.5,dispatch.time),'The pause action stops the real media clock within the original dispatch deadline');
  await library.getByRole('button',{name:'Play Paper Lanterns by Mara Vale',exact:true}).waitFor();
  await capture('row-paused-real-audio',{audit:true});
}
