// Booking identity, exact retries, keyboard ranges and controlled replacement.
export async function check({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'reduce'});
 const rangeProps=`today="2026-10-14" initialMonth="2026-10" minDate="2026-10-14" maxDate="2026-10-31" presets={[]}`;
 await mount(`window.rangeChanges=[];window.rangeJobs=[];createRoot(document.getElementById('root')).render(<Subject.DateRangeCalendar ${rangeProps} onValueChange={range=>window.rangeChanges.push({...range})} onApply={range=>new Promise((resolve,reject)=>window.rangeJobs.push({range:{...range},resolve,reject}))}/>);`);
 const day=iso=>page.locator('[data-demo="day-'+iso+'"]');
 const apply=page.locator('[data-demo="apply"]');
 await day('2026-10-16').focus();await day('2026-10-16').press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.activeElement?.dataset.demo==='day-2026-10-18');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.rangeChanges.length===1);
 assert.deepEqual(await page.evaluate(()=>window.rangeChanges),[{start:'2026-10-16',end:'2026-10-18'}]);
 await apply.focus();await apply.press('Enter');await page.waitForFunction(()=>window.rangeJobs.length===1);assert.equal(await apply.getAttribute('aria-busy'),'true');
 await page.evaluate(()=>window.rangeJobs[0].reject(Error('Booking service unavailable')));await page.waitForFunction(()=>document.querySelector('[data-demo="apply"]').textContent.includes('Try again'));
 assert.deepEqual(await page.evaluate(()=>window.rangeChanges.at(-1)),{start:'2026-10-16',end:'2026-10-18'});
 await apply.focus();await apply.press('Space');await page.waitForFunction(()=>window.rangeJobs.length===2);assert.deepEqual(await page.evaluate(()=>window.rangeJobs.map(job=>job.range)),[{start:'2026-10-16',end:'2026-10-18'},{start:'2026-10-16',end:'2026-10-18'}]);
 await page.evaluate(()=>window.rangeJobs[1].resolve());await page.waitForFunction(()=>document.querySelector('[data-demo="apply"]').textContent.includes('Held'));
 await page.locator('[data-demo="clear"]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.rangeChanges.at(-1)?.start===null);assert.equal(await apply.isDisabled(),true);
 await day('2026-10-20').click();await day('2026-10-22').click();await apply.click();await page.waitForFunction(()=>window.rangeJobs.length===3);
 await day('2026-10-23').click();await day('2026-10-25').click();await apply.click();await page.waitForFunction(()=>window.rangeJobs.length===4);
 await page.evaluate(()=>window.rangeJobs[2].resolve());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await apply.getAttribute('aria-busy'),'true','An older accepted range cannot mark a newer in-flight booking as held');
 await page.waitForFunction(()=>!document.querySelector('[data-demo="apply"]').textContent.includes('Held'));
 assert.equal(await apply.textContent().then(text=>text.includes('Held')),false);
 await page.evaluate(()=>window.rangeJobs[3].resolve());await page.waitForFunction(()=>document.querySelector('[data-demo="apply"]').textContent.includes('Held'));
 assert.deepEqual(await page.evaluate(()=>window.rangeJobs[3].range),{start:'2026-10-23',end:'2026-10-25'});
 await day('2026-10-26').click();await day('2026-10-28').click();await apply.click();await page.waitForFunction(()=>window.rangeJobs.length===5);
 await day('2026-10-29').click();await day('2026-10-31').click();await apply.click();await page.waitForFunction(()=>window.rangeJobs.length===6);
 await page.evaluate(()=>window.rangeJobs[4].reject(Error('Retired booking failed')));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await apply.getAttribute('aria-busy'),'true','A retired rejection cannot clear the current booking');
 await page.evaluate(()=>window.rangeJobs[5].reject(Error('Current booking failed')));await page.waitForFunction(()=>document.querySelector('[data-demo="apply"]').textContent.includes('Try again'));
 await apply.press('Enter');await page.waitForFunction(()=>window.rangeJobs.length===7);assert.deepEqual(await page.evaluate(()=>window.rangeJobs.slice(5).map(job=>job.range)),[{start:'2026-10-29',end:'2026-10-31'},{start:'2026-10-29',end:'2026-10-31'}]);
 await page.evaluate(()=>window.rangeJobs[6].resolve());await page.waitForFunction(()=>document.querySelector('[data-demo="apply"]').textContent.includes('Held'));
 await day('2026-10-20').click();await day('2026-10-22').click();await apply.click();await page.waitForFunction(()=>window.rangeJobs.length===8);
 await page.locator('[data-demo="clear"]').click();await page.evaluate(()=>window.rangeJobs[7].reject(Error('Cleared booking failed')));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await apply.isDisabled(),true);await page.waitForFunction(()=>!/(Held|Try again)/.test(document.querySelector('[data-demo="apply"]').textContent));assert.doesNotMatch(await apply.innerText(),/Held|Try again/);

 await mount(`window.rangeJobs=[];function Host(){const[range,setRange]=React.useState({start:'2026-10-16',end:'2026-10-18'});window.replaceRange=setRange;return <Subject.DateRangeCalendar ${rangeProps} value={range} onValueChange={setRange} onApply={range=>new Promise((resolve,reject)=>window.rangeJobs.push({range:{...range},resolve,reject}))}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 await apply.click();await page.waitForFunction(()=>window.rangeJobs.length===1);await page.evaluate(()=>window.replaceRange({start:'2026-10-23',end:'2026-10-25'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.evaluate(()=>window.rangeJobs[0].resolve());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await apply.textContent().then(text=>text.includes('Held')),false,'A host replacement retires the earlier booking result');
 await apply.click();await page.waitForFunction(()=>window.rangeJobs.length===2);
 await page.evaluate(()=>window.replaceRange({start:'2026-10-23',end:'2026-10-25'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await apply.getAttribute('aria-busy'),'true','Equivalent controlled objects retain their current request');
 await page.evaluate(()=>window.replaceRange({start:'2026-10-16',end:'2026-10-18'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.evaluate(()=>window.rangeJobs[1].reject(Error('Replaced booking failed')));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.waitForFunction(()=>!/(Held|Try again)/.test(document.querySelector('[data-demo="apply"]').textContent));assert.doesNotMatch(await apply.innerText(),/Held|Try again/);await apply.click();await page.waitForFunction(()=>window.rangeJobs.length===3);await page.evaluate(()=>window.rangeJobs[2].resolve());await page.waitForFunction(()=>document.querySelector('[data-demo="apply"]').textContent.includes('Held'));

 await mount(`createRoot(document.getElementById('root')).render(<Subject.DateRangeCalendar ${rangeProps} unavailableDates={['2026-10-16','2026-10-17','2026-10-18']} onApply={()=>{throw Error('Unavailable nights must not submit')}}/>);`);
 assert.equal(await day('2026-10-16').isDisabled(),true);assert.equal(await apply.isDisabled(),true);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.DateRangeCalendar ${rangeProps} disabled defaultValue={{start:'2026-10-16',end:'2026-10-18'}} onApply={()=>{throw Error('Disabled calendar must not submit')}}/>);`);
 assert.equal(await apply.isDisabled(),true);assert.equal(await page.locator('[data-demo="clear"]').isDisabled(),true);
}
