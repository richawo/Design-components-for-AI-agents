export async function check({ page, mount, assert, capture = async () => {} }) {
  const field = () => page.getByLabel('Choose a password', { exact: true });
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.PasswordChecklist onChange={value=>window.changes.push(value)}/>);`);
  assert.equal(await field().getAttribute('type'),'password');
  assert.equal(await field().getAttribute('autocomplete'),'new-password');
  assert.match(await page.getByRole('status').innerText(),/0 of 3/);
  await field().fill('Cedar'); assert.match(await page.getByRole('status').innerText(),/0 of 3/);
  await field().fill('Cedar-river42!');
  assert.match(await page.getByRole('status').innerText(),/3 of 3/);
  assert.deepEqual(await page.evaluate(()=>window.changes),['Cedar','Cedar-river42!']);
  assert.equal(await page.locator('li').filter({hasText:'Not met:'}).count(),0);
  await capture('requirements-met', { audit: true });
  const show=page.getByRole('button',{name:'Show password',exact:true});await show.focus();await show.press('Space');
  assert.equal(await field().getAttribute('type'),'text');assert.equal(await field().inputValue(),'Cedar-river42!');
  assert.equal(await page.getByRole('button',{name:'Hide password'}).getAttribute('aria-pressed'),'true');
  await capture('revealed', { audit: true });
  await page.getByRole('button',{name:'Hide password'}).press('Enter');
  assert.equal(await field().getAttribute('type'),'password');
  await field().fill(''); assert.match(await page.getByRole('status').innerText(),/0 of 3/);

  await mount(`window.changes=[];function Host(){const [value,setValue]=React.useState('Cedar');return <><Subject.PasswordChecklist value={value} onChange={next=>window.changes.push(next)}/><button id="accept" onClick={()=>setValue(window.changes.at(-1))}>Accept host text</button><button id="replace" onClick={()=>setValue('Host replacement 42!')}>Replace host text</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await field().fill('River');
  assert.equal(await field().inputValue(),'Cedar');assert.deepEqual(await page.evaluate(()=>window.changes),['River']);
  await page.locator('#accept').click(); assert.equal(await field().inputValue(),'River');
  await page.locator('#replace').click();assert.equal(await field().inputValue(),'Host replacement 42!');

  await mount(`createRoot(document.getElementById('root')).render(<Subject.PasswordChecklist value="Existing phrase 42!"/>);`);
  assert.equal(await field().isEditable(),false,'Controlled passwords without a writer remain read-only');
  await page.getByRole('button',{name:'Show password'}).click();
  assert.equal(await field().getAttribute('type'),'text','Reading a controlled value still allows reveal');
  await capture('read-only', { audit: true });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PasswordChecklist disabled defaultValue="Cedar-river42!"/>);`);
  assert.equal(await field().isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Show password'}).isDisabled(),true);
  assert.equal(await field().evaluate(node=>getComputedStyle(node).cursor),'not-allowed');
  await capture('disabled', { audit: true });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PasswordChecklist rules={[]}/>);`);
  assert.equal(await page.locator('li').count(),0);
  assert.equal(await page.getByRole('status').innerText(),'No password requirements configured');
  await field().fill('Any local phrase');assert.equal(await field().inputValue(),'Any local phrase');
  assert.deepEqual(await field().evaluate(node=>node.getAttribute('aria-describedby').split(/\s+/).filter(id=>!document.getElementById(id))),[],'Empty policies retain valid field descriptions');
  await capture('empty-rules', { audit: true });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PasswordChecklist rules={[{id:'four',label:'At least four characters',test:value=>value.length>=4},{id:'space',label:'Include a space between words',test:value=>value.includes(' ')}]}/>);`);
  await field().fill('Cedar');assert.match(await page.getByRole('status').innerText(),/1 of 2/);
  await field().fill('Cedar River');assert.match(await page.getByRole('status').innerText(),/2 of 2/);
  await capture('custom-rules', { audit: true });

  await mount(`createRoot(document.getElementById('root')).render(<><Subject.PasswordChecklist/><Subject.PasswordChecklist/></>);`);
  const ids=await page.locator('[id]').evaluateAll(nodes=>nodes.map(node=>node.id));
  assert.equal(new Set(ids).size,ids.length,'Independent fields keep unique descriptions and labels');
  await field().nth(0).fill('Cedar-river42!');assert.equal(await field().nth(1).inputValue(),'');
  assert.match(await page.getByRole('status').nth(0).innerText(),/3 of 3/);
  assert.match(await page.getByRole('status').nth(1).innerText(),/0 of 3/);
  await checkFieldBoundary({page,mount,assert,capture});
  await checkUnicodePolicy({page,mount,assert,capture});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PasswordChecklist rules={[{id:'four',label:'At least four characters',test:value=>value.length>=4}]}/>);`);
  await field().fill('Cedar');assert.equal(await page.getByRole('status').innerText(),'1 of 1 requirement met');
  await capture('single-requirement',{audit:true});
  await checkLiveMotion({page,mount,assert,capture});
}

