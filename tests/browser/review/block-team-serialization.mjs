const fixture=`window.noteSends=[];createRoot(document.getElementById('root')).render(<Subject.TeamWorkspace onSend={async(body,channelId)=>{window.noteSends.push({body,channelId});return{id:'note',authorId:'sam',body,time:'Now'}}}/>);`;
export async function check({page,mount,assert,capture=async()=>{}}){
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:940});const outcomes=[];
 for(const item of [{name:'paragraphs',body:'First line.\nSecond line.'},{name:'blank-crlf',body:'First line.\r\n\r\nThird line.'},{name:'keyboard',body:'First line.\nSecond line.',keyboard:true}]){
  await mount(fixture);const field=page.getByRole('textbox',{name:'Message # studio',exact:true});await field.fill('');
  if(item.keyboard){await field.pressSequentially('First line.');await field.press('Shift+Enter');await field.pressSequentially('Second line.');}
  else await field.evaluate((node,body)=>{node.focus();const data=new DataTransfer();data.setData('text/plain',body);node.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}))},item.body);
  await field.pressSequentially(' @ma');await page.getByRole('option').waitFor();await field.press('Enter');
  const dom=await field.evaluate(node=>({html:node.innerHTML,text:node.innerText}));await field.press('Control+Enter');
  await page.waitForFunction(()=>window.noteSends.length===1&&document.querySelector('[data-composer="studio"] [role="textbox"]')?.textContent==='');
  const actual=await page.evaluate(()=>window.noteSends[0]),expected={body:item.body.replace(/\r\n/g,'\n')+' @mara',channelId:'studio'};
  outcomes.push({name:item.name,dom,actual,expected,passed:actual.body===expected.body&&actual.channelId===expected.channelId});await capture('serialized-'+item.name,{audit:true});
 }
 assert.deepEqual(outcomes.filter(result=>!result.passed),[],'Plain-text paste and keyboard line breaks retain their exact content and stored mention handles');
}
