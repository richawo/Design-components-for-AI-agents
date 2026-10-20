export async function check(context) {
  const viewport = context.page.viewportSize();
  try { await checkHostPause(context); }
  finally { if (viewport) await context.page.setViewportSize(viewport); }
}
async function checkHostPause({page,mount,assert,capture=async()=>{}}) {
  await page.setViewportSize({width:1000,height:1100});
  await mount(`window.playbackEvents=[];window.firstAudio={id:'one',title:'First arrangement',artist:'The working group',src:Subject.createAudioPreview(0),duration:12};window.secondAudio={id:'two',title:'Second arrangement',artist:'The working group',src:Subject.createAudioPreview(2),duration:12};function Host(){const[state,setState]=React.useState({track:window.firstAudio,variant:'studio',play:0,pause:0});window.configureAudio=patch=>setState(s=>({...s,...patch}));return <><div style={{display:'flex',gap:12,marginBottom:24}}><button onClick={()=>setState(s=>({...s,play:s.play+1}))}>Play from host</button><button onClick={()=>setState(s=>({...s,pause:s.pause+1}))}>Pause from host</button><button onClick={()=>setState(s=>({...s,play:s.play+1,pause:s.pause+1}))}>Play then pause</button><button onClick={()=>setState(s=>({...s,track:window.secondAudio}))}>Change source</button></div><Subject.AudioTransport track={state.track} variant={state.variant} playRequest={state.play} pauseRequest={state.pause} defaultMuted onPlaybackChange={value=>window.playbackEvents.push(value)}/></>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const media=()=>page.locator('audio');
  for(const variant of ['studio','compact']) {
    await page.evaluate(variant=>window.configureAudio({variant,track:window.firstAudio}),variant);
    await page.getByRole('button',{name:'Play from host',exact:true}).click();
    await page.waitForFunction(()=>{const audio=document.querySelector('audio');return audio&&!audio.paused&&audio.currentTime>.05});
    await page.getByRole('button',{name:'Pause from host',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('audio')?.paused===true,{},{timeout:1500});
    const at=await media().evaluate(audio=>audio.currentTime);await page.waitForTimeout(150);assert.equal(await media().evaluate(audio=>audio.currentTime),at,'A host pause stops the actual media clock');
    await page.waitForFunction(()=>window.playbackEvents.at(-1)===false);await capture(variant+'-host-paused',{audit:true});
    await page.getByRole('button',{name:'Change source',exact:true}).click();
    await page.waitForFunction(()=>{const audio=document.querySelector('audio');return audio?.getAttribute('src')===window.secondAudio.src&&audio.readyState>=1});
    assert.equal(await media().evaluate(audio=>audio.paused),true,'A plain source change preserves the accepted pause');
    await capture(variant+'-source-paused',{audit:true});
    await page.getByRole('button',{name:'Play from host',exact:true}).click();
    await page.waitForFunction(()=>{const audio=document.querySelector('audio');return !audio.paused&&audio.currentTime>.05});
    await page.getByRole('button',{name:'Play then pause',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('audio')?.paused===true,{},{timeout:1500});
    await page.waitForFunction(()=>window.playbackEvents.at(-1)===false);assert.equal(await page.getByRole('alert').count(),0,'A retired play outcome cannot surface an error after pause');
    await capture(variant+'-pause-wins',{audit:true});
  }
}
