async function checkCopies({page,mount,assert}){
 await mount(`window.cards=[{id:'one',title:'One task',description:'First observation.',columnId:'ready',owner:'Mara'},{id:'two',title:'Second task',description:'Second observation.',columnId:'ready',owner:'Noah'}];window.columns=[{id:'ready',title:'Ready'},{id:'working',title:'In progress'}];createRoot(document.getElementById('root')).render(<Subject.CompactKanban defaultItems={window.cards} defaultColumns={window.columns} onBoardChange={board=>{board.items.find(row=>row.id==='two').title='Host mutation';board.columns[0].title='Mutated lane'}}/>);`);
 await page.getByRole('combobox',{name:'Move One task',exact:true}).click();await page.getByRole('option',{name:'In progress',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.cards[1].title),'Second task','Atomic notifications cannot mutate an unchanged host task');
 assert.equal(await page.evaluate(()=>window.columns[0].title),'Ready','Atomic notifications cannot mutate the host columns');
}

async function checkExit({page,mount,assert}) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CompactKanban/>);`);
  await page.getByRole('button',{name:'Add column',exact:false}).click();
  await page.getByRole('textbox',{name:'Column name',exact:true}).fill('Review');
  await page.waitForTimeout(300);
  const exit=await page.getByRole('button',{name:'Cancel',exact:true}).evaluate(button=>{
    button.click();
    return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const form=document.querySelector('form');
      resolve({exists:!!form,inert:form?.inert,hidden:form?.getAttribute('aria-hidden')});
    })));
  });
  assert.ok(!exit.exists || (exit.inert&&exit.hidden==='true'),'A closing column form leaves keyboard and accessibility navigation immediately: '+JSON.stringify(exit));
}

async function checkMotion({page,mount,assert}) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CompactKanban/>);`);
  await page.getByRole('button',{name:'Add column',exact:false}).click();
  await page.waitForFunction(()=>{
    const form=document.querySelector('form');
    const opacity=form?Number(getComputedStyle(form).opacity):1;
    return opacity>0&&opacity<.95;
  },null,{polling:'raf',timeout:1500});
  await page.emulateMedia({reducedMotion:'reduce'});
  const frame=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const form=document.querySelector('form'),style=getComputedStyle(form);
    resolve({opacity:Number(style.opacity),height:form.getBoundingClientRect().height,preference:matchMedia('(prefers-reduced-motion: reduce)').matches});
  }))));
  assert.equal(frame.preference,true);
  assert.equal(frame.opacity,1,'A live reduced-motion preference immediately finishes the open column form: '+JSON.stringify(frame));
  assert.equal(await page.getByRole('textbox',{name:'Column name',exact:true}).evaluate(input=>input===document.activeElement),true,'Motion preference changes retain the column-name focus');
}

async function checkFocus({page,mount,assert}) {
  await mount(`window.moves=[];function Host(){const [items,setItems]=React.useState([{id:'one',title:'One task',description:'A host-controlled task.',columnId:'ready',owner:'Mara'}]);return <><button onClick={()=>setItems(rows=>[...rows])}>Refresh board</button><Subject.CompactKanban items={items} defaultColumns={[{id:'ready',title:'Ready'},{id:'working',title:'In progress'}]} selectMode="native" onChange={rows=>window.moves.push(rows)}/></>};createRoot(document.getElementById('root')).render(<Host/>);`);
  const menu=page.getByRole('combobox',{name:'Move One task',exact:true});
  await menu.selectOption('working');
  assert.equal(await menu.inputValue(),'ready','A controlled host may refuse a move');
  assert.equal(await page.evaluate(()=>window.moves.length),1);
  const refresh=page.getByRole('button',{name:'Refresh board',exact:true});
  await refresh.click();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await refresh.evaluate(button=>button===document.activeElement),true,'A refused move cannot steal focus from a later host refresh');
}

async function checkOrder({page,mount,assert}) {
  await mount(`window.orders=[];createRoot(document.getElementById('root')).render(<Subject.CompactKanban defaultColumns={[{id:'ready',title:'Ready'}]} defaultItems={['First','Second','Third'].map((title,index)=>({id:String(index),title,description:'Keep this position.',columnId:'ready',owner:'Mara'}))} onChange={items=>window.orders.push(items.map(row=>row.title))}/>);`);
  const first=page.getByRole('button',{name:'Move First with keyboard or pointer',exact:true});
  const order=()=>page.locator('[data-kanban-card]:not([inert]) h4').allTextContents();
  await first.focus();await first.press('Space');await first.press('Enter');
  assert.deepEqual(await order(),['First','Second','Third'],'Picking up and dropping a task without arrows preserves its position');
  await first.press('Space');await first.press('ArrowUp');await first.press('Enter');
  assert.deepEqual(await order(),['First','Second','Third'],'ArrowUp on the first task stays at the boundary');
  await first.press('Space');await first.press('ArrowDown');await first.press('Enter');
  assert.deepEqual(await order(),['Second','First','Third'],'ArrowDown moves the task exactly one position');
  const third=page.getByRole('button',{name:'Move Third with keyboard or pointer',exact:true});
  await third.focus();await third.press('Space');await third.press('ArrowUp');await third.press('Enter');
  assert.deepEqual(await order(),['Second','Third','First'],'ArrowUp moves the last task exactly one position');
}

