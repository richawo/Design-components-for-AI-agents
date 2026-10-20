export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.setViewportSize({width:390,height:940});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MusicWorkspace tracks={[{id:'solo',title:'An ungrouped track',artist:'The working group',album:'',seconds:180}]}/>);`);
  await capture('unassigned-release',{audit:true});
  assert.equal(await page.getByText('0 releases',{exact:true}).count(),1,'An empty album name is not a release');
}
