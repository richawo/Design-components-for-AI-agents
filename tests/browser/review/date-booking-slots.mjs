async function copies({page,mount,assert}) {
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.BookingSlots onChange={selection=>{window.changes.push({...selection});selection.slotId='host-mutation'}}/>);`);
  await page.getByRole('radio',{name:'09:00',exact:true}).focus();await page.getByRole('radio',{name:'09:00',exact:true}).press('Space');
  assert.deepEqual(await page.evaluate(()=>window.changes),[{dayId:'2026-10-12',slotId:'0900'}]);
  assert.equal(await page.getByRole('radio',{name:'09:00',exact:true}).isChecked(),true,'Booking notifications cannot mutate the stored local selection');
  assert.equal(await page.getByRole('status').innerText(),'Mon 12, 09:00 selected');
}


async function readOnlyCase({page,mount,assert}) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.BookingSlots value={null}/>);`);
  assert.equal(await page.getByRole('radio',{name:'09:00',exact:true}).isDisabled(),true,'Controlled booking choices without a writer are read-only');
}


async function slotFocus({page,mount,assert}) {
  await mount(`function Host(){const[slots,setSlots]=React.useState([{id:'a',label:'09:00'},{id:'b',label:'10:30'}]);window.reverseSlots=()=>setSlots(slots=>[...slots].reverse());return <Subject.BookingSlots days={[{id:'mon',weekday:'Mon',day:'12',month:'October',slots}]}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const slot=page.getByRole('radio',{name:'10:30',exact:true});await slot.focus();await slot.press('Space');await page.evaluate(()=>window.reverseSlots());
  assert.equal(await slot.evaluate(node=>node===document.activeElement),true,'Reordering booking slot IDs retains radio focus');assert.equal(await slot.isChecked(),true);
}


async function dayFocus({page,mount,assert}) {
  await mount(`function Host(){const[days,setDays]=React.useState([{id:'a',weekday:'Mon',day:'12',month:'October',slots:[]},{id:'b',weekday:'Tue',day:'13',month:'October',slots:[]}]);window.reverseDays=()=>setDays(days=>[...days].reverse());return <Subject.BookingSlots days={days}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const day=page.getByRole('button',{name:/Tue/});await day.focus();await day.press('Enter');await page.evaluate(()=>window.reverseDays());
  assert.equal(await day.evaluate(node=>node===document.activeElement),true,'Reordering booking day IDs retains day focus');assert.equal(await day.getAttribute('aria-pressed'),'true');
}


async function liveMotion({page,mount,assert}) {
  await page.emulateMedia({reducedMotion:'no-preference'});await mount(`createRoot(document.getElementById('root')).render(<Subject.BookingSlots/>);`);
  await page.getByRole('button',{name:/Tue/}).click();
  await page.waitForFunction(()=>{const grid=document.querySelector('fieldset > div'),opacity=Number(getComputedStyle(grid).opacity);return opacity>0&&opacity<.95},null,{timeout:1500,polling:'raf'});
  await page.emulateMedia({reducedMotion:'reduce'});
  const frame=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const style=getComputedStyle(document.querySelector('fieldset > div'));resolve({opacity:Number(style.opacity),y:new DOMMatrixReadOnly(style.transform).m42})}))));
  assert.deepEqual(frame,{opacity:1,y:0},'Live reduced motion immediately settles the booking slot list');
}


async function unavailable({page,mount,assert}) {
 await mount(`createRoot(document.getElementById('root')).render(<Subject.BookingSlots days={[{id:'full',weekday:'Mon',day:'12',month:'October',slots:[{id:'0900',label:'09:00',available:false},{id:'1000',label:'10:00',available:false}]}]}/>);`);
 assert.equal(await page.getByRole('radio').first().isDisabled(),true);
 assert.equal(await page.getByText('No times are available for this day.',{exact:true}).count(),1,'Fully unavailable days expose the same written no-times state as empty days');
}