async function checkColumnFocus({page,mount,assert}) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CompactKanban/>);`);
  await page.getByRole('button',{name:'Rename Ready',exact:true}).click();
  await page.getByRole('textbox',{name:'Column name',exact:true}).fill('Backlog');
  await page.getByRole('button',{name:'Save name',exact:true}).click();
  const renamed=page.getByRole('button',{name:'Rename Backlog',exact:true});
  assert.equal(await renamed.evaluate(button=>button===document.activeElement),true,'Saving a column name restores focus to that column action');
  await renamed.click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await renamed.evaluate(button=>button===document.activeElement),true,'Cancelling a rename restores focus to its trigger');
  const remove=page.getByRole('button',{name:'Remove Backlog',exact:true});
  await remove.click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await remove.evaluate(button=>button===document.activeElement),true,'Cancelling column removal restores focus to its trigger');
}

async function checkPaint({page,mount,assert}) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CompactKanban defaultColumns={[{id:'one',title:'Only'}]} defaultItems={[{id:'task',title:'Preserve this task',description:'Important work.',columnId:'one',owner:'Mara'}]}/>);`);
  await page.getByRole('button',{name:'Remove Only',exact:true}).click();
  await page.getByRole('button',{name:'Confirm removal',exact:true}).click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-kanban-column][inert]').count(),0,'Reduced-motion exits remove invisible lanes from the layout');
  assert.equal(await page.getByRole('region',{name:'Unassigned',exact:true}).getByText('Preserve this task',{exact:true}).count(),1);
}

