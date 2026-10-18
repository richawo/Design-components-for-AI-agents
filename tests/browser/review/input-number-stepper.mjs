export async function check({ page, mount, assert, capture = async () => {} }) {
  const spin=()=>page.getByRole('spinbutton');
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={1} step={0.1} defaultValue={0.9} onChange={v=>window.changes.push(v)}/>);`);
  await spin().focus();await spin().press('ArrowUp');assert.equal(await spin().inputValue(),'1');
  assert.equal(await page.getByRole('button',{name:/Increase/}).isDisabled(),true);
  await spin().press('ArrowUp');assert.deepEqual(await page.evaluate(()=>window.changes),[1]);
  await spin().press('ArrowDown');assert.equal(await spin().inputValue(),'0.9');
  await spin().fill('not a number');await spin().press('Enter');assert.equal(await spin().inputValue(),'0.9');
  await spin().fill('-99');await spin().press('Enter');assert.equal(await spin().inputValue(),'0');
  assert.equal(await page.getByRole('button',{name:/Decrease/}).isDisabled(),true);
  await capture('minimum',{audit:true});
  await spin().fill('0.5');await spin().press('Tab');assert.equal(await spin().inputValue(),'0.5');
  await spin().fill('0.7');await spin().press('Escape');assert.equal(await spin().inputValue(),'0.5');
  await spin().fill('文');await spin().dispatchEvent('keydown',{key:'Enter',isComposing:true});assert.equal(await spin().inputValue(),'文');
  await spin().press('Escape');await spin().press('End');assert.equal(await spin().inputValue(),'1');
  await spin().press('Home');assert.equal(await spin().inputValue(),'0');
  await capture('keyboard-boundary',{audit:true});

  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={Number.MAX_SAFE_INTEGER} defaultValue={9007199254740990} onChange={v=>window.changes.push(v)}/>);`);
  await page.getByRole('button',{name:/Decrease/}).click();assert.equal(await spin().inputValue(),'9007199254740989');
  assert.deepEqual(await page.evaluate(()=>window.changes),[9007199254740989]);
  await spin().press('ArrowUp');assert.equal(await spin().inputValue(),'9007199254740990');
  await spin().press('End');assert.equal(await spin().inputValue(),'9007199254740991');
  assert.ok(await spin().evaluate(node=>node.scrollWidth<=node.clientWidth+1),'The complete safe integer fits its precise entry');
  await capture('safe-integer-value',{audit:true});
  await page.setViewportSize({width:320,height:1600});
  assert.ok(await spin().evaluate(node=>node.scrollWidth<=node.clientWidth+1),'The complete safe integer fits a 320px container');
  await capture('safe-integer-320',{audit:true});
  await page.setViewportSize({width:390,height:1600});

  await mount(`createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={-1e308} max={1e308} defaultValue={1e308}/>);`);
  assert.equal(await page.locator('[data-demo=ruler-indicator]').evaluate(node=>node.style.left),'100%');
  await spin().press('Home');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('[data-demo=ruler-indicator]').evaluate(node=>node.style.left),'0%');

  await mount(`createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={1e-9} step={1e-12} defaultValue={0}/>);`);
  await spin().press('ArrowUp');assert.equal(await spin().inputValue(),'1e-12');
  await mount(`createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={1e-198} step={1e-200} defaultValue={0}/>);`);
  await spin().press('ArrowUp');assert.equal(await spin().inputValue(),'1e-200','Very small finite increments cannot be rounded down to zero');
  await mount(`createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={8} max={2} step={0} defaultValue={NaN}/>);`);
  assert.equal(await spin().inputValue(),'8');assert.equal(await page.locator('section button:enabled').count(),0);
  await capture('collapsed-invalid-bounds',{audit:true});

  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={20} defaultValue={4} onChange={v=>window.changes.push(v)}/>);`);
  await spin().press('Shift+ArrowUp');assert.equal(await spin().inputValue(),'14');
  await spin().press('Shift+ArrowDown');assert.equal(await spin().inputValue(),'4');
  await spin().fill('8');await spin().press('ArrowUp');assert.equal(await spin().inputValue(),'9');
  assert.deepEqual(await page.evaluate(()=>window.changes),[14,4,9]);

  await mount(`window.changes=[];function Host(){const [value,setValue]=React.useState(4);return <><Subject.NumberStepper value={value} onChange={next=>window.changes.push(next)}/><button id="accept" onClick={()=>setValue(window.changes.at(-1))}>Accept host quantity</button><button id="replace" onClick={()=>setValue(12)}>Replace host quantity</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await page.getByRole('button',{name:/Increase/}).click();assert.equal(await spin().inputValue(),'4');
  assert.deepEqual(await page.evaluate(()=>window.changes),[5]);
  await page.locator('#accept').click();assert.equal(await spin().inputValue(),'5');
  await page.locator('#replace').click();assert.equal(await spin().inputValue(),'12');

  await mount(`createRoot(document.getElementById('root')).render(<Subject.NumberStepper value={4}/>);`);
  assert.equal(await spin().isEditable(),false);assert.equal(await page.locator('section button:enabled').count(),0);
  await capture('read-only',{audit:true});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.NumberStepper disabled/>);`);
  assert.equal(await spin().isDisabled(),true);assert.equal(await page.locator('section button:enabled').count(),0);
  await capture('disabled',{audit:true});

  await mount(`window.changes=[];document.addEventListener('pointerdown',event=>window.ownerPointer=event.pointerId,{capture:true});createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={20} defaultValue={0} onChange={v=>window.changes.push(v)}/>);`);
  const plus=page.getByRole('button',{name:/Increase/});
  const box=await plus.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.evaluate(()=>document.body.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:window.ownerPointer+1,button:0})));
  await page.waitForTimeout(460);assert.ok(Number(await spin().inputValue())>=2,'A held button repeats and a secondary release does not cancel it');
  await page.mouse.move(385,1550);await page.mouse.up();const released=await spin().inputValue();
  await page.waitForTimeout(180);assert.equal(await spin().inputValue(),released,'Release outside the button stops repeating');
  await capture('released-hold',{audit:true});

  await mount(`window.changes=[];function Host(){const [disabled,setDisabled]=React.useState(false);window.lock=()=>setDisabled(true);return <Subject.NumberStepper min={0} max={20} defaultValue={0} disabled={disabled} onChange={v=>window.changes.push(v)}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const lockBox=await page.getByRole('button',{name:/Increase/}).boundingBox();await page.mouse.move(lockBox.x+lockBox.width/2,lockBox.y+lockBox.height/2);await page.mouse.down();
  await page.evaluate(()=>window.lock());const locked=await spin().inputValue();await page.waitForTimeout(500);await page.mouse.up();
  assert.equal(await spin().inputValue(),locked,'Disabling stops an active hold');assert.equal(await spin().isDisabled(),true);

  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={20} defaultValue={0} onChange={v=>window.changes.push(v)}/>);`);
  const blurBox=await page.getByRole('button',{name:/Increase/}).boundingBox();await page.mouse.move(blurBox.x+blurBox.width/2,blurBox.y+blurBox.height/2);await page.mouse.down();
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const blurred=await spin().inputValue();await page.waitForTimeout(500);await page.mouse.up();
  assert.equal(await spin().inputValue(),blurred,'Window blur stops an active hold');

  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={100} defaultValue={0}/>);`);
  await spin().press('End');await page.waitForTimeout(25);await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const endpoint=await page.locator('[data-demo=ruler-indicator]').evaluate(node=>{const a=node.getBoundingClientRect(),b=node.parentElement.getBoundingClientRect();return Math.abs(a.x+a.width/2-b.right);});
  assert.ok(endpoint<=2,'Live reduced motion settles the ruler at the accepted value');
  assert.equal(await spin().evaluate(node=>node===document.activeElement),true,'Motion preference changes retain field focus');
  await capture('live-reduced-motion',{audit:true});
  await checkTypedPrecision({page,mount,assert,capture});
  await checkTimerRetirement({page,mount,assert});
  await checkPointerFocus({page,mount,assert});
}

