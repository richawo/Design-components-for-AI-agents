import fs from "node:fs";
import path from "node:path";

// Offline rendering, not a real-time performance measurement. Install before
// navigation so the component's own timers and animation frames share the clock.
export async function installFrameClock(page) {
  await page.clock.install({time:new Date()});
}

export async function startFrameSteppedRecording(page,{directory,quality=92,fps=60,clip}) {
  // Leave an IPC margin before pausing. A busy host can deliver the command
  // after a 50 ms deadline even though the source itself is animating normally.
  let epoch;
  for(let attempt=0;attempt<3;attempt++){
    epoch=await page.evaluate(()=>Date.now()+1000);
    try{await page.clock.pauseAt(new Date(epoch));break;}
    catch(error){if(attempt===2||!String(error).includes("fast-forward to the past"))throw error;}
  }
  epoch=await page.evaluate(()=>Date.now());
  const session=await page.context().newCDPSession(page);
  const frameMs=1000/fps,frames=[],wallCaptures=[];
  let frame=0,elapsed=0;
  await page.evaluate(()=>{
    const state={records:new Map(),last:0,adopt:null};
    state.adopt=(animation,at,base)=>{
      const pause=animation.pause.bind(animation),play=animation.play.bind(animation),reverse=animation.reverse.bind(animation);
      const record={base,at,rate:animation.playbackRate,intentPaused:!(animation instanceof CSSAnimation)&&animation.playState==="paused",pause};
      animation.pause=()=>{record.intentPaused=true;record.base=Number(animation.currentTime)||0;record.at=state.last;pause();};
      animation.play=()=>{play();record.intentPaused=false;record.base=Number(animation.currentTime)||0;record.at=state.last;pause();};
      animation.reverse=()=>{reverse();record.intentPaused=false;record.base=Number(animation.currentTime)||0;record.at=state.last;record.rate=animation.playbackRate;pause();};
      state.records.set(animation,record);pause();animation.currentTime=base;
      return record;
    };
    for(const animation of document.getAnimations()) {
      if(animation.playState==="idle"||animation.playState==="finished")continue;
      state.adopt(animation,0,Number(animation.currentTime)||0);
    }
    window.__dfaOfflineFrames=state;
  });
  const capture=async()=>{
    const sourceMs=await page.evaluate(time=>{
      const state=window.__dfaOfflineFrames;
      for(const animation of document.getAnimations()) {
        if(animation.playState==="idle"||animation.playState==="finished")continue;
        let record=state.records.get(animation);
        if(!record) {
          // New effects start during the last component tick or input event.
          // Advance that same interval rather than letting wall time leak in.
          const end=animation.effect?.getComputedTiming().endTime;
          record=state.adopt(animation,state.last,animation.playbackRate<0&&Number.isFinite(end)?end:0);
        }
        let cssPaused=false;
        if(animation instanceof CSSAnimation&&animation.effect?.target instanceof Element){
          const style=getComputedStyle(animation.effect.target),names=style.animationName.split(",").map(s=>s.trim()),states=style.animationPlayState.split(",").map(s=>s.trim());
          cssPaused=states[Math.max(0,names.indexOf(animation.animationName))%states.length]==="paused";
        }
        if(record.intentPaused||cssPaused){record.at+=time-state.last;continue;}
        if(record.rate!==animation.playbackRate){record.base=Number(animation.currentTime)||0;record.at=state.last;record.rate=animation.playbackRate;}
        const next=record.base+(time-record.at)*record.rate;
        const end=animation.effect?.getComputedTiming().endTime;
        animation.currentTime=next;
        if(Number.isFinite(end)&&(record.rate>0&&next>=end||record.rate<0&&next<=0))animation.finish();
      }
      state.last=time;
      return Date.now();
    },elapsed);
    if(Math.abs(sourceMs-epoch-elapsed)>2)throw new Error(`Offline source clock drifted at frame ${frame}: ${sourceMs-epoch} ms observed, ${elapsed} ms requested`);
    const began=Date.now();
    const {data}=await session.send("Page.captureScreenshot",{format:"jpeg",quality,fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:true,...(clip?{clip:{...clip,scale:1}}:{})});
    const file=path.join(directory,`stepped-${String(frame).padStart(5,"0")}.jpg`);
    await fs.promises.writeFile(file,Buffer.from(data,"base64"));
    frames.push({file,t:(epoch+elapsed)/1000});
    wallCaptures.push({frame,logicalMs:elapsed,sourceMs:sourceMs-epoch,captureMs:Date.now()-began});
  };
  await capture();
  return {
    frames,startTime:epoch/1000,
    now:()=> (epoch+elapsed)/1000,
    async advance(ms,beforeFrame) {
      const count=Math.max(0,Math.ceil(ms/frameMs-1e-7));
      for(let i=1;i<=count;i++) {
        if(beforeFrame)await beforeFrame(i/count);
        const next=++frame*frameMs;
        await page.clock.runFor(Math.round(next)-Math.round(elapsed));elapsed=next;
        await capture();
      }
    },
    async stop(){await session.detach();return{clock:"frame-stepped",fps,frameMs,frames:frames.length,logicalDurationMs:elapsed,wallCaptures};},
  };
}
