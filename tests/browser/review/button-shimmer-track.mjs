export async function check({ page, mount, assert }) {
  await mount(`window.buttonJobs=[];window.buttonStates=[];window.buttonErrors=[];createRoot(document.getElementById('root')).render(<Subject.ButtonShimmerTrack label="Publish reviewed build" loadingLabel="Publishing" successLabel="Build published" errorLabel="Retry publication" errorMessage="Publication was refused. Your review is retained." onStatusChange={state=>window.buttonStates.push(state)} onError={error=>window.buttonErrors.push(error.message)} onAction={(event,signal)=>new Promise((resolve,reject)=>window.buttonJobs.push({resolve,reject,signal,event:{type:event.type,tag:event.currentTarget.tagName}}))}/>);`);
  const button=page.locator('.bst-button');
  await button.focus();await button.press('Enter');
  await page.waitForFunction(()=>window.buttonJobs.length===1);
  assert.deepEqual(await page.evaluate(()=>window.buttonJobs[0].event),{type:'click',tag:'BUTTON'});
  assert.equal(await page.evaluate(()=>window.buttonJobs[0].signal instanceof AbortSignal),true);
  assert.equal(await button.getAttribute('aria-busy'),'true');
  assert.equal(await button.getAttribute('aria-disabled'),'true');
  await button.press('Enter');assert.equal(await page.evaluate(()=>window.buttonJobs.length),1);
  await page.evaluate(()=>window.buttonJobs[0].reject(Error('Service unavailable')));
  await page.getByRole('alert').filter({hasText:'Publication was refused.'}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.buttonErrors),['Service unavailable']);
  await page.getByRole('button',{name:'Retry publication',exact:true}).waitFor();
  await button.focus();await button.press('Space');
  await page.waitForFunction(()=>window.buttonJobs.length===2);
  await page.evaluate(()=>window.buttonJobs[1].resolve());
  await page.getByRole('button',{name:'Build published',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.buttonStates),['loading','error','loading','success']);
  await button.press('Enter');assert.equal(await page.evaluate(()=>window.buttonJobs.length),2);

  await mount(`window.buttonJobs=[];function Host(){const[state,setState]=React.useState('idle');const[progress,setProgress]=React.useState(.42);const[shown,setShown]=React.useState(true);window.resetButton=()=>setState('idle');window.progressButton=setProgress;window.removeButton=()=>setShown(false);return shown?<Subject.ButtonShimmerTrack label="Publish build" status={state} progress={progress} onStatusChange={setState} onAction={(_,signal)=>new Promise((resolve,reject)=>window.buttonJobs.push({resolve,reject,signal}))}/>:<p>Action removed</p>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await button.click();await page.waitForFunction(()=>window.buttonJobs.length===1);
  await page.getByRole('button',{name:/Deploying 42%/}).waitFor();
  await page.evaluate(()=>window.progressButton(2));await page.getByRole('button',{name:/Deploying 100%/}).waitFor();
  await page.evaluate(()=>window.resetButton());await page.getByRole('button',{name:'Publish build',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.buttonJobs[0].signal.aborted),true);
  await button.click();await page.waitForFunction(()=>window.buttonJobs.length===2);
  await page.evaluate(()=>window.buttonJobs[0].resolve());
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await button.getAttribute('aria-busy'),'true','A retired reply cannot settle its replacement');
  await page.evaluate(()=>window.removeButton());await page.getByText('Action removed',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.buttonJobs[1].signal.aborted),true);
  await page.evaluate(()=>window.buttonJobs[1].reject(Error('Retired request')));

  await mount(`window.disabledCalls=0;createRoot(document.getElementById('root')).render(<><Subject.ButtonShimmerTrack label="Disabled publication" disabled onAction={()=>{window.disabledCalls++}}/><Subject.ButtonShimmerTrack label="Unconnected publication"/><Subject.ButtonShimmerTrack label="Invalid progress" status="loading" progress={NaN} duration={NaN}/></>);`);
  assert.equal(await page.getByRole('button',{name:'Disabled publication',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Unconnected publication',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.disabledCalls),0);
  assert.equal(await page.getByRole('button',{name:'Unconnected publication',exact:true}).getAttribute('aria-busy'),null);
  assert.doesNotMatch(await page.locator('body').innerText(),/NaN|Infinity/);
}
