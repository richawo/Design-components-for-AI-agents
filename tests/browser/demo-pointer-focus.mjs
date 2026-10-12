import assert from "node:assert/strict";
import {launchChromium} from "../../scripts/lib/browser.mjs";
import {mountFixture} from "../../scripts/lib/component-fixture.mjs";

const browser=await launchChromium();
try{
 const page=await browser.newPage({viewport:{width:1000,height:800}});
 await mountFixture(page,'select-listbox','free',`
  import {DemoPlayer} from './lib/demo/player';import {parseSteps} from './lib/demo/schema.mjs';
  const focus=HTMLElement.prototype.focus;
  // Reproduce engines that read the option but leave pointer focus on body.
  HTMLElement.prototype.focus=function(options){if(options?.focusVisible===false)return;return focus.call(this,options);};
  function Fixture(){const [value,setValue]=useState('oct');window.selected=value;return <Subject.SelectListbox label="Reporting period" options={[{value:'oct',label:'October'},{value:'sep',label:'September'}]} value={value} onValueChange={setValue} searchable={false}/>;}
  const root=createRoot(document.getElementById('root'));window.reset=()=>root.render(<Fixture key={Math.random()}/>);window.reset();
  window.play=async(broken=false)=>{const player=new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},new AbortController().signal);if(broken)player.applyPendingFocus=()=>{};await player.play(parseSteps(['click:@trigger','key:ArrowDown','key:Enter']));};
 `);
 await page.evaluate(()=>window.play(true));
 assert.equal(await page.evaluate(()=>window.selected),'oct','The negative control loses its keyboard target');
 await page.evaluate(()=>window.reset());await page.waitForTimeout(200);
 await page.evaluate(()=>window.play(false));
 assert.equal(await page.evaluate(()=>window.selected),'sep','Keyboard continuation restores the pressed control');
 console.log('Pointer-focus fallback passes; the missing-focus negative control fails selection as expected.');
}finally{await browser.close();}
