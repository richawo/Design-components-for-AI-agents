export async function check({ page, mount, assert, capture = async () => {} }) {
  const input = () => page.getByRole('textbox');
  const tags = () => page.locator('section button[aria-label^="Remove "]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label').slice(7)));
  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.TagEditor defaultValue={[]} maxTags={3} onChange={tags=>window.changes.push([...tags])}/>);`);
  await input().fill('Cedar,cedar, River,  Birch,Overflow'); await input().press('Enter');
  assert.deepEqual(await tags(), ['Cedar','River','Birch']);
  assert.deepEqual(await page.evaluate(() => window.changes), [['Cedar','River','Birch']]);
  assert.match(await page.getByRole('status').innerText(), /skipped/);
  await capture('full-and-duplicates', { audit: true });
  await page.getByRole('button', { name:'Remove River', exact:true }).click();
  assert.deepEqual(await tags(), ['Cedar','Birch']);
  assert.equal(await input().evaluate(node => node === document.activeElement), true);
  await input().press('Backspace'); assert.deepEqual(await tags(), ['Cedar']);
  await input().fill('Typography'); await page.getByRole('button',{name:'Add',exact:true}).click();
  assert.deepEqual(await tags(), ['Cedar','Typography']);
  assert.equal(await input().evaluate(node=>node===document.activeElement),true,'Adding returns focus to the entry');
  await capture('edited-tags', { audit: true });

  await mount(`window.changes=[];createRoot(document.getElementById('root')).render(<Subject.TagEditor defaultValue={[]} onChange={tags=>window.changes.push([...tags])}/>);`);
  await input().fill('文');
  await input().dispatchEvent('keydown',{key:'Enter',isComposing:true});
  await input().dispatchEvent('keydown',{key:',',isComposing:true});
  assert.equal(await input().inputValue(),'文'); assert.deepEqual(await tags(),[]);
  await input().press('Enter'); assert.deepEqual(await tags(),['文']);
  // Construct the native clipboard event in the owned page; no system clipboard is changed.
  await input().evaluate(node=>{const data=new DataTransfer();data.setData('text','Cedar,River\nCedar');node.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
  assert.deepEqual(await tags(),['文','Cedar','River']);
  await capture('paste-and-ime', { audit: true });

  await mount(`window.seed=['Cedar'];createRoot(document.getElementById('root')).render(<Subject.TagEditor defaultValue={window.seed}/>);`);
  await page.evaluate(()=>window.seed.push('Host only'));
  await input().fill('Draft');
  assert.deepEqual(await tags(),['Cedar'],'Mutating supplied defaults cannot alter local tags');

  await mount(`window.original=['Cedar'];window.changes=[];createRoot(document.getElementById('root')).render(<Subject.TagEditor defaultValue={window.original} onChange={tags=>{window.changes.push([...tags]);tags.push('Host mutation')}}/>);`);
  await input().fill('River'); await input().press('Enter');
  assert.deepEqual(await tags(),['Cedar','River'],'Host callback mutation cannot alter local tags');
  assert.deepEqual(await page.evaluate(()=>window.original),['Cedar']);
  assert.deepEqual(await page.evaluate(()=>window.changes),[['Cedar','River']]);

  await mount(`window.changes=[];function Host(){const [value,setValue]=React.useState(['Cedar']);return <><Subject.TagEditor value={value} onChange={next=>window.changes.push([...next])}/><button id="accept" onClick={()=>setValue(window.changes.at(-1))}>Accept host tags</button><button id="replace" onClick={()=>setValue(['Replacement'])}>Replace host tags</button></>};createRoot(document.getElementById('root')).render(<Host/>);`);
  await input().fill('River'); await input().press('Enter');
  assert.deepEqual(await tags(),['Cedar']);
  assert.deepEqual(await page.evaluate(()=>window.changes),[['Cedar','River']]);
  await page.locator('#accept').click(); assert.deepEqual(await tags(),['Cedar','River']);
  await page.locator('#replace').click(); assert.deepEqual(await tags(),['Replacement']);

  await mount(`createRoot(document.getElementById('root')).render(<Subject.TagEditor value={['Cedar']}/>);`);
  assert.equal(await input().isEditable(),false);
  assert.equal(await page.locator('section button:enabled').count(),0);
  await capture('read-only', { audit: true });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.TagEditor disabled/>);`);
  assert.equal(await input().isDisabled(),true);
  assert.equal(await page.locator('section button:enabled').count(),0);
  await capture('disabled', { audit: true });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.TagEditor defaultValue={[]} maxTags={0}/>);`);
  assert.equal(await input().isEditable(),false);
  assert.match(await page.getByRole('status').innerText(),/0 topics available/);
  await capture('empty-zero-limit', { audit: true });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.TagEditor defaultValue={['An unusually long but ordinary topic label that must wrap without hiding its remove control']} maxTags={1}/>);`);
  assert.equal(await page.getByRole('button',{name:/Remove An unusually/}).isEnabled(),true);
  await capture('long-topic', { audit: true });
  await checkBoundary({page,mount,assert,capture});
  await checkLiveMotion({page,mount,assert,capture});
}

export async function checkBoundary({page,mount,assert,capture=async()=>{}}) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.TagEditor/>);`);
  const measured=await page.getByRole('textbox').evaluate(input=>{
    const row=input.parentElement,root=input.closest('section');
    const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);
    const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const border=getComputedStyle(row).borderTopColor,background=getComputedStyle(root).backgroundColor,a=lum(rgb(border)),b=lum(rgb(background));
    return {border,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
  console.log('Tag entry boundary:',JSON.stringify(measured));
  assert.ok(measured.ratio>=3,'The topic entry has an identifiable 3:1 boundary');
  await capture('entry-boundary',{audit:true});
}
export async function checkLiveMotion({page,mount,assert,capture=async()=>{}}) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.TagEditor defaultValue={['A longer first topic','Interaction','Typography']}/>);`);
  await page.getByRole('button',{name:'Remove A longer first topic',exact:true}).click();
  await page.waitForTimeout(25);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const snapshot=()=>page.locator('section span:has(>button[aria-label^="Remove "])').evaluateAll(nodes=>nodes.map(node=>({text:node.innerText,transform:node.style.transform,rect:node.getBoundingClientRect().toJSON()})));
  const first=await snapshot();await page.waitForTimeout(50);const second=await snapshot();
  console.log('Live reduced-motion tags:',JSON.stringify({first,second}));
  assert.equal(await page.getByRole('textbox').evaluate(node=>node===document.activeElement),true,'Motion preferences retain entry focus');
  assert.equal(first.length,2);
  first.forEach((tag,i)=>{
    assert.ok(Math.abs(tag.rect.x-second[i].rect.x)<.5 && Math.abs(tag.rect.y-second[i].rect.y)<.5,'Live reduced motion settles tag positions immediately');
  });
  await capture('live-reduced-motion',{audit:true});
}
