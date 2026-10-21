// Numeric progress, completed native keyboard scrolls, return-to-top and malformed input.
export async function check({page,mount,assert}) {
  const originalViewport = page.viewportSize();
 await page.emulateMedia({reducedMotion:'reduce'});
 await mount(`function Host(){const[progress,setProgress]=React.useState(0);window.setOutlineProgress=setProgress;return <Subject.TextOutlineFill text={'Keep every\\nword.'} as="h1" progress={progress} fontSize={120}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 assert.equal(await page.getByRole('heading',{level:1,name:'Keep every word.',exact:true}).count(),1);
 assert.equal(await page.locator('.tof-root').getAttribute('data-progress'),'0');
 for(const [value,expected] of [[.5,50],[2,100],[-1,0]]){await page.evaluate(value=>window.setOutlineProgress(value),value);await page.waitForFunction(expected=>document.querySelector('.tof-root')?.getAttribute('data-progress')===String(expected),expected)}
 await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
 const passage=page.locator('[data-demo="outline-passage"]'),reset=page.locator('[data-demo="outline-reset"]');
 await passage.evaluate(node=>{window.outlinePageFinished=false;node.addEventListener('scrollend',()=>{window.outlinePageFinished=true},{once:true});});
 assert.equal(await reset.isDisabled(),true);await passage.focus();await passage.press('PageDown');
 await page.waitForFunction(()=>document.querySelector('[data-demo="outline-passage"]').scrollTop>0);
 await page.waitForFunction(()=>Number(document.querySelector('.tof-root').getAttribute('data-progress'))>0);
 // PageDown is a native scrolling gesture; finish it before starting a separate return action.
 await page.waitForFunction(()=>window.outlinePageFinished);
 assert.equal(await reset.isDisabled(),false);await reset.focus();await reset.press('Enter');
 await page.waitForFunction(()=>document.querySelector('[data-demo="outline-passage"]').scrollTop===0);
 // Native scroll position changes before the scheduled reading-state update commits.
 await page.waitForFunction(()=>document.querySelector('[data-demo="outline-reset"]').disabled);
 assert.equal(await reset.isDisabled(),true);
 await page.setViewportSize({width:320,height:1000});
 await mount(`createRoot(document.getElementById('root')).render(<Subject.TextOutlineFill text="" as="p" fontSize={Number.POSITIVE_INFINITY} progress={Number.NaN}/>);`);
 assert.equal(await page.locator('.tof-word').count(),0);
 assert.equal(await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)<=innerWidth+1),true);
 assert.doesNotMatch(await page.locator('.tof-root').getAttribute('style'),/NaN|Infinity/);
  if (originalViewport) await page.setViewportSize(originalViewport);
}
