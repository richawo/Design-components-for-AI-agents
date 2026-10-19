export async function check({page,mount,assert,capture=async()=>{}}) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.EventTicket/>);`);
  let button=page.getByRole('button',{name:'View programme',exact:true});
  assert.equal(await button.getAttribute('aria-expanded'),'false');
  assert.equal(await page.getByRole('list').count(),0);
  await button.focus();await button.press('Enter');
  button=page.getByRole('button',{name:'Close programme',exact:true});
  assert.equal(await button.getAttribute('aria-expanded'),'true');
  const id=await button.getAttribute('aria-controls');assert.equal(await page.locator('[id='+JSON.stringify(id)+']').count(),1);
  assert.equal(await page.getByRole('listitem').count(),3);
  assert.match(await page.getByRole('list').innerText(),/Doors and coffee/);
  assert.equal(await button.evaluate(node=>node===document.activeElement),true);
  await capture('open-programme',{audit:true});
  await button.press('Space');
  assert.equal(await page.getByRole('list').count(),0);
  assert.equal(await page.getByRole('button',{name:'View programme',exact:true}).evaluate(node=>node===document.activeElement),true);
  await capture('closed-programme',{audit:true});

  await mount(`createRoot(document.getElementById('root')).render(<Subject.EventTicket agenda={[]}/>);`);
  await page.getByRole('button',{name:'View programme',exact:true}).click();
  assert.equal(await page.getByText('The programme will be announced soon.',{exact:true}).isVisible(),true);
  await capture('empty-programme',{audit:true});

  await mount(`function Host(){const [agenda,setAgenda]=React.useState([{time:'10:00',title:'Doors'}]);return <><Subject.EventTicket agenda={agenda}/><button id="replace" onClick={()=>setAgenda([{time:'11:30',title:'A conversation about craft'}])}>Update programme</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await page.getByRole('button',{name:'View programme',exact:true}).click();await page.locator('#replace').click();
  assert.equal(await page.getByRole('listitem').count(),1);
  assert.match(await page.getByRole('list').innerText(),/11:30\s+A conversation about craft/);
  assert.equal(await page.getByText('Doors',{exact:true}).count(),0);
  await capture('updated-programme',{audit:true});

  await mount(`createRoot(document.getElementById('root')).render(<Subject.EventTicket event="Craft in the everyday" attendee="Alexandra Morgan-Fernández" venue="The Assembly, a gathering space in central London" ticketCode="FIELDNOTES2026-2048-ALEXANDRA-MORGAN-FERNANDEZ" agenda={[{time:'11:30 BST',title:'A long conversation about the everyday details that make public places work well'}]}/>);`);
  await page.getByRole('button',{name:'View programme',exact:true}).click();
  await capture('long-pass',{audit:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Long passes wrap within the viewport');

  await mount(`createRoot(document.getElementById('root')).render(<><Subject.EventTicket event="Craft in the everyday" attendee="Alexandra Morgan-Fernández" venue="The Assembly, a gathering space in central London" ticketCode="FIELDNOTES2026-2048-ALEXANDRA-MORGAN-FERNANDEZ"/><Subject.EventTicket event="A second gathering"/></>);`);
  const controls=await page.getByRole('button',{name:'View programme',exact:true}).evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-controls')));
  assert.equal(new Set(controls).size,2,'Multiple tickets keep independent programme IDs');
  await page.getByRole('button',{name:'View programme',exact:true}).first().click();
  assert.equal(await page.getByRole('button',{name:'Close programme',exact:true}).count(),1);
  await checkLiveMotion({page,mount,assert,capture});
}

export async function checkLiveMotion({page,mount,assert,capture=async()=>{}}) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.EventTicket/>);`);
  await page.getByRole('button',{name:'View programme',exact:true}).click();
  await page.waitForTimeout(25);await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const button=page.getByRole('button',{name:'Close programme',exact:true}),id=await button.getAttribute('aria-controls');
  const region=page.locator('[id='+JSON.stringify(id)+']');
  const first=await region.evaluate(node=>node.getBoundingClientRect().height);await page.waitForTimeout(50);
  const second=await region.evaluate(node=>node.getBoundingClientRect().height);
  assert.ok(first>100 && Math.abs(first-second)<.5,'Live reduced motion settles the programme expansion');
  assert.equal(await button.evaluate(node=>node===document.activeElement),true);
  await capture('live-reduced-motion',{audit:true});
}
