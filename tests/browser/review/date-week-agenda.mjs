async function copies({page,mount,assert}){
 await mount(`window.days=[{id:'mon',label:'Mon',date:'12 October',events:[{id:'review',start:'09:00',end:'10:00',title:'Research review',location:'Studio',notes:'One useful observation.'}]}];window.chosen=[];createRoot(document.getElementById('root')).render(<Subject.WeekAgenda days={window.days} onEventSelect={event=>{window.chosen.push({...event});event.title='Host mutation';event.notes='Mutated notes'}}/>);`);
 const event=page.getByRole('button',{name:'Research review',exact:false});await event.focus();await event.press('Enter');
 assert.deepEqual(await page.evaluate(()=>window.days[0].events),[{id:'review',start:'09:00',end:'10:00',title:'Research review',location:'Studio',notes:'One useful observation.'}],'Event notifications cannot mutate the original agenda');
 assert.equal(await event.getAttribute('aria-expanded'),'true');
}


async function eventFocus({page,mount,assert}) {
  await mount(`function Host(){const[events,setEvents]=React.useState([{id:'a',start:'09:00',end:'10:00',title:'Alpha review',location:'Studio',notes:'Alpha notes.'},{id:'b',start:'11:00',end:'12:00',title:'Beta review',location:'Library',notes:'Beta notes.'}]);window.reverseEvents=()=>setEvents(events=>[...events].reverse());return <Subject.WeekAgenda days={[{id:'mon',label:'Mon',date:'12 October',events}]}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const event=page.getByRole('button',{name:/Beta review/});await event.focus();await event.press('Enter');await page.evaluate(()=>window.reverseEvents());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await event.evaluate(node=>node===document.activeElement),true,'Reordering agenda event IDs retains the focused event');
  assert.equal(await event.getAttribute('aria-expanded'),'true');
}


async function dayFocus({page,mount,assert}) {
  await mount(`function Host(){const[days,setDays]=React.useState([{id:'mon',label:'Mon',date:'12 October',events:[]},{id:'tue',label:'Tue',date:'13 October',events:[]}]);window.reverseDays=()=>setDays(days=>[...days].reverse());return <Subject.WeekAgenda days={days}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const day=page.getByRole('button',{name:'Tue',exact:true});await day.focus();await day.press('Space');await page.evaluate(()=>window.reverseDays());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await day.evaluate(node=>node===document.activeElement),true,'Reordering agenda day IDs retains the focused day');
  assert.equal(await day.getAttribute('aria-pressed'),'true');
}


async function liveMotion({page,mount,assert}) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.WeekAgenda/>);`);
  await page.getByRole('button',{name:'Tue',exact:true}).click();
  await page.waitForFunction(()=>{const list=document.querySelector('ol'),opacity=Number(getComputedStyle(list).opacity);return opacity>0&&opacity<.95},null,{timeout:1500,polling:'raf'});
  await page.emulateMedia({reducedMotion:'reduce'});
  const frame=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const style=getComputedStyle(document.querySelector('ol'));resolve({opacity:Number(style.opacity),y:new DOMMatrixReadOnly(style.transform).m42})}))));
  assert.deepEqual(frame,{opacity:1,y:0},'Live reduced motion immediately settles the agenda list');
}


export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:1700});
  await mount(`window.selected=[];createRoot(document.getElementById('root')).render(<Subject.WeekAgenda onEventSelect={event=>window.selected.push({...event})}/>);`);
  assert.equal(await page.getByRole('button',{name:'Mon',exact:true}).getAttribute('aria-pressed'),'true');
  const critique=page.getByRole('button',{name:/Design critique/});
  await critique.focus();await critique.press('Enter');
  const notesId=await critique.getAttribute('aria-controls'),notes=page.locator('[id='+JSON.stringify(notesId)+']');
  assert.equal(await critique.getAttribute('aria-expanded'),'true');assert.equal(await notes.isVisible(),true);
  assert.equal(await critique.evaluate(node=>node===document.activeElement),true);
  assert.equal(await page.getByText('Bring the three navigation directions and the mobile prototype.',{exact:true}).isVisible(),true);
  await capture('expanded-critique',{audit:true});
  await critique.press('Space');assert.equal(await critique.getAttribute('aria-expanded'),'false');assert.equal(await notes.isVisible(),false);
  const focus=page.getByRole('button',{name:/Protected focus/});await focus.focus();await focus.press('Enter');
  assert.equal(await focus.getAttribute('aria-expanded'),'true');assert.equal(await critique.getAttribute('aria-expanded'),'false');
  await capture('protected-focus',{audit:true});
  const tue=page.getByRole('button',{name:'Tue',exact:true});await tue.focus();await tue.press('Enter');
  assert.equal(await tue.getAttribute('aria-pressed'),'true');assert.equal(await tue.evaluate(node=>node===document.activeElement),true);
  assert.equal(await critique.count(),0);assert.equal(await page.getByText('13 October',{exact:true}).count(),1);
  const research=page.getByRole('button',{name:/Research playback/});await research.focus();await research.press('Space');
  assert.equal(await research.getAttribute('aria-expanded'),'true');
  assert.equal(await page.getByText('Five interviews, three patterns and one decision to make.',{exact:true}).isVisible(),true);
  assert.deepEqual(await page.evaluate(()=>window.selected.map(event=>event.id)),['crit','crit','work','research']);
  assert.deepEqual(await page.evaluate(()=>window.selected[3]),{id:'research',start:'10:00',end:'11:00',title:'Research playback',location:'Library room',notes:'Five interviews, three patterns and one decision to make.'});
  await capture('research-notes',{audit:true});
  const wed=page.getByRole('button',{name:'Wed',exact:true});await wed.focus();await wed.press('Enter');
  assert.equal(await page.getByText('A little breathing room.',{exact:true}).count(),1);assert.equal(await research.count(),0);
  assert.equal(await page.locator('button[aria-expanded]').count(),0);await capture('empty-day',{audit:true});
  await page.getByRole('button',{name:'Mon',exact:true}).click();
  assert.deepEqual(await page.locator('button[aria-expanded]').evaluateAll(buttons=>buttons.map(button=>button.getAttribute('aria-expanded'))),['false','false','false']);

  await mount(`function Host(){const[days,setDays]=React.useState([]);window.loadDays=()=>setDays([{id:'next',label:'Next',date:'Tomorrow morning',events:[{id:'planning',start:'10:30 am',end:'after lunch',title:'Planning session',location:'East room',notes:'Bring the next draft.'}]}]);return <Subject.WeekAgenda days={days} defaultDay="next" timezone="Client local time"/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  assert.equal(await page.getByText('No dates scheduled',{exact:true}).count(),1);assert.equal(await page.getByRole('button').count(),0);await capture('no-days',{audit:true});
  await page.evaluate(()=>window.loadDays());await page.getByRole('button',{name:'Next',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Next',exact:true}).getAttribute('aria-pressed'),'true');
  const planning=page.getByRole('button',{name:/Planning session/});await planning.click();
  assert.equal(await page.getByText('Tomorrow morning',{exact:true}).count(),1);
  assert.equal(await page.getByText('10:30 am–after lunch',{exact:true}).count(),1,'Date and time strings remain host display labels');
  assert.equal(await page.getByText('Client local time',{exact:true}).count(),1);await capture('arriving-local-labels',{audit:true});

  await mount(`function Host(){const[days,setDays]=React.useState([{id:'a',label:'First',date:'Earlier day',events:[{id:'earlier',start:'09:00',end:'10:00',title:'Earlier session',location:'Room A',notes:'Retired meeting notes.'}]}]);window.replaceDays=()=>setDays([{id:'b',label:'Second',date:'Current day',events:[{id:'current',start:'11:00',end:'12:00',title:'Current session',location:'Room B',notes:'Current meeting notes.'}]}]);return <Subject.WeekAgenda days={days} defaultDay="missing"/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const first=page.getByRole('button',{name:/Earlier session/});await first.click();await page.evaluate(()=>window.replaceDays());
  await page.getByRole('button',{name:'Second',exact:true}).waitFor();assert.equal(await first.count(),0);
  assert.equal(await page.getByRole('button',{name:'Second',exact:true}).getAttribute('aria-pressed'),'true');
  const current=page.getByRole('button',{name:/Current session/});assert.equal(await current.getAttribute('aria-expanded'),'false');await current.click();
  assert.equal(await page.getByText('Current meeting notes.',{exact:true}).isVisible(),true);await capture('replacement-day',{audit:true});

  await page.setViewportSize({width:320,height:2200});
  await mount(`const days=[{id:'wide',label:'Monday morning',date:'Monday, 12 October: the distributed research working group',events:[{id:'long',start:'09:30',end:'11:00',title:'Review the international research findings and agree the next interaction direction',location:'The library meeting room in the east wing',notes:'Bring the full research findings and a considered draft of the next prototype. '.repeat(3)}]},{id:'empty',label:'Tuesday afternoon',date:'Tuesday, 13 October',events:[]}];createRoot(document.getElementById('root')).render(<><Subject.WeekAgenda title="Research and design planning for the wider team" timezone="Client local time" days={days} defaultDay="wide"/><Subject.WeekAgenda title="Independent agenda" days={days} defaultDay="wide"/></>);`);
  const sections=page.locator('section');await sections.first().getByRole('button',{name:/Review the international/}).click();
  assert.equal(await sections.last().getByRole('button',{name:/Review the international/}).getAttribute('aria-expanded'),'false');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);return ids.filter((id,index)=>ids.indexOf(id)!==index)}),[]);
  assert.deepEqual(await page.locator('button[aria-controls]').evaluateAll(buttons=>buttons.filter(button=>!document.getElementById(button.getAttribute('aria-controls'))).map(button=>button.getAttribute('aria-controls'))),[]);
  await capture('long-independent-agendas',{audit:true});

  await page.setViewportSize({width:390,height:1700});
  await copies({page,mount,assert});await eventFocus({page,mount,assert});await dayFocus({page,mount,assert});await liveMotion({page,mount,assert});
  await page.emulateMedia({reducedMotion:'reduce'});
}
