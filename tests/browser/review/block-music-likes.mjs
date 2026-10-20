export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.setViewportSize({width:1400,height:1000});
  await mount(`window.likeWrites=[];createRoot(document.getElementById('root')).render(<Subject.MusicWorkspace tracks={[{id:'__proto__',title:'Opaque track',artist:'The working group',album:'Working notes',seconds:180,liked:false},{id:'constructor',title:'Constructor track',artist:'The working group',album:'Working notes',seconds:210,liked:false}]} onLikeChange={(id,liked)=>window.likeWrites.push({id,liked})}/>);`);
  await page.getByRole('tab',{name:'Your collection',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Save Opaque track to liked songs',exact:true}).count(),1,'Raw track identities do not inherit a liked state from Object.prototype');
  const like=page.getByRole('button',{name:'Save Opaque track to liked songs',exact:true});
  await like.focus();await like.press('Enter');
  await page.getByRole('button',{name:'Remove Opaque track from liked songs',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.likeWrites),[{id:'__proto__',liked:true}]);
  await page.getByRole('button',{name:'Save Constructor track to liked songs',exact:true}).waitFor();
  await capture('opaque-track-likes',{audit:true});
}
