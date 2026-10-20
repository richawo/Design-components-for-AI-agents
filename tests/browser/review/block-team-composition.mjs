export async function check({page,mount,assert,capture=async()=>{}}) {
 await page.emulateMedia({reducedMotion:'reduce'});const results=[];
 const attempt=async(name,run)=>{try{await run();results.push({name,passed:true})}catch(error){results.push({name,passed:false,error:String(error.message)})}};
 await attempt('local default demo sends without secure-context UUID support',async()=>{
  await page.setViewportSize({width:390,height:940});await mount(`Object.defineProperty(crypto,'randomUUID',{configurable:true,value:undefined});window.demoEnvironment={secure:isSecureContext,randomUUID:typeof crypto.randomUUID};createRoot(document.getElementById('root')).render(<Subject.default initialMessages={{studio:[],product:[],noor:[]}}/>);`);
  const body='The phone pass is ready.';const field=page.getByRole('textbox',{name:'Message # studio',exact:true});await field.fill(body);await field.press('Control+Enter');
  await page.waitForFunction(body=>document.querySelector('[role="log"]')?.textContent.includes(body)||!!document.querySelector('[role="alert"]'),body);
  await capture('default-demo-send',{audit:true});assert.equal(await page.getByRole('log').getByText(body,{exact:true}).count(),1,'Default demo must accept the local message');
  await field.fill('A second local message.');await field.press('Control+Enter');await page.getByRole('log').getByText('A second local message.',{exact:true}).waitFor();assert.equal(await page.getByRole('log').getByText(body,{exact:true}).count(),1,'Local post IDs stay unique');
 });
 await attempt('default demo honors currentUserId',async()=>{
  await page.setViewportSize({width:1440,height:940});await mount(`Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=> 'fixture-message'});createRoot(document.getElementById('root')).render(<Subject.default currentUserId="noor" initialMessages={{studio:[],product:[],noor:[]}}/>);`);
  const field=page.getByRole('textbox',{name:'Message # studio',exact:true});await field.fill('A note from Noor.');await field.press('Control+Enter');await page.getByRole('log').getByText('A note from Noor.',{exact:true}).waitFor();
  const label=await page.getByRole('log').getByText('A note from Noor.',{exact:true}).evaluate(node=>node.closest('li').getAttribute('aria-label'));await capture('default-demo-current-user',{audit:true});assert.equal(label,'Noor Ali, Now');
 });
 for(const width of [320,390,1440])await attempt('long draft keeps messages and sending reachable at '+width,async()=>{
  await page.setViewportSize({width,height:940});await mount(`createRoot(document.getElementById('root')).render(<Subject.TeamWorkspace onSend={async body=>({id:'posted',authorId:'sam',body,time:'Now'})}/>);`);
  const body=Array.from({length:45},(_,i)=>'Draft line '+(i+1)+': keep the complete message.').join('\n');assert.ok(body.length<4000);
  await page.getByRole('textbox',{name:'Message # studio',exact:true}).fill(body);
  const geometry=await page.evaluate(()=>{const field=document.querySelector('[data-composer="studio"] [role="textbox"]'),log=document.querySelector('[role="log"]'),send=document.querySelector('[data-demo="send-studio"]'),r=send.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{editorHeight:field.clientHeight,editorScrollHeight:field.scrollHeight,logHeight:log.getBoundingClientRect().height,sendVisible:!!hit&&(send===hit||send.contains(hit))}});
  await capture('long-draft-'+width,{audit:true});assert.ok(geometry.editorHeight<=280&&geometry.editorScrollHeight>geometry.editorHeight&&geometry.logHeight>=120&&geometry.sendVisible,JSON.stringify(geometry));
 });
 await attempt('oversized draft stays editable and can be shortened',async()=>{
  await page.setViewportSize({width:390,height:940});await mount(`window.limitSends=[];createRoot(document.getElementById('root')).render(<Subject.TeamWorkspace onSend={async(body,channelId)=>{window.limitSends.push({body,channelId});return{id:'short-post',authorId:'sam',body,time:'Now'}}}/>);`);
  const field=page.getByRole('textbox',{name:'Message # studio',exact:true});const oversized='x'.repeat(4001);await field.fill(oversized);await page.locator('[data-demo="send-studio"]').click();await page.getByRole('alert').getByText('Shorten this message to 4,000 characters.',{exact:true}).waitFor();assert.equal(await field.innerText(),oversized);assert.deepEqual(await page.evaluate(()=>window.limitSends),[]);
  await capture('oversized-draft',{audit:true});await field.fill('Short enough to send.');await field.press('Control+Enter');await page.getByRole('log').getByText('Short enough to send.',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('[data-composer="studio"] [role="textbox"]')?.textContent==='');assert.deepEqual(await page.evaluate(()=>window.limitSends),[{body:'Short enough to send.',channelId:'studio'}]);assert.equal(await page.getByRole('alert').count(),0);
 });
 await attempt('empty workspace has product copy',async()=>{
  await page.setViewportSize({width:320,height:940});await mount(`createRoot(document.getElementById('root')).render(<Subject.TeamWorkspace channels={[]} initialMessages={{}}/>);`);await page.getByText('No channels yet.',{exact:true}).waitFor();await page.getByText('Channels and direct messages.',{exact:true}).waitFor();assert.equal(await page.getByRole('textbox').count(),0);await capture('empty-workspace',{audit:true});
 });
 assert.deepEqual(results.filter(result=>!result.passed),[],'Team default send and bounded long-draft workflow');
}
