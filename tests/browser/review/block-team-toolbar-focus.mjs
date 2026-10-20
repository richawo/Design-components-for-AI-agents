const fixture = `createRoot(document.getElementById('root')).render(<Subject.TeamWorkspace channels={[{id:'studio',name:'# studio',description:'Design work and decisions.'}]} initialMessages={{studio:[{id:'first',authorId:'mara',body:'A new topic without replies.',time:'10:00'},{id:'existing',authorId:'noor',body:'A topic with an existing thread.',time:'10:02',replyCount:1}]}}/>);`;
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.emulateMedia({reducedMotion:'reduce'});
  const outcomes=[];
  const touch=await page.evaluate(()=>matchMedia('(pointer:coarse)').matches);
  for (const width of [390,1440]) for (const [name,person] of [['new','Mara'],['existing','Noor']]) {
    await page.setViewportSize({width,height:940});await mount(fixture);
    const reply=page.getByRole('button',{name:'Reply to '+person+' in a thread',exact:true});
    if(touch){await page.getByRole('listitem',{name:(person==='Mara'?'Mara Vale, 10:00':'Noor Ali, 10:02'),exact:true}).tap();await reply.tap();}
    else{await reply.focus();await reply.press('Enter');}
    await page.waitForFunction(()=>document.activeElement?.getAttribute('data-demo')==='close-thread');
    const close=page.getByRole('button',{name:'Close message thread',exact:true});
    if(touch)await close.tap();else await close.press('Enter');await frames(page);
    const proof=await reply.evaluate(node=>({restored:node===document.activeElement,active:{tag:document.activeElement?.tagName,label:document.activeElement?.getAttribute('aria-label'),demo:document.activeElement?.getAttribute('data-demo')},theme:node.closest('main').classList.contains('bg-[#050505]')?'dark':'light'}));
    outcomes.push({width,name,...proof});await capture('toolbar-'+name+'-close-'+width,{audit:true});
  }
  assert.deepEqual(outcomes.filter(result=>!result.restored),[],'Closing a thread returns keyboard focus to its actual message action, including topics without prior replies');
}
