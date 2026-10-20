const data=`
window.teamChannels=[{id:'alpha',name:'# alpha',description:'A working room'}];
window.teamInitial={alpha:[{id:'original',authorId:'mara',body:'The original release note.',time:'09:00',reactions:[{id:'like',count:1,by:['mara']}],replyCount:1,replyAuthorIds:['noor'],attachment:{name:'original-note.md',meta:'Markdown'}}]};
window.teamJobs=[];function Host(){const[brand,setBrand]=React.useState('Working group');window.refreshTeamBrand=()=>setBrand('The same working group');return <Subject.TeamWorkspace brand={brand} channels={window.teamChannels} initialMessages={window.teamInitial} onSend={(body,channelId)=>new Promise((resolve,reject)=>window.teamJobs.push({body,channelId,resolve,reject}))}/>};createRoot(document.getElementById('root')).render(<Host/>);`;
export async function check({page,mount,assert,capture=async()=>{}}){
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:1000});await mount(data);
  const draft=page.getByRole('textbox',{name:'Message # alpha',exact:true});
  await draft.fill('A verified new release note.');await draft.press('Control+Enter');await page.waitForFunction(()=>window.teamJobs.length===1);
  await page.evaluate(()=>{window.postedMessage={id:'accepted',authorId:'sam',body:window.teamJobs[0].body,time:'09:30',reactions:[{id:'agree',count:1,by:['noor']}],replyCount:1,replyAuthorIds:['mara'],attachment:{name:'accepted-note.md',meta:'Markdown'}};window.teamJobs[0].resolve(window.postedMessage)});
  await page.getByText('A verified new release note.',{exact:true}).waitFor();
  await page.evaluate(()=>{
    window.postedMessage.body='Mutated callback response';window.postedMessage.attachment.name='mutated-accepted.md';window.postedMessage.reactions[0].by[0]='sam';window.postedMessage.replyAuthorIds[0]='sam';
    const original=window.teamInitial.alpha[0];original.body='Mutated initial record';original.attachment.name='mutated-original.md';original.reactions[0].by[0]='sam';original.replyAuthorIds[0]='sam';
    window.refreshTeamBrand();
  });
  await page.locator('[data-demo="react-original-like"]').click();await page.locator('[data-demo="react-accepted-agree"]').click();
  await capture('retained-message-snapshots',{audit:true});
  for(const text of ['Mutated callback response','Mutated initial record','mutated-original.md','mutated-accepted.md'])assert.equal(await page.getByText(text,{exact:true}).count(),0,'Host mutation must not change retained message snapshots');
  for(const text of ['The original release note.','A verified new release note.','original-note.md','accepted-note.md'])assert.equal(await page.getByText(text,{exact:true}).isVisible(),true);
  assert.match(await page.locator('[data-demo="react-original-like"]').getAttribute('aria-label'),/^Like: Mara\./);
  assert.match(await page.locator('[data-demo="react-accepted-agree"]').getAttribute('aria-label'),/^Agree: Noor\./);
  assert.deepEqual(await page.evaluate(()=>window.teamJobs.map(({body,channelId})=>({body,channelId}))),[{body:'A verified new release note.',channelId:'alpha'}]);
}
