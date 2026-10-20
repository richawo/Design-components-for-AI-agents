const fixture = `
window.requests=[];window.noteEdits=[];
window.meetingDays=[{id:'mon',label:'Mon',date:'12 October',events:[{id:'review',title:'Studio review',start:'09:30',end:'10:15',location:'North room',notes:'Bring the current review.'},{id:'handoff',title:'Product handoff',start:'14:00',end:'14:30',location:'Online room',notes:'Agree the next owner.'}]}];
window.operation=(kind,id,value,signal)=>new Promise((resolve,reject)=>window.requests.push({kind,id,value,signal,resolve,reject}));
function Host(){const[days,setDays]=React.useState(window.meetingDays);const[visible,setVisible]=React.useState(true);window.replaceDays=setDays;window.unmountMeeting=()=>setVisible(false);return visible?<Subject.MeetingsWorkspace days={days} onJoin={(id,signal)=>window.operation('join',id,null,signal)} onLeave={(id,signal)=>window.operation('leave',id,null,signal)} onMicrophoneChange={(id,value,signal)=>window.operation('microphone',id,value,signal)} onCameraChange={(id,value,signal)=>window.operation('camera',id,value,signal)} onHandChange={(id,value,signal)=>window.operation('hand',id,value,signal)} onNotesChange={(id,text)=>window.noteEdits.push({id,text})}/>:<p>Meeting workspace closed</p>};
createRoot(document.getElementById('root')).render(<Host/>);`;
export async function check({page,mount,assert,capture=async()=>{}}) {
 const nav=name=>page.getByRole('tab',{name,exact:true});
 const requests=()=>page.evaluate(()=>window.requests.map(({kind,id,value,signal})=>({kind,id,value,aborted:signal.aborted})));
 const settle=async(index,ok=true)=>{await page.evaluate(({index,ok})=>ok?window.requests[index].resolve():window.requests[index].reject(Error('The room service is unavailable. Try again.')),{index,ok});};
 const join=()=>page.getByRole('button',{name:'Join selected room',exact:true});
 const control=name=>page.getByRole('button',{name,exact:true});
 await page.emulateMedia({reducedMotion:'reduce'});
 await mount(`createRoot(document.getElementById('root')).render(<Subject.MeetingsWorkspace/>);`);
 assert.equal(await join().isDisabled(),true,'No production transport means no join action');
 await nav('Working notes').click();
 const draft=page.getByRole('textbox',{name:'Studio review',exact:true});
 await draft.fill('The private working draft.');
 await nav('Your agenda').click();await nav('Working notes').click();
 assert.equal(await draft.innerText(),'The private working draft.');
 await capture('notes-without-transport',{audit:true});

 await mount(fixture);
 await join().click();
 assert.equal(await page.getByRole('button',{name:'Opening room…',exact:true}).getAttribute('aria-busy'),'true');
 await page.getByRole('button',{name:'Opening room…',exact:true}).press('Enter');
 assert.deepEqual(await requests(),[{kind:'join',id:'review',value:null,aborted:false}]);
 await settle(0,false);await page.getByRole('alert').filter({hasText:'The room service is unavailable.'}).waitFor();
 await capture('join-rejected',{audit:true});
 await join().click();await nav('Working notes').click();
 const reviewNotes=page.getByRole('textbox',{name:'Studio review',exact:true});
 await reviewNotes.fill('A decision written while the room opens.');
 await settle(1);await control('Leave room').waitFor();
 assert.equal(await nav('Working notes').getAttribute('aria-selected'),'true','A background join preserves the active working view');
 assert.equal(await reviewNotes.innerText(),'A decision written while the room opens.');
 await nav('Your agenda').click();
 await page.getByRole('button',{name:/Product handoff/}).click();
 await nav('Working notes').click();
 const handoffNotes=page.getByRole('textbox',{name:'Product handoff',exact:true});
 await handoffNotes.fill('The handoff retains a different draft.');
 await control('Unmute microphone').click();
 assert.deepEqual((await requests()).at(-1),{kind:'microphone',id:'review',value:false,aborted:false},'Media remains scoped to the joined meeting, not the selected notes');
 assert.equal(await control('Unmute microphone').getAttribute('aria-pressed'),'false','Pending media is not optimistically accepted');
 const heldHand=await control('Raise hand').boundingBox();assert.ok(heldHand);await page.mouse.click(heldHand.x+heldHand.width/2,heldHand.y+heldHand.height/2);assert.equal((await requests()).length,3,'Only one host operation is active');
 await settle(2,false);await page.getByRole('alert').waitFor();
 assert.equal(await handoffNotes.innerText(),'The handoff retains a different draft.');
 await page.getByText('In room: Studio review',{exact:true}).waitFor();await capture('media-rejected-in-notes',{audit:true});
 await control('Unmute microphone').click();await settle(3);await control('Mute microphone').waitFor();
 assert.equal(await control('Mute microphone').getAttribute('aria-pressed'),'true');
 await control('Turn camera on').click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await control('Turn camera on').getAttribute('aria-busy'),'true');await settle(4);await control('Turn camera off').waitFor();
 await control('Raise hand').click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await control('Raise hand').getAttribute('aria-busy'),'true');await settle(5);await control('Lower hand').waitFor();
 await nav('Meeting room').click();await page.getByRole('tabpanel',{name:'Meeting room',exact:true}).getByRole('heading',{name:'Studio review',exact:true}).waitFor();
 await capture('joined-media-state',{audit:true});
 await nav('Your agenda').click();await page.getByRole('button',{name:/Studio review/}).click();await nav('Working notes').click();
 assert.equal(await reviewNotes.innerText(),'A decision written while the room opens.');
 const edits=await page.evaluate(()=>window.noteEdits);assert.ok(edits.some(edit=>edit.id==='review'&&edit.text==='A decision written while the room opens.'));assert.ok(edits.some(edit=>edit.id==='handoff'&&edit.text==='The handoff retains a different draft.'));
 await control('Leave room').click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await control('Leave room').getAttribute('aria-busy'),'true');await settle(6,false);await page.getByRole('alert').waitFor();
 assert.equal((await requests())[1].aborted,false,'A rejected leave keeps the accepted session alive');
 assert.equal(await control('Mute microphone').isVisible(),true);
 assert.equal(await reviewNotes.innerText(),'A decision written while the room opens.');
 await capture('leave-rejected',{audit:true});
 await control('Leave room').click();await settle(7);await control('Leave room').waitFor({state:'hidden'});
 assert.equal((await requests())[1].aborted,true,'An accepted leave releases the accepted join signal');
 assert.equal(await nav('Working notes').getAttribute('aria-selected'),'true');
 assert.equal(await reviewNotes.innerText(),'A decision written while the room opens.');

 for(const kind of ['join','microphone','camera','hand','leave']) {
  await mount(fixture);await join().click();
  if(kind!=='join'){await settle(0);await control('Leave room').waitFor();const name={microphone:'Unmute microphone',camera:'Turn camera on',hand:'Raise hand',leave:'Leave room'}[kind];await control(name).click();}
  const oldIndex=kind==='join'?0:1;
  await page.evaluate(()=>window.replaceDays([{...window.meetingDays[0],events:[window.meetingDays[0].events[1]]}]));
  await page.waitForFunction(index=>window.requests[index].signal.aborted,oldIndex);
  assert.equal((await requests())[0].aborted,true,'Removing a room aborts its join/session signal');
  await nav('Your agenda').click();await join().click();const freshIndex=oldIndex+1;
  assert.equal((await requests())[freshIndex].id,'handoff');
  await settle(freshIndex);await control('Leave room').waitFor();await page.getByRole('tabpanel',{name:'Meeting room',exact:true}).getByRole('heading',{name:'Product handoff',exact:true}).waitFor();
  await settle(oldIndex,kind==='join'||kind==='camera');
  assert.equal(await nav('Meeting room').getAttribute('aria-selected'),'true');
  assert.equal(await control('Unmute microphone').isVisible(),true,'A late retired media outcome cannot mutate the new room');
  assert.equal(await control('Turn camera on').isVisible(),true);
  assert.equal(await control('Raise hand').isVisible(),true);
  assert.equal(await page.getByRole('alert').count(),0,'A retired rejection cannot report against a newer room');
  await capture('retired-'+kind,{audit:kind==='join'||kind==='leave'});
 }
 await mount(fixture);await join().click();await page.evaluate(()=>window.unmountMeeting());await page.getByText('Meeting workspace closed',{exact:true}).waitFor();
 assert.equal((await requests())[0].aborted,true);await settle(0);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await page.getByText('Meeting workspace closed',{exact:true}).isVisible(),true);
}
