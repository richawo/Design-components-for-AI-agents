import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const browser = await launchChromium();
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 800 },
  });
  await mountFixture(
    page,
    "input-tag-editor",
    "free",
    `
    import {DemoPlayer} from './lib/demo/player';
    import {parseSteps} from './lib/demo/schema.mjs';
    function Fixture(){
      const [stage,setStage]=useState('ready');
      return <>
        <button data-demo="start" onClick={()=>{window.starts=(window.starts||0)+1;setStage('leaving');setTimeout(()=>setStage('entering'),400)}}>Open details</button>
        {stage==='leaving' && <div inert><button data-demo="finish" onClick={()=>window.wrong=true}>Outgoing control</button></div>}
        {stage==='entering' && <button data-demo="finish" ref={el=>{if(el && !el.dataset.animated){el.dataset.animated='true';el.animate([{transform:'translate(0,0)'},{transform:'translate(240px,140px)'}],{duration:1000,fill:'forwards'})}}} onClick={()=>{window.finished=true;setStage('finished')}}>Finish</button>}
        <output>{stage}</output>
      </>;
    }
    createRoot(document.getElementById('root')).render(<Fixture/>);
    window.play=(steps,abortAfter)=>{const controller=new AbortController();if(abortAfter)setTimeout(()=>controller.abort(),abortAfter);return new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},controller.signal).play(parseSteps(steps))};
  `,
  );
  await page.evaluate(() => window.play(["click:@start", "click:@finish"]));
  assert.equal(
    await page.evaluate(() => window.finished),
    true,
    "Replay follows an entering control while its bounds move",
  );
  assert.equal(
    await page.evaluate(() => !!window.wrong),
    false,
    "Outgoing inert controls are never targeted",
  );
  const starts = await page.evaluate(() => window.starts);
  await page.evaluate(() => window.play(["click:@missing"]));
  assert.equal(
    await page.evaluate(() => window.starts),
    starts,
    "Missing targets never click at the previous cursor position",
  );
  const aborted = await page.evaluate(async () => {
    try {
      await window.play(["click:@missing"], 300);
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(aborted, true, "Waiting for a target remains cancellable");
  console.log(
    "PASS replay targets entering controls, ignores inert exits, tracks moving geometry, skips missing clicks and cancels waits.",
  );
} finally {
  await browser.close();
}
