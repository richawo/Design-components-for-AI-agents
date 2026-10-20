export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.setViewportSize({width:1000,height:940});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MusicWorkspace brand="Low Tide" tracks={[{id:'one',title:'First track',artist:'The working group',album:'Working notes',seconds:180}]}/>);`);
  const result={brand:await page.getByText('Low Tide · Selected recordings',{exact:true}).count(),oldBrand:await page.getByText('Side A · Selected recordings',{exact:true}).count(),singular:await page.getByText('1 release',{exact:true}).count()};
  await capture('custom-brand-one-release',{audit:true});
  assert.deepEqual(result,{brand:1,oldBrand:0,singular:1},'The vinyl study shares its workspace brand and exact release count');
}
