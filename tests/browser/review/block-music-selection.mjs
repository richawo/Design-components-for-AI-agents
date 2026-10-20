export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.setViewportSize({width:1000,height:940});
  await mount(`window.sourceTracks=[{id:'first',title:'First track',artist:'The working group',album:'Working notes',seconds:180},{id:'second',title:'Second track',artist:'The working group',album:'Working notes',seconds:210}];function Host(){const[tracks,setTracks]=React.useState(window.sourceTracks);window.replaceTracks=setTracks;return <Subject.MusicWorkspace tracks={tracks}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await page.getByRole('region',{name:'Audio player: First track by The working group',exact:true}).waitFor();
  await page.evaluate(()=>window.replaceTracks([window.sourceTracks[1]]));
  await page.getByRole('region',{name:'Audio player: Second track by The working group',exact:true}).waitFor();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>window.replaceTracks(window.sourceTracks));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await capture('retired-selection-return',{audit:true});
  assert.equal(await page.getByRole('region',{name:'Audio player: Second track by The working group',exact:true}).count(),1,'A returning track cannot reclaim a retired current selection');
}
