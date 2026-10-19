export async function check({page,mount,assert,capture=async()=>{}}) {
  const articles=()=>page.locator('section article');
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ReleaseNotes initialCount={1}/>);`);
  assert.equal(await articles().count(),1);
  const features=page.getByRole('button',{name:'Features',exact:true});await features.focus();await features.press('Space');
  assert.equal(await features.getAttribute('aria-pressed'),'true');
  assert.equal(await articles().getByText('Fix:',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Show 2 older releases',exact:true}).click();
  assert.equal(await articles().count(),3);
  assert.equal(await page.getByRole('button',{name:'Show fewer releases',exact:true}).getAttribute('aria-expanded'),'true');
  await capture('all-feature-releases',{audit:true});
  await page.getByRole('button',{name:'Show fewer releases',exact:true}).press('Enter');
  assert.equal(await articles().count(),1);
  const fixes=page.getByRole('button',{name:'Fixes',exact:true});await fixes.focus();await fixes.press('Enter');
  assert.equal(await fixes.getAttribute('aria-pressed'),'true');
  assert.equal(await articles().getByText('Feature:',{exact:true}).count(),0);
  assert.match(await articles().innerText(),/Keyboard focus now returns/);
  assert.equal(await fixes.evaluate(node=>node===document.activeElement),true);
  await capture('filtered-fixes',{audit:true});

  await mount(`function Host(){const [releases,setReleases]=React.useState([{id:'one',version:'1.0',date:'2026-10-11',title:'Reading room',summary:'A focused reading surface.',changes:[{kind:'feature',text:'A calmer view.'}]}]);return <><Subject.ReleaseNotes releases={releases}/><button id="replace" onClick={()=>setReleases([{id:'two',version:'1.1',date:'2026-10-12',title:'Keyboard repair',summary:'A more predictable return.',changes:[{kind:'fix',text:'Focus returns to the opener.'}]}])}>Load next release</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await page.getByRole('button',{name:'Fixes',exact:true}).click();
  assert.equal(await articles().count(),0);
  assert.equal(await page.getByRole('status').innerText(),'No releases match this filter.');
  await capture('empty-filter',{audit:true});
  await page.locator('#replace').click();assert.equal(await articles().count(),1);
  assert.match(await articles().innerText(),/Keyboard repair/);
  assert.equal(await page.getByText('Reading room',{exact:true}).count(),0);
  await capture('arriving-release',{audit:true});

  await mount(`createRoot(document.getElementById('root')).render(<Subject.ReleaseNotes releases={[]}/>);`);
  assert.equal(await articles().count(),0);
  assert.equal(await page.locator('[data-demo="older-releases"]').count(),0);
  await capture('empty-releases',{audit:true});
  for(const [initialCount,count] of [['0',1],['Number.NaN',2],['Number.POSITIVE_INFINITY',2]]) {
    await mount(`createRoot(document.getElementById('root')).render(<Subject.ReleaseNotes initialCount={${initialCount}}/>);`);
    assert.equal(await articles().count(),count);
  }
  await checkLiveMotion({page,mount,assert,capture});
}

export async function checkLiveMotion({page,mount,assert,capture=async()=>{}}) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ReleaseNotes initialCount={1}/>);`);
  await page.getByRole('button',{name:'Show 2 older releases',exact:true}).click();
  await page.locator('section article h3').first().evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);});
  const selected=await page.evaluate(()=>getSelection().toString());
  await page.waitForTimeout(25);await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const cards=await page.locator('section article').evaluateAll(nodes=>nodes.map(node=>({transform:getComputedStyle(node).transform})));
  assert.equal(await page.evaluate(()=>getSelection().toString()),selected,'Motion changes retain the selected release text');
  assert.equal(cards.length,3);cards.forEach(card=>assert.ok(card.transform==='none'||card.transform==='matrix(1, 0, 0, 1, 0, 0)','Live reduced motion settles article translation'));
  assert.equal(await page.getByRole('button',{name:'Show fewer releases',exact:true}).evaluate(node=>node===document.activeElement),true);
  await checkSelectionContrast({page,assert});
  await capture('live-reduced-motion',{audit:true});
}

export async function checkSelectionContrast({page,assert}) {
  const measured=await page.locator('article h3').first().evaluate(node=>{
    const style=getComputedStyle(node,'::selection'),base=getComputedStyle(node.closest('section')).backgroundColor,ctx=document.createElement('canvas').getContext('2d');
    const rgb=(color,under)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=under;ctx.fillRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
    const lum=channels=>channels.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,i)=>sum+value*[.2126,.7152,.0722][i],0);
    const background=rgb(style.backgroundColor,base),foreground=rgb(style.color,`rgb(${background.join(' ')})`),a=lum(background),b=lum(foreground);return {foreground:style.color,background:style.backgroundColor,base,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
  console.log('Selected release text:',JSON.stringify(measured));
  assert.ok(measured.ratio>=4.5,'Selected release text remains readable in its actual theme');
}
