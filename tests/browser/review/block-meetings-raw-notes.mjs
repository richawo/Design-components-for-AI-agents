export async function check({page,mount,assert,capture=async()=>{}}) {
  const runtime=[];const onError=error=>runtime.push(error.message);page.on('pageerror',onError);
  await page.setViewportSize({width:900,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});
  await mount(`function Host(){const[days,setDays]=React.useState([]);window.arriveRawMeeting=()=>setDays([{id:'arriving',label:'Thu',date:'22 October',events:[{id:'__proto__',title:'Opaque identity review',start:'10:00',end:'10:30',location:'Online room',notes:'Keep the raw meeting identity.'}]}]);return <Subject.MeetingsWorkspace days={days}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await page.getByRole('tab',{name:'Working notes',exact:true}).click();
  await page.evaluate(()=>window.arriveRawMeeting());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.waitForTimeout(150);assert.deepEqual(runtime,[],'Arriving raw meeting identity must not crash its notes');
  const notes=page.getByRole('textbox',{name:'Opaque identity review',exact:true});
  await notes.waitFor();assert.equal(await notes.innerText(),'Keep the raw meeting identity.');
  await notes.fill('The same identity keeps its own draft.');
  await page.getByRole('tab',{name:'Your agenda',exact:true}).click();
  await page.getByRole('tab',{name:'Working notes',exact:true}).click();
  assert.equal(await notes.innerText(),'The same identity keeps its own draft.');
  await capture('arriving-opaque-notes',{audit:true});page.off('pageerror',onError);
}
