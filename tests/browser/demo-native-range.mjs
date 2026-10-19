import assert from "node:assert/strict";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";

export async function checkNativeRanges(page) {
  await mountFixture(page, "media-before-after", "free", `
    import { DemoPlayer } from './lib/demo/player';
    import { parseSteps } from './lib/demo/schema.mjs';
    window.rangeChanges=[];window.refusedChanges=[];window.rangeCommits=[];
    document.addEventListener('change',event=>{if(event.target.dataset.demo==='native-range')window.rangeCommits.push(Number(event.target.value))});
    function Fields(){
      const [value,setValue]=useState(18),[custom,setCustom]=useState(18);
      return <>
        <input aria-label="Native range" data-demo="native-range" type="range" min="10" max="30" step="2" value={value} style={{width:300}} onChange={event=>{const next=Number(event.target.value);window.rangeChanges.push(next);setValue(next)}}/>
        <input aria-label="Refused range" data-demo="refused-range" type="range" value={23} onChange={event=>window.refusedChanges.push(Number(event.target.value))}/>
        <input aria-label="Disabled range" data-demo="disabled-range" type="range" disabled defaultValue={23}/>
        <input aria-label="Prevented range" data-demo="prevented-range" type="range" defaultValue={23} onPointerDown={event=>event.preventDefault()} onKeyDown={event=>event.preventDefault()}/>
        <input aria-label="Custom range" data-demo="custom-range" type="range" value={custom} onChange={event=>setCustom(Number(event.target.value))} onPointerDown={event=>{event.preventDefault();setCustom(22)}}/>
        <input aria-label="RTL range" data-demo="rtl-range" type="range" dir="rtl" min="10" max="30" step="2" defaultValue={18}/>
      </>;
    }
    createRoot(document.getElementById('root')).render(<Fields/>);
    window.play=steps=>{const controller=new AbortController();window.stopReplay=()=>controller.abort();return new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},controller.signal).play(parseSteps(steps))};
  `);
  const native = page.getByRole("slider", {name:"Native range",exact:true});
  await page.evaluate(() => window.play(["click:@native-range:0.25,0.5", "key:End", "key:Home", "key:ArrowRight", "key:ArrowUp", "key:ArrowDown", "key:ArrowLeft"]));
  const values = await page.evaluate(() => window.rangeChanges);
  assert.ok(values[0] >= 14 && values[0] <= 16, "A scripted native range click changes its value");
  assert.deepEqual(values.slice(1), [30, 10, 12, 14, 12, 10], "Range keys respect the real bounds and step");
  assert.equal(await native.inputValue(), "10");
  await page.evaluate(() => window.play(["key:ArrowLeft", "key:Home"]));
  assert.equal(await page.evaluate(() => window.rangeChanges.length), values.length, "No-op native range keys do not invent input events");
  await page.evaluate(() => window.play(["key:Backspace", "key:Delete", "type:9"]));
  assert.equal(await native.inputValue(), "10", "Text editing leaves a native range unchanged");
  assert.equal(await page.evaluate(() => window.rangeChanges.length), values.length);
  assert.deepEqual(await page.evaluate(() => window.rangeCommits), values, "Clicks and keys commit each accepted native value once");
  const box = await native.boundingBox(), viewport = page.viewportSize();
  const point = [(box.x+box.width*.9)/viewport.width,(box.y+box.height/2)/viewport.height];
  const commits = values.length;
  await page.evaluate(point => window.play(["hover:@native-range:0.25,0.5", "drag:"+point.join(",")]), point);
  assert.equal(await native.inputValue(), "28", "A held native range drag follows the pointer");
  assert.equal(await page.evaluate(() => window.rangeCommits.length), commits+1, "A drag commits only on release");
  const beforeAbort = await page.evaluate(() => window.rangeChanges.length);
  await page.evaluate(() => {window.activeReplay=window.play(["hover:@native-range:0.1,0.5","down","move:0.95,0.5","up"]).catch(()=>{});});
  await page.waitForFunction(count => window.rangeChanges.length>count, beforeAbort);
  await page.evaluate(async () => {window.stopReplay();await window.activeReplay;});
  const stopped = await native.inputValue();
  await page.evaluate(() => window.play(["move:0.9,0.9"]));
  assert.equal(await native.inputValue(), stopped, "Cancellation retires held range input before later pointer travel");

  const refused = page.getByRole("slider", {name:"Refused range",exact:true});
  await refused.focus();
  await page.evaluate(() => window.play(["key:ArrowRight"]));
  assert.deepEqual(await page.evaluate(() => window.refusedChanges), [24]);
  assert.equal(await refused.inputValue(), "23", "The player preserves controlled host refusal");
  for (const id of ["disabled", "prevented"]) {
    await page.evaluate(id => window.play(["click:@"+id+"-range:0.9,0.5"]), id);
    const range = page.locator('[data-demo="'+id+'-range"]');
    if (id === "prevented") {
      await range.focus();
      await page.evaluate(() => window.play(["key:End"]));
    }
    assert.equal(await range.inputValue(), "23", id+" defaults remain suppressed");
  }
  await page.evaluate(() => window.play(["click:@custom-range:0.9,0.5"]));
  assert.equal(await page.getByRole("slider", {name:"Custom range",exact:true}).inputValue(), "22", "A custom prevented pointer handler owns its value");
  const rtl = page.getByRole("slider", {name:"RTL range",exact:true});
  await rtl.focus();
  await page.evaluate(() => window.play(["key:ArrowRight"]));
  assert.equal(await rtl.inputValue(), "16", "Horizontal range keys follow RTL direction");
  console.log("PASS native range replay: pointer, keys, bounds, host refusal, prevented defaults and RTL");
}
