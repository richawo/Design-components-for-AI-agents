import assert from 'node:assert/strict';import {launchChromium} from '../../scripts/lib/browser.mjs';import {mountFixture} from '../../scripts/lib/component-fixture.mjs';
const browser=await launchChromium();const page=await browser.newPage({viewport:{width:900,height:1000},reducedMotion:'reduce'});
try{
 const sections="[{id:'general',label:'General',rows:[{id:'name',label:'Display name',kind:'text'}]}]";
 await mountFixture(page,'settings-panel','free',`window.calls=[];createRoot(document.getElementById('root')).render(<><Subject.SettingsPanel title="First panel" sections={${sections}} initialValues={{name:'First'}} onSave={value=>window.calls.push({panel:'first',value})}/><Subject.SettingsPanel title="Second panel" sections={${sections}} initialValues={{name:'Second'}} onSave={value=>window.calls.push({panel:'second',value})}/></>);`);
 const fields=page.getByRole('textbox',{name:'Display name'});await fields.nth(0).fill('First draft');await fields.nth(1).fill('Second draft');await fields.nth(1).press('Control+s');await page.waitForFunction(()=>window.calls.length===1);assert.deepEqual(await page.evaluate(()=>window.calls),[{panel:'second',value:{name:'Second draft'}}]);assert.equal(await fields.nth(0).inputValue(),'First draft');
 await mountFixture(page,'settings-panel','free',`createRoot(document.getElementById('root')).render(<Subject.SettingsPanel sections={${sections}} initialValues={{name:'Unsaved'}}/>);`);
 await page.getByRole('textbox').fill('Still unsaved');const save=page.locator('[data-demo="save"]');await save.waitFor();assert.ok(await save.isDisabled());await page.getByRole('textbox').press('Control+s');assert.ok(await page.getByText('Saving is unavailable.').isVisible());assert.equal(await page.getByRole('textbox').inputValue(),'Still unsaved');
 console.log('PASS focused settings shortcuts and unavailable host saves');
}finally{await browser.close()}
