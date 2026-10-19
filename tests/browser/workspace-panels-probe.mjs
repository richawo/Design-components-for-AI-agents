import {check as checkWorkspaceShell} from './review/layout-workspace-shell.mjs';
import assert from 'node:assert/strict';import {launchChromium} from '../../scripts/lib/browser.mjs';import {mountFixture} from '../../scripts/lib/component-fixture.mjs';
const browser=await launchChromium();const page=await browser.newPage({viewport:{width:900,height:1000},reducedMotion:'no-preference'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await mountFixture(page,'layout-workspace-shell','pro',`function Host(){const [active,setActive]=useState('one');return <><button onClick={()=>setActive('one')}>One</button><button onClick={()=>setActive('two')}>Two</button><Subject.WorkspacePanels activeId={active} panels={[{id:'one',content:<div style={{height:120}}><input aria-label="Draft" defaultValue=""/></div>},{id:'two',content:<div style={{height:440}}><button>Second action</button></div>}]}/></>};createRoot(document.getElementById('root')).render(<Host/>);`);
 await page.getByRole('textbox',{name:'Draft'}).fill('Keep this draft');
 const view=page.locator('[data-workspace-panel="one"]');const parent=view.locator('..');const first=(await parent.boundingBox()).height;
 await page.getByRole('button',{name:'Two',exact:true}).click();assert.equal(await view.getAttribute('inert'),'');assert.equal(await view.getAttribute('aria-hidden'),'true');assert.equal(await page.getByRole('textbox',{name:'Draft'}).count(),0);
 await page.waitForFunction(()=>document.querySelector('[data-workspace-panel="two"]').parentElement.getBoundingClientRect().height>430);assert.ok((await parent.boundingBox()).height>first+250);
 await page.getByRole('button',{name:'One',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Draft'}).inputValue(),'Keep this draft');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Two',exact:true}).click();await page.waitForTimeout(150);assert.equal(await page.locator('[data-workspace-panel="two"]').evaluate(el=>getComputedStyle(el).transform),'none');assert.deepEqual(errors,[]);
 await checkWorkspaceShell({page,assert,mount:code=>mountFixture(page,'layout-workspace-shell','free',code)});
 console.log('PASS retained drafts, inert exits, measured height, live reduced motion and workspace focus ownership');
}finally{await browser.close()}
