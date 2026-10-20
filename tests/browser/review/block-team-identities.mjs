export async function check({page,mount,assert,capture=async()=>{}}){
  await page.emulateMedia({reducedMotion:'reduce'});
  await mount(`window.opaqueSends=[];function Host(){const[channels,setChannels]=React.useState([]);window.arriveChannels=()=>setChannels([{id:'toString',name:'# research',description:'A research room'},{id:'__proto__',name:'# archive',description:'An archive room'}]);return <Subject.TeamWorkspace channels={channels} initialMessages={Object.fromEntries([['__proto__',[{id:'constructor',authorId:'mara',body:'An archived note.',time:'09:00',replyCount:1}]]])} onSend={async(body,channelId)=>{window.opaqueSends.push({body,channelId});return{id:'hasOwnProperty',authorId:'sam',body,time:'Now'}}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  assert.equal(await page.getByRole('textbox').count(),0);await capture('empty-channels',{audit:true});
  await page.evaluate(()=>window.arriveChannels());
  await page.getByRole('textbox',{name:'Message # research',exact:true}).waitFor();
  const research=page.getByRole('textbox',{name:'Message # research',exact:true});await research.fill('A research note.');await research.press('Control+Enter');await page.getByText('A research note.',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'# archive',exact:true}).click();await page.getByText('An archived note.',{exact:true}).waitFor();
  await page.locator('[data-demo="reply-constructor"]').click();await page.getByRole('button',{name:'Close message thread',exact:true}).click();
  const archive=page.getByRole('textbox',{name:'Message # archive',exact:true});await archive.fill('An archive note.');await archive.press('Control+Enter');await page.getByText('An archive note.',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.opaqueSends),[{body:'A research note.',channelId:'toString'},{body:'An archive note.',channelId:'__proto__'}]);
  await capture('opaque-channel-and-message-identities',{audit:true});
}
