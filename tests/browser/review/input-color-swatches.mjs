export async function check({ page, mount, assert, capture = async () => {} }) {
  const chosen = () => page.locator('section > div').first().locator('span').last();
  const custom = () => page.getByLabel('Custom colour', { exact: true });
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.ColorSwatches onChange={hex=>window.changes.push(hex)}/>);`);
  const sage = page.getByRole('button', { name: 'Sage, #9ab4a3', exact: true });
  await sage.focus(); await sage.press('Enter');
  assert.equal(await sage.getAttribute('aria-pressed'), 'true');
  assert.equal(await chosen().textContent(), '#9ab4a3');
  const clay = page.getByRole('button', { name: 'Terracotta, #c7785b', exact: true });
  await clay.focus(); await clay.press('Space');
  assert.equal(await clay.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await page.evaluate(() => window.changes), ['#9ab4a3', '#c7785b']);
  await clay.click();
  assert.equal(await page.evaluate(() => window.changes.length), 2, 'Selecting the current colour is a no-op');
  await capture('selected-preset', { audit: true });
  await custom().fill('#123456');
  assert.equal(await chosen().textContent(), '#123456');
  assert.equal(await page.locator('button[aria-pressed=true]').count(), 0);
  assert.equal(await page.evaluate(() => window.changes.at(-1)), '#123456');
  await capture('custom-colour', { audit: true });

  await mount(`createRoot(document.getElementById('root')).render(<Subject.ColorSwatches swatches={[{name:'Invalid',hex:'red'},{name:'Short',hex:'#fff'},{name:'Good',hex:'#ABCDEF'}]} defaultValue="bad"/>);`);
  assert.equal(await page.getByRole('button').count(), 1);
  assert.equal(await chosen().textContent(), '#e5e5e5');
  await page.getByRole('button', { name: 'Good, #ABCDEF', exact: true }).click();
  assert.equal((await chosen().textContent()).toLowerCase(), '#abcdef');
  assert.equal((await custom().inputValue()).toLowerCase(), '#abcdef');
  await capture('filtered-colours', { audit: true });

  await mount(`createRoot(document.getElementById('root')).render(<Subject.ColorSwatches swatches={[]} defaultValue="#ffffff"/>);`);
  assert.equal(await page.getByRole('button').count(), 0);
  assert.equal(await custom().isEnabled(), true);
  await custom().fill('#000000');
  assert.equal(await chosen().textContent(), '#000000');
  await capture('empty-presets', { audit: true });

  await mount(`window.changes=[];function Host(){const [hex,setHex]=React.useState('#e7b75b');return <><Subject.ColorSwatches value={hex} onChange={next=>window.changes.push(next)}/><button id="accept" onClick={()=>setHex(window.changes.at(-1))}>Accept host colour</button><button id="replace" onClick={()=>setHex('#ffffff')}>Replace host colour</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await page.getByRole('button', { name: 'Sage, #9ab4a3', exact: true }).click();
  assert.equal(await chosen().textContent(), '#e7b75b', 'Controlled colour waits for its host');
  assert.deepEqual(await page.evaluate(() => window.changes), ['#9ab4a3']);
  await page.locator('#accept').click(); assert.equal(await chosen().textContent(), '#9ab4a3');
  await page.locator('#replace').click(); assert.equal(await chosen().textContent(), '#ffffff');

  await mount(`createRoot(document.getElementById('root')).render(<Subject.ColorSwatches value="#9ab4a3"/>);`);
  assert.equal(await custom().isDisabled(), true, 'Controlled palettes without a writer stay unavailable');
  assert.equal(await page.locator('section button:enabled').count(), 0);
  await capture('read-only', { audit: true });
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.ColorSwatches disabled onChange={hex=>window.changes.push(hex)}/>);`);
  assert.equal(await custom().isDisabled(), true);
  assert.equal(await page.locator('section button:enabled').count(), 0);
  assert.deepEqual(await page.evaluate(() => window.changes), []);
  await capture('disabled', { audit: true });

  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.ColorSwatches defaultValue="bad" onChange={hex=>window.changes.push(hex)}/>);`);
  await page.getByRole('button',{name:'Chalk, #e5e5e5',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.changes),['#e5e5e5'],'Choosing the fallback repairs an invalid stored value');
  await page.getByRole('button',{name:'Chalk, #e5e5e5',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.changes.length),1,'A valid current value is a no-op');

  await mount(`window.changes=[];function Host(){const [hex,setHex]=React.useState('bad');return <><Subject.ColorSwatches value={hex} onChange={next=>window.changes.push(next)}/><button id="accept" onClick={()=>setHex(window.changes.at(-1))}>Accept repaired colour</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await page.getByRole('button',{name:'Chalk, #e5e5e5',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.changes),['#e5e5e5']);
  await page.locator('#accept').click();
  await page.getByRole('button',{name:'Chalk, #e5e5e5',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.changes.length),1,'Acknowledged repairs become no-ops');

  for (const hex of ['#000000', '#ffffff', '#777777', '#757575', '#767676']) {
    await mount(`createRoot(document.getElementById('root')).render(<Subject.ColorSwatches defaultValue="${hex}"/>);`);
    const ratio = await chosen().evaluate(node => {
      const ctx = document.createElement('canvas').getContext('2d');
      const rgb = color => { ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3); };
      const lum = channels => channels.map(value => {const v=value/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const a=lum(rgb(getComputedStyle(node).color)),b=lum(rgb(getComputedStyle(node.parentElement).backgroundColor));
      return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    });
    assert.ok(ratio >= 4.5, `${hex} small specimen label meets AA: ${ratio}`);
    await capture(`ink-${hex.slice(1)}`, { audit: true });
  }
  await checkBoundary({page,mount,assert,capture});
  await checkLiveMotion({page,mount,assert,capture});
}

export async function checkBoundary({page,mount,assert,capture=async()=>{}}) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ColorSwatches swatches={[{name:'Black',hex:'#000000'},{name:'White',hex:'#ffffff'}]} defaultValue="#000000"/>);`);
  const measured=await page.locator('section button,input').evaluateAll(nodes=>nodes.map(node=>{
    const rgb=s=>s.match(/[\d.]+/g).map(Number),lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const style=getComputedStyle(node),border=rgb(style.borderTopColor),panel=rgb(getComputedStyle(node.closest('section')).backgroundColor),fill=rgb(style.backgroundColor),under=fill[3]===0?panel:fill,alpha=border[3]??1,painted=border.slice(0,3).map((v,i)=>v*alpha+under[i]*(1-alpha)),a=lum(painted),b=lum(panel);
    return {name:node.getAttribute('aria-label')??node.type,border:style.borderTopColor,fill:style.backgroundColor,panel,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  }));
  console.log('Colour control boundaries:',JSON.stringify(measured));
  assert.ok(measured.every(control=>control.ratio>=3),'Black/white presets and the native picker have identifiable 3:1 boundaries');
  await capture('control-boundaries',{audit:true});
}

export async function checkLiveMotion({page,mount,assert,capture=async()=>{}}) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ColorSwatches/>);`);
  const custom=page.getByLabel('Custom colour',{exact:true});await custom.focus();await custom.fill('#000000');
  await page.waitForTimeout(25);await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const painted=await page.locator('section > div').first().evaluate(node=>({background:getComputedStyle(node).backgroundColor,color:getComputedStyle(node).color,transition:getComputedStyle(node).transitionDuration}));
  assert.equal(painted.background,'rgb(0, 0, 0)','Live reduced motion settles the specimen colour immediately');
  assert.equal(painted.color,'rgb(255, 255, 255)');
  assert.equal(await custom.evaluate(node=>node===document.activeElement),true,'Motion changes retain picker focus');
  assert.equal(await custom.inputValue(),'#000000');
  await capture('live-reduced-motion',{audit:true});
}
