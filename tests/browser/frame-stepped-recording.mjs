// Offline capture must preserve real input, JS time, CSS time and completion.
// This is deliberately separate from the real-time navigation performance replay.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import sharp from "sharp";
import {launchChromium} from "../../scripts/lib/browser.mjs";
import {installFrameClock,startFrameSteppedRecording} from "../../scripts/lib/frame-stepped-recording.mjs";

const out=process.env.TEST_OUT||"test-results/frame-stepped-recording";
fs.mkdirSync(out,{recursive:true});
const browser=await launchChromium({args:[]});
try{
  const reports=[];
  for(const fps of [30,60]){
  const directory=out+"/"+fps;fs.mkdirSync(directory,{recursive:true});
  const page=await browser.newPage({viewport:{width:480,height:320}});
  await installFrameClock(page);
  await page.setContent(`<!doctype html><style>
    @keyframes travel{from{transform:translateX(0)}to{transform:translateX(240px)}}
    body{margin:0;background:white}#css{width:32px;height:32px;background:black;animation:travel 2s linear infinite}
    .held #css{animation-play-state:paused}#js{position:absolute;top:44px;width:32px;height:32px;background:#777}
    button{position:absolute;left:10px;top:100px}input{position:absolute;left:10px;top:140px}
    #receipt{position:absolute;left:10px;top:180px}
    </style><div id="css"></div><div id="js"></div><button>Run</button><input><p id="receipt"></p>
    <script>
    const start=performance.now();let ticks=0;
    const tick=()=>{document.querySelector('#js').style.left=(performance.now()-start)*.12+'px';requestAnimationFrame(tick)};tick();
    setInterval(()=>{ticks++;document.body.dataset.ticks=ticks},100);
    document.querySelector('button').onclick=()=>{
      const effect=document.querySelector('button').animate([{opacity:.3},{opacity:1}],{duration:200});
      effect.finished.then(()=>document.querySelector('#receipt').textContent='Complete');
    };
    </script>`);
  const capture=await startFrameSteppedRecording(page,{directory,fps,clip:{x:0,y:0,width:320,height:240}});
  const position=()=>page.evaluate(()=>({css:new DOMMatrix(getComputedStyle(document.querySelector('#css')).transform).m41,js:parseFloat(document.querySelector('#js').style.left),ticks:Number(document.body.dataset.ticks||0)}));
  const before=await position();
  await page.mouse.click(30,110);
  await page.mouse.click(30,150);await page.keyboard.type('Drawn, still functional.');
  await capture.advance(400);
  const moving=await position();
  assert(Math.abs(moving.css-before.css-48)<2,'CSS animation must advance with the source clock');
  assert(Math.abs(moving.js-before.js-48)<3,'requestAnimationFrame must advance with the source clock');
  assert(moving.ticks-before.ticks>=4,'component timers must fire');
  assert.equal(await page.locator('#receipt').textContent(),'Complete','WAAPI completion must reach the real callback');
  assert.equal(await page.locator('input').inputValue(),'Drawn, still functional.');
  await page.evaluate(()=>document.body.classList.add('held'));await capture.advance(200);
  const paused=await position();assert(Math.abs(paused.css-moving.css)<1,'CSS pause must remain paused');
  await page.evaluate(()=>document.body.classList.remove('held'));await capture.advance(200);
  const resumed=await position();assert(resumed.css-paused.css>20,'CSS animation must resume from its paused position');
  const evidence=await capture.stop();
  const hashes=capture.frames.map(frame=>crypto.createHash('sha256').update(fs.readFileSync(frame.file)).digest('hex'));
  assert(new Set(hashes).size>fps*.65,'the exported frames must contain actual source movement');
  const dimensions=await sharp(capture.frames[0].file).metadata();assert.equal(dimensions.width,320);assert.equal(dimensions.height,240);
  await page.evaluate(()=>document.body.appendChild(document.createElement("video")));
  await assert.rejects(()=>startFrameSteppedRecording(page,{directory,fps}),/Native audio\/video clocks require real-time capture/);
  reports.push({fps,before,moving,paused,resumed,distinctFrames:new Set(hashes).size,nativeMediaClockProtected:true,evidence});await page.close();
  }
  fs.writeFileSync(out+'/report.json',JSON.stringify({cadences:reports},null,2));
  console.log('Frame stepping preserves source motion, timers, input, pause/resume and completion.');
}finally{await browser.close();}