export async function check({ page, mount, assert, capture = async () => {} }) {
  const select = async (name, value) => {
    const menu = page.getByRole('combobox', { name, exact: true });
    if (await menu.evaluate(node => node.tagName === 'SELECT')) return menu.selectOption(value);
    await menu.click();
    const id = await menu.getAttribute('aria-controls');
    const options = page.locator(`[id=${JSON.stringify(id)}] [role=option]`);
    const index = await options.evaluateAll((nodes, value) => nodes.findIndex(node => node.dataset.value === value), value);
    assert.ok(index >= 0, 'Requested lane is available');
    await options.nth(index).click();
  };
  const region = name => page.getByRole('region', { name, exact: true });
  const addColumn = () => page.getByRole('button', { name: 'Add column', exact: false });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1100, height: 1100 });
  await mount(`window.boards=[];createRoot(document.getElementById('root')).render(<Subject.CompactKanban onBoardChange={board=>window.boards.push(board)}/>);`);
  const menu = page.getByRole('combobox', { name: 'Move Tighten the type scale', exact: true });
  await menu.focus();
  await menu.press('ArrowDown');
  await menu.press('End');
  await menu.press('Enter');
  assert.equal(await region('Done').getByText('Tighten the type scale', { exact: true }).count(), 1);
  assert.equal(await menu.evaluate(node => node === document.activeElement), true);
  const handle = page.getByRole('button', { name: 'Move Tighten the type scale with keyboard or pointer', exact: true });
  await handle.focus();
  await handle.press('Space');
  await handle.press('ArrowLeft');
  await handle.press('Enter');
  assert.equal(await region('In progress').getByText('Tighten the type scale', { exact: true }).count(), 1);
  assert.equal(await handle.evaluate(node => node === document.activeElement), true);
  await handle.press('Space');
  await handle.press('ArrowRight');
  await handle.press('Escape');
  assert.equal(await region('In progress').getByText('Tighten the type scale', { exact: true }).count(), 1);
  const from = await handle.boundingBox(), lane = await region('Ready').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(lane.x + 32, lane.y + lane.height - 20, { steps: 12 });
  await page.mouse.up();
  await region('Ready').getByText('Tighten the type scale', { exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-kanban-card]')].every(node => !node.inert && Number(getComputedStyle(node).opacity) === 1), null, { timeout: 1500 });
  assert.deepEqual(await page.evaluate(() => window.boards.map(board => board.items.find(row => row.id === 'DS-14').columnId)), ['done', 'working', 'ready']);
  await page.setViewportSize({ width: 390, height: 1800 });
  await capture('moved-board', { audit: true });
  await addColumn().click();
  await page.getByRole('textbox', { name: 'Column name', exact: true }).fill('Ready');
  await page.getByRole('button', { name: 'Create column', exact: true }).click();
  assert.match(await page.getByRole('alert').innerText(), /already exists/);
  await page.getByRole('textbox', { name: 'Column name', exact: true }).fill('Review');
  await page.getByRole('button', { name: 'Create column', exact: true }).click();
  await region('Review').waitFor();
  await page.getByRole('button', { name: 'Rename Review', exact: true }).click();
  await page.getByRole('textbox', { name: 'Column name', exact: true }).fill('QA');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await region('QA').waitFor();
  await capture('renamed-column', { audit: true });
  await page.getByRole('button', { name: 'Remove QA', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  assert.equal(await region('QA').count(), 0);
  assert.equal(await page.locator('[data-kanban-card]:not([inert])').count(), 3);

  await mount(`window.fail=true;window.attempts=[];createRoot(document.getElementById('root')).render(<Subject.CompactKanban onBoardChange={board=>{window.attempts.push(structuredClone(board));if(window.fail)throw Error('Host is unavailable')}}/>);`);
  await addColumn().click();
  await page.getByRole('textbox', { name: 'Column name', exact: true }).fill('Review');
  await page.getByRole('button', { name: 'Create column', exact: true }).click();
  assert.match(await page.getByRole('alert').innerText(), /could not be updated/);
  assert.equal(await page.getByRole('textbox', { name: 'Column name', exact: true }).inputValue(), 'Review');
  assert.equal(await region('Review').count(), 0);
  await capture('retained-column-draft', { audit: true });
  await page.evaluate(() => window.fail = false);
  await page.getByRole('button', { name: 'Create column', exact: true }).click();
  await region('Review').waitFor();
  assert.equal(await page.evaluate(() => window.attempts.length), 2);
  assert.equal(await page.locator('[data-kanban-card]:not([inert])').count(), 3);
  await capture('column-retry', { audit: true });

  await mount(`window.accepted=[];function Host(){const [board,setBoard]=React.useState({columns:[{id:'one',title:'Only'}],items:[{id:'a',title:'Preserve this task',description:'Important work.',columnId:'one',owner:'Jo'}]});return <Subject.CompactKanban {...board} selectMode="native" onBoardChange={next=>{window.accepted.push(next);setBoard(next)}}/>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await page.getByRole('button', { name: 'Remove Only', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await region('Unassigned').getByText('Preserve this task', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.accepted[0]), { columns: [], items: [{ id: 'a', title: 'Preserve this task', description: 'Important work.', columnId: '__unassigned', owner: 'Jo' }] });
  await capture('preserved-unassigned-task', { audit: true });

  await mount(`createRoot(document.getElementById('root')).render(<Subject.CompactKanban defaultItems={[]} defaultColumns={[]}/>);`);
  assert.equal(await page.locator('[data-kanban-card]').count(), 0);
  assert.equal(await addColumn().isEnabled(), true);
  await capture('empty-board', { audit: true });
  await addColumn().click();
  await page.getByRole('textbox', { name: 'Column name', exact: true }).fill('Ready');
  await page.getByRole('button', { name: 'Create column', exact: true }).click();
  await region('Ready').waitFor();

  await mount(`createRoot(document.getElementById('root')).render(<Subject.CompactKanban items={[{id:'one',title:'Read-only task',description:'Owned by the host.',columnId:'ready',owner:'Mara'}]} columns={[{id:'ready',title:'Ready'}]}/>);`);
  assert.equal(await addColumn().isDisabled(), true);
  assert.equal(await page.getByRole('combobox', { name: 'Move Read-only task', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Rename Ready', exact: true }).isDisabled(), true);
  await capture('read-only-board', { audit: true });

  await mount(`createRoot(document.getElementById('root')).render(<><Subject.CompactKanban title="International release planning and accessibility review" defaultItems={[{id:'A_LONG_REFERENCE_WITHOUT_SPACES_12345678901234567890',title:'Keep the complete interaction usable with long translated task names',description:'Review the keyboard route, cancellation, and every route back to the board. '.repeat(3),columnId:'ready',owner:'AlexandriaMarisolFernandez'.repeat(3)}]} defaultColumns={[{id:'ready',title:'Ready for international release review'}]}/><Subject.CompactKanban title="Independent board" defaultItems={[]} defaultColumns={[]}/></>);`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(node => node.id);return ids.filter((id,index)=>ids.indexOf(id)!==index); }), []);
  await capture('long-data-independent-boards', { audit: true });
  await checkCopies({ page, mount, assert });
  await checkOrder({ page, mount, assert });
  await checkColumnFocus({ page, mount, assert });
  await checkPaint({ page, mount, assert });
  await checkFocus({ page, mount, assert });
  await checkExit({ page, mount, assert });
  await checkMotion({ page, mount, assert });
  await page.emulateMedia({ reducedMotion: 'reduce' });
}