export async function checkTypedPrecision({page,mount,assert,capture=async()=>{}}) {
  const exact='1.2345678901234567';
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={2} defaultValue={0} onChange={v=>window.changes.push(v)}/>);`);
  await page.getByRole('spinbutton').fill(exact);await page.getByRole('spinbutton').press('Enter');
  assert.equal(await page.getByRole('spinbutton').inputValue(),exact);
  assert.deepEqual(await page.evaluate(()=>window.changes),[Number(exact)]);
  await capture('typed-full-precision',{audit:true});
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={1.2345678901234567} max={2} defaultValue={2} onChange={v=>window.changes.push(v)}/>);`);
  await page.getByRole('spinbutton').press('Home');assert.equal(await page.getByRole('spinbutton').inputValue(),exact);
  assert.deepEqual(await page.evaluate(()=>window.changes),[Number(exact)]);
}

export async function checkTimerRetirement({page,mount,assert}) {
  await mount(`window.changes=[];document.addEventListener('pointerdown',event=>window.ownerPointer=event.pointerId,{capture:true});createRoot(document.getElementById('root')).render(<Subject.NumberStepper min={0} max={20} defaultValue={0} onChange={v=>window.changes.push(v)}/>);`);
  const box=await page.getByRole('button',{name:/Increase/}).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:window.ownerPointer,button:-1})));
  const cancelled=await page.getByRole('spinbutton').inputValue();await page.waitForTimeout(500);await page.mouse.up();
  assert.equal(await page.getByRole('spinbutton').inputValue(),cancelled,'Pointer cancellation stops repeating');

  await mount(`window.changes=[];function Host(){const [shown,setShown]=React.useState(true);window.retire=()=>setShown(false);return shown?<Subject.NumberStepper min={0} max={20} defaultValue={0} onChange={v=>window.changes.push(v)}/>:<p>Quantity editor closed</p>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const retireBox=await page.getByRole('button',{name:/Increase/}).boundingBox();await page.mouse.move(retireBox.x+retireBox.width/2,retireBox.y+retireBox.height/2);await page.mouse.down();
  await page.evaluate(()=>window.retire());const calls=await page.evaluate(()=>window.changes.length);await page.waitForTimeout(500);await page.mouse.up();
  assert.equal(await page.evaluate(()=>window.changes.length),calls,'Unmounting cannot publish later repeat callbacks');
  assert.equal(await page.getByRole('spinbutton').count(),0);
}

export async function checkPointerFocus({page,mount,assert}) {
  async function focusSequence(spin,plus) {
    await spin.focus();await spin.press('ArrowUp');await plus.click();
    const pointer=await plus.evaluate(node=>node.matches(':focus-visible'));
    await plus.press('Shift+Tab');await page.keyboard.press('Tab');
    const keyboard=await plus.evaluate(node=>node.matches(':focus-visible'));
    await plus.click();
    return {pointer,keyboard,retained:await plus.evaluate(node=>node.matches(':focus-visible'))};
  }
  await mount(`createRoot(document.getElementById('root')).render(<section><label>Native quantity<input type="number" defaultValue={4}/></label><button type="button">Native step</button></section>);`);
  const native=await focusSequence(page.getByRole('spinbutton'),page.getByRole('button',{name:'Native step'}));
  assert.equal(native.pointer,false);assert.equal(native.keyboard,true);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.NumberStepper/>);`);
  const spin=page.getByRole('spinbutton'),plus=page.getByRole('button',{name:/Increase/});
  const component=await focusSequence(spin,plus);
  console.log('Focus compared with native buttons:',JSON.stringify({native,component}));
  assert.deepEqual(component,native,'Pointer and keyboard focus follow the actual browser control');
  await spin.fill('8');await plus.click();
  assert.equal(await spin.inputValue(),'9','Native button focus commits the typed draft without losing its step');
}
