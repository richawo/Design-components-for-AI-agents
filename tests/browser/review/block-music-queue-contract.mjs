export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.setViewportSize({width:1400,height:1000});
  await mount(`window.queueWrites=[];createRoot(document.getElementById('root')).render(<Subject.MusicWorkspace tracks={[{id:'',title:'Invalid identity',artist:'The working group',album:'Discarded',seconds:60},{id:'first',title:'First track',artist:'The working group',album:'Working notes',seconds:180},{id:'second',title:'Second track',artist:'The working group',album:'Working notes',seconds:210}]} initialQueue={['','first','first','missing']} onQueueChange={ids=>window.queueWrites.push([...ids])}/>);`);
  await page.getByRole('tab',{name:'Your collection',exact:true}).click();
  const firstQueued=await page.getByRole('button',{name:'First track is in your queue',exact:true}).count();
  await page.getByRole('button',{name:'Add Second track to your queue',exact:true}).click();
  const secondQueued=await page.getByRole('button',{name:'Second track is in your queue',exact:true}).count();
  await capture('queue-indicators',{audit:true});
  assert.deepEqual({firstQueued,secondQueued,payloads:await page.evaluate(()=>window.queueWrites)},{firstQueued:1,secondQueued:1,payloads:[['first','second']]},'Queue indicators and callback identities share the valid local order');
}