export async function check({page,mount,assert,capture=async()=>{}}) {
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:1800});
 await mount(`window.choices=[];createRoot(document.getElementById('root')).render(<Subject.BookingSlots onChange={choice=>window.choices.push({...choice})}/>);`);
 const first=page.getByRole('radio',{name:'09:00',exact:true});await first.focus();await first.press('Space');assert.equal(await first.isChecked(),true);
 assert.equal(await page.getByRole('status').innerText(),'Mon 12, 09:00 selected');await capture('first-time',{audit:true});
 await first.press('ArrowRight');const mid=page.getByRole('radio',{name:'10:30',exact:true});assert.equal(await mid.isChecked(),true);assert.equal(await mid.evaluate(node=>node===document.activeElement),true);
 await mid.press('ArrowRight');const last=page.getByRole('radio',{name:'15:30',exact:true});assert.equal(await last.isChecked(),true);assert.equal(await last.evaluate(node=>node===document.activeElement),true);
 assert.equal(await page.getByRole('radio',{name:/14:00/}).isDisabled(),true);await capture('keyboard-skips-unavailable',{audit:true});
 const tue=page.getByRole('button',{name:/Tue/});await tue.focus();await tue.press('Enter');assert.equal(await tue.getAttribute('aria-pressed'),'true');assert.equal(await page.getByRole('radio').count(),3);
 assert.equal(await page.getByRole('radio',{checked:true}).count(),0);assert.equal(await page.getByRole('status').innerText(),'Mon 12, 15:30 selected','Browsing another day retains the actual prior choice until a new slot is selected');
 const ten=page.getByRole('radio',{name:'10:00',exact:true});await ten.focus();await ten.press('Space');assert.equal(await ten.isChecked(),true);assert.equal(await page.getByRole('status').innerText(),'Tue 13, 10:00 selected');
 assert.deepEqual(await page.evaluate(()=>window.choices),[{dayId:'2026-10-12',slotId:'0900'},{dayId:'2026-10-12',slotId:'1030'},{dayId:'2026-10-12',slotId:'1530'},{dayId:'2026-10-13',slotId:'1000'}]);await capture('next-day-selection',{audit:true});
 await page.getByRole('button',{name:/Wed/}).click();assert.equal(await page.getByRole('radio').count(),0);assert.equal(await page.getByText('No times are available for this day.',{exact:true}).count(),1);assert.equal(await page.getByRole('status').innerText(),'Tue 13, 10:00 selected');await capture('empty-day-retains-selection',{audit:true});

 await mount(`window.proposals=[];window.accept=false;function Host(){const[value,setValue]=React.useState(null);window.clearBooking=()=>setValue(null);return <Subject.BookingSlots value={value} onChange={choice=>{window.proposals.push({...choice});if(window.accept)setValue(choice)}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const controlled=page.getByRole('radio',{name:'09:00',exact:true});await controlled.focus();await controlled.press('Space');assert.equal(await controlled.isChecked(),false);assert.equal(await page.getByRole('status').innerText(),'Choose an available time to continue.');await page.evaluate(()=>window.accept=true);await controlled.press('Space');assert.equal(await controlled.isChecked(),true);assert.equal(await page.getByRole('status').innerText(),'Mon 12, 09:00 selected');assert.deepEqual(await page.evaluate(()=>window.proposals),[{dayId:'2026-10-12',slotId:'0900'},{dayId:'2026-10-12',slotId:'0900'}]);await capture('controlled-acknowledgement',{audit:true});
 await page.evaluate(()=>window.clearBooking());
 await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.trim()==='Choose an available time to continue.');
 assert.equal(await controlled.isChecked(),false);
 assert.equal(await page.getByRole('status').innerText(),'Choose an available time to continue.');
 assert.equal(await controlled.evaluate(node=>node===document.activeElement),true,'An acknowledged controlled clear retains the focused slot');
 assert.equal(await page.evaluate(()=>window.proposals.length),2,'A host clear does not emit another booking proposal');

 await mount(`window.choices=[];function Host(){const[available,setAvailable]=React.useState(true);window.takeSlot=()=>setAvailable(false);return <Subject.BookingSlots days={[{id:'mon',weekday:'Mon',day:'12',month:'October',slots:[{id:'only',label:'09:00',available}]}]} onChange={choice=>window.choices.push({...choice})}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const only=page.getByRole('radio',{name:'09:00',exact:true});await only.locator("..").click();await page.evaluate(()=>window.takeSlot());await page.waitForFunction(()=>document.querySelector('input[type="radio"]').disabled);
 assert.equal(await page.getByRole('radio',{checked:true}).count(),0);assert.equal(await page.getByRole('status').innerText(),'No available time selected.');assert.equal(await page.getByText('No times are available for this day.',{exact:true}).count(),1);assert.deepEqual(await page.evaluate(()=>window.choices),[{dayId:'mon',slotId:'only'}]);await capture('retired-unavailable-choice',{audit:true});

 await mount(`function Host(){const[days,setDays]=React.useState([]);window.loadBooking=()=>setDays([{id:'next',weekday:'Next',day:'Planning day',month:'Sprint week',slots:[{id:'lunch',label:'After lunch'}]}]);return <Subject.BookingSlots days={days} timezone="Client local time"/>};createRoot(document.getElementById('root')).render(<Host/>);`);
 assert.equal(await page.getByText('No dates available',{exact:true}).count(),1);assert.equal(await page.getByRole('radio').count(),0);assert.equal(await page.getByRole('status').innerText(),'No available time selected.');await capture('no-dates',{audit:true});
 await page.evaluate(()=>window.loadBooking());const lunch=page.getByRole('radio',{name:'After lunch',exact:true});await lunch.waitFor();await lunch.focus();await lunch.press('Space');assert.equal(await lunch.isChecked(),true);assert.equal(await page.getByRole('status').innerText(),'Next Planning day, After lunch selected');assert.equal(await page.getByText('Client local time',{exact:true}).count(),1);

 await page.setViewportSize({width:320,height:2200});
 await mount(`const days=[{id:'long',weekday:'Monday morning',day:'12',month:'October planning',slots:[{id:'a',label:'09:30, before the research playback'},{id:'b',label:'14:30, after the design working group'}]}];createRoot(document.getElementById('root')).render(<><Subject.BookingSlots title="Find a useful time for the international research and design team" duration="Forty-five minutes with time for questions" timezone="Client local time in the workspace selected by your team" days={days}/><Subject.BookingSlots title="Independent booking choices" days={days}/></>);`);
 const sections=page.locator('section');await sections.first().getByRole('radio').first().locator('..').click();assert.equal(await sections.last().getByRole('radio',{checked:true}).count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);return ids.filter((id,index)=>ids.indexOf(id)!==index)}),[]);
 assert.equal(await page.getByRole('radio').evaluateAll(inputs=>new Set(inputs.map(input=>input.name)).size),2);await capture('long-independent-bookings',{audit:true});

 await page.setViewportSize({width:390,height:1800});for(const test of [copies,readOnlyCase,slotFocus,dayFocus,liveMotion,unavailable])await test({page,mount,assert});await page.emulateMedia({reducedMotion:'reduce'});
}
