// Notification return values, keyboard transport, controlled time and normalized event boundaries.
export async function check({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'reduce'});
 const events=`[{id:'ask',at:0,kind:'prompt',title:'Mara',body:'Check the invoice export.'},{id:'test',at:3000,duration:1000,kind:'tool',title:'run_tests',body:'All tests passed.',status:'ok',tests:{passed:4,failed:0},files:[{path:'src/invoice.ts',added:2,removed:1}]},{id:'reply',at:9000,duration:1000,kind:'reply',title:'Atlas',body:'The invoice export is repaired.'}]`;
 await mount(`window.replayTimes=[];window.replayEvents=[];createRoot(document.getElementById('root')).render(<Subject.AgentsRunReplay events={${events}} onTimeChange={time=>window.replayTimes.push(time)} onEventChange={event=>window.replayEvents.push(event?.id??null)}/>);`);
 const timeline=page.getByRole('slider',{name:'Replay position',exact:true});await timeline.focus();await timeline.press('End');
 await page.waitForFunction(()=>document.querySelector('[data-demo="timeline"]').getAttribute('aria-valuenow')==='10');
 assert.equal(await page.evaluate(()=>window.replayTimes.at(-1)),10000);
 assert.equal(await page.getByRole('log',{name:'Transcript at the playhead',exact:true}).getByText('The invoice export is repaired.',{exact:true}).count(),1);
 assert.equal(await page.getByRole('region',{name:'Files changed',exact:true}).getByText('src/invoice.ts',{exact:true}).count(),1);
 assert.equal(await timeline.evaluate(node=>node===document.activeElement),true);
 await timeline.press('Home');await page.waitForFunction(()=>document.querySelector('[data-demo="timeline"]').getAttribute('aria-valuenow')==='0');
 assert.equal(await page.evaluate(()=>window.replayTimes.at(-1)),0);
 await page.getByRole('button',{name:'Next event',exact:true}).focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('[data-demo="timeline"]').getAttribute('aria-valuenow')==='3');
 assert.equal(await page.evaluate(()=>window.replayTimes.at(-1)),3000);
 const speeds=page.getByRole('radiogroup',{name:'Playback speed',exact:true});await speeds.getByRole('radio',{checked:true}).focus();await page.keyboard.press('ArrowRight');
 const fastest=speeds.getByRole('radio',{name:'32×',exact:true});assert.equal(await fastest.getAttribute('aria-checked'),'true');assert.equal(await fastest.evaluate(node=>node===document.activeElement),true);await fastest.press('ArrowLeft');assert.equal(await speeds.getByRole('radio',{name:'8×',exact:true}).getAttribute('aria-checked'),'true');
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AgentsRunReplay events={${events}} time={1000}/>);`);
 const locked=page.getByRole('slider',{name:'Replay position',exact:true});const before=await locked.getAttribute('aria-valuenow');await locked.focus();await locked.press('End');assert.equal(await locked.getAttribute('aria-valuenow'),before,'A controlled replay without a writer stays read-only');
 const malformedReplay=`[{id:'late',at:4000,duration:1000,kind:'reply',title:'Atlas',body:'Latest valid reply.'},{id:'early',at:0,kind:'prompt',title:'Mara',body:'First valid prompt.'},{id:'late',at:20000,kind:'reply',title:'Duplicate must not render',body:'Duplicate must not render'},{id:'bad-time',at:NaN,kind:'tool',title:'Invalid time must not render'},{id:'negative',at:-1000,kind:'prompt',title:'Negative time must not render'}]`;
 await mount(`window.normalisedReplayEvents=[];createRoot(document.getElementById('root')).render(<Subject.AgentsRunReplay events={${malformedReplay}} onEventChange={event=>window.normalisedReplayEvents.push(event?.id??null)}/>);`);
 const filtered=page.getByRole('slider',{name:'Replay position',exact:true});
 assert.equal(await filtered.getAttribute('aria-valuemax'),'5','Only the first record with a usable nonnegative time contributes to duration');
 await filtered.focus();await filtered.press('End');
 await page.waitForFunction(()=>window.normalisedReplayEvents.at(-1)==='late');
 const transcript=page.getByRole('log',{name:'Transcript at the playhead',exact:true});
 const rendered=await transcript.innerText();
 assert.ok(rendered.indexOf('First valid prompt.')<rendered.indexOf('Latest valid reply.'));
 assert.doesNotMatch(rendered,/Duplicate must not render|Invalid time must not render|Negative time must not render/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.AgentsRunReplay events={[]}/>);`);
 assert.equal(await page.locator('[data-demo="play"]').isDisabled(),true);assert.equal(await page.locator('[data-demo="next-event"]').isDisabled(),true);
 assert.equal(await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)<=innerWidth),true);
}