export async function checkFieldBoundary({page,mount,assert,capture=async()=>{}}) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PasswordChecklist/>);`);
  const measured=await page.getByLabel('Choose a password',{exact:true}).evaluate(input=>{
    const row=input.parentElement,root=input.closest('section'),ctx=document.createElement('canvas').getContext('2d');
    const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
    const lum=channels=>channels.map(value=>{const v=value/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const border=getComputedStyle(row).borderTopColor,background=getComputedStyle(root).backgroundColor,a=lum(rgb(border)),b=lum(rgb(background));
    return {border,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
  console.log('Password field boundary:',JSON.stringify(measured));
  assert.ok(measured.ratio>=3,'The empty password field has an identifiable 3:1 boundary');
  await capture('field-boundary',{audit:true});
}

export async function checkUnicodePolicy({page,mount,assert,capture=async()=>{}}) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PasswordChecklist/>);`);
  const field=page.getByLabel('Choose a password',{exact:true});
  await field.fill('Café12345678');const accented=await page.getByRole('status').innerText();
  await field.fill('密碼1234567890!');const international=await page.getByRole('status').innerText();
  await field.fill('😀'.repeat(6));const emoji=await page.getByRole('status').innerText();
  await field.fill('ABCD1234567\u200d');const invisible=await page.getByRole('status').innerText();
  console.log('Unicode policy results:',JSON.stringify({accented,international,emoji,invisible}));
  assert.deepEqual({accented,international,emoji,invisible},{accented:'2 of 3 requirements met',international:'3 of 3 requirements met',emoji:'1 of 3 requirements met',invisible:'2 of 3 requirements met'},'Default policy distinguishes letters, punctuation/symbols and represented characters');
  await capture('unicode-policy',{audit:true});
}

export async function checkLiveMotion({page,mount,assert,capture=async()=>{}}) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PasswordChecklist/>);`);
  await page.getByLabel('Choose a password',{exact:true}).fill('Cedar-river42!');
  await page.waitForTimeout(25);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const progress=await page.locator('section > div[aria-hidden=true] > span > span').evaluateAll(nodes=>nodes.map(node=>({style:node.style.width,fraction:node.getBoundingClientRect().width/node.parentElement.getBoundingClientRect().width})));
  console.log('Live reduced-motion fills:',JSON.stringify(progress));
  assert.equal(await page.getByLabel('Choose a password',{exact:true}).evaluate(node=>node===document.activeElement),true,'Motion preferences retain entry focus');
  assert.equal(await page.getByLabel('Choose a password',{exact:true}).inputValue(),'Cedar-river42!');
  assert.ok(progress.length===3 && progress.every(fill=>fill.fraction>=0.999),'Live reduced motion settles every requirement fill immediately');
  await capture('live-reduced-motion',{audit:true});
}
