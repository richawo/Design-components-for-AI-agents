// Regression coverage for finished view edits, copied callbacks and graphics recovery.
export async function check({page,mount,assert,capture=async()=>{}}) {
  await page.setViewportSize({width:1440,height:1400});
  const render = props => `createRoot(document.getElementById('root')).render(<Subject.ThreeExplodedAssembly ${props}/>);`;
  const contrast = (locator, parentBackground = false) => locator.evaluate((node, parent) => {
    const style = getComputedStyle(node);
    const backgroundColor = getComputedStyle(parent ? node.parentElement : node).backgroundColor;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const background = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    context.fillStyle = style.color;
    context.fillRect(0, 0, 1, 1);
    const foreground = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    const luminance = rgb => {
      const channels = rgb.map(value => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const f = luminance(foreground), b = luminance(background);
    return {foreground, background, ratio: (Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05)};
  }, parentBackground);
  const turn = () => page.locator('[data-demo="assembly-turn"]');
  const start = 25, end = 75;
  await mount(`window.changes=[];window.commits=[];window.refuse=true;${render("onValueChange={next=>{window.changes.push({...next});if(window.refuse)throw Error('Refused view')}} onValueCommit={next=>window.commits.push({...next})}")}`);
  const initialId = await page.locator('input[type="radio"]:checked').inputValue();
  const initial = {selectedId:initialId,separation:0,azimuth:25};
  await turn().press('End');
  assert.equal(Number(await turn().inputValue()), start, 'A refused request keeps the previous view');
  assert.equal(await page.evaluate(()=>window.commits.length), 0);
  await page.getByRole('alert').filter({hasText:'wasn’t accepted'}).waitFor();
  await capture('refused-view',{audit:true});
  await page.evaluate(()=>window.refuse=false);
  await turn().press('End');
  await page.waitForFunction(()=>window.commits.length===1);
  assert.deepEqual(await page.evaluate(()=>window.commits[0]), {...initial,azimuth:end});
  await turn().press('Home');
  assert.equal(Number(await turn().inputValue()), -end);
  await turn().press('ArrowRight');
  assert.equal(Number(await turn().inputValue()), -end+1);
  const second = page.getByRole('radio').nth(1);
  const nextId = await second.inputValue();
  await second.press('Space');
  await page.waitForFunction(id=>document.querySelector(`input[type="radio"][value="${id}"]`)?.checked,nextId);
  await page.waitForTimeout(80);
  assert.equal((await page.evaluate(()=>window.commits.at(-1))).selectedId, nextId);
  await capture('accepted-view',{audit:true});

  await turn().scrollIntoViewIfNeeded();
  const box=await turn().boundingBox();assert.ok(box);
  await page.evaluate(()=>window.commits=[]);
  await page.mouse.move(box.x+box.width*.3,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.75,box.y+box.height/2,{steps:10});
  assert.equal(await page.evaluate(()=>window.commits.length),0,'A range drag commits only on release');
  await page.mouse.up();await page.waitForFunction(()=>window.commits.length===1);
  assert.deepEqual(await page.evaluate(()=>window.commits[0]),await page.evaluate(()=>window.changes.at(-1)));
  const beforeCancel=Number(await turn().inputValue());
  await page.evaluate(()=>window.commits=[]);
  await turn().focus();await page.keyboard.down('ArrowLeft');await page.keyboard.press('Escape');await page.keyboard.up('ArrowLeft');
  assert.equal(Number(await turn().inputValue()),beforeCancel,'Escape rolls a held-key edit back');
  assert.equal(await page.evaluate(()=>window.commits.length),0);
  await capture('drag-and-cancel',{audit:true});

  await page.locator('.ea-canvas.ea-ready canvas').waitFor();
  const view=page.locator('[data-demo="assembly-view"]');await view.scrollIntoViewIfNeeded();
  const area=await view.boundingBox();assert.ok(area);
  const beforeOrbit=Number(await turn().inputValue());
  await page.evaluate(()=>window.commits=[]);
  await page.mouse.move(area.x+area.width/2,area.y+area.height/2);await page.mouse.down();
  await page.mouse.move(area.x+area.width/2-80,area.y+area.height/2,{steps:10});
  assert.equal(await page.evaluate(()=>window.commits.length),0);
  await page.mouse.up();await page.waitForFunction(()=>window.commits.length===1);
  assert.notEqual(Number(await turn().inputValue()),beforeOrbit,'The actual canvas drag changes the view angle');
  await capture('turned-canvas',{audit:true});
  await view.press('Home');assert.equal(Number(await turn().inputValue()),-end);
  await view.press('End');assert.equal(Number(await turn().inputValue()),end);
  await view.press('ArrowLeft');assert.equal(Number(await turn().inputValue()),end-5);
  await capture('keyboard-turn',{audit:true});
  const feature=page.locator('[data-demo="assembly-separation"]');
  await feature.press('Home');assert.equal(Number(await feature.inputValue()),0);
  await feature.press('End');assert.equal(Number(await feature.inputValue()),100);
  await page.waitForTimeout(80);
  assert.equal((await page.evaluate(()=>window.commits.at(-1))).separation,1);
  await feature.scrollIntoViewIfNeeded();const featureBox=await feature.boundingBox();assert.ok(featureBox);
  await page.evaluate(()=>window.commits=[]);
  await page.mouse.move(featureBox.x+featureBox.width*.25,featureBox.y+featureBox.height/2);await page.mouse.down();
  await page.mouse.move(featureBox.x+featureBox.width*.7,featureBox.y+featureBox.height/2,{steps:10});
  assert.equal(await page.evaluate(()=>window.commits.length),0,'The main feature commits only on release');
  await page.mouse.up();await page.waitForFunction(()=>window.commits.length===1);
  const featureValue=Number(await feature.inputValue());assert.ok(featureValue>0&&featureValue<100);
  assert.equal((await page.evaluate(()=>window.commits[0])).separation,featureValue/100);
  await capture('exploded-stack',{audit:true});


  await mount(`window.failCommit=true;${render("onValueCommit={()=>{if(window.failCommit)throw Error('Save unavailable')}}")}`);
  await turn().press('End');
  await page.getByRole('alert').filter({hasText:'couldn’t be saved'}).waitFor();
  assert.equal(Number(await turn().inputValue()),end,'A failed commit retains the accepted view');
  await capture('commit-failed',{audit:true});
  await page.evaluate(()=>window.failCommit=false);
  await page.locator('[data-demo="assembly-reset"]').press('Enter');
  assert.equal(Number(await turn().inputValue()),start);

  await mount(render('onValueChange={next=>{next.azimuth=0}}'));
  await turn().press('End');
  assert.equal(Number(await turn().inputValue()),end,'A mutated request does not change the accepted view');
  await mount(`function Host(){const [tick,setTick]=React.useState(0);window.refresh=()=>setTick(tick+1);return <Subject.ThreeExplodedAssembly onValueCommit={next=>{next.azimuth=0}}/>}createRoot(document.getElementById('root')).render(<Host/>);`);
  await turn().press('End');await page.waitForTimeout(80);await page.evaluate(()=>window.refresh());
  assert.equal(Number(await turn().inputValue()),end,'A mutated commit does not change the retained view');
  await capture('copied-view',{audit:true});

  await mount(`window.accept=false;window.commits=[];function Host(){const [view,setView]=React.useState(${JSON.stringify(initial)});return <Subject.ThreeExplodedAssembly value={view} onValueChange={next=>{if(window.accept)setView(next)}} onValueCommit={next=>window.commits.push({...next})}/>}createRoot(document.getElementById('root')).render(<Host/>);`);
  await turn().press('End');await page.waitForTimeout(80);
  assert.equal(Number(await turn().inputValue()),start);assert.equal(await page.evaluate(()=>window.commits.length),0,'Unacknowledged controlled requests do not commit');
  await page.evaluate(()=>window.accept=true);await turn().press('End');await page.waitForFunction(()=>window.commits.length===1);
  assert.deepEqual(await page.evaluate(()=>window.commits[0]),{...initial,azimuth:end});
  await mount(render(`value={${JSON.stringify(initial)}}`));
  assert.equal(await turn().isDisabled(),true);
  await page.getByRole('status').filter({hasText:'read-only'}).waitFor();
  await capture('read-only',{audit:true});
  await mount(render('disabled'));
  assert.equal(await turn().isDisabled(),true);
  assert.equal(await page.getByRole('radio').first().isDisabled(),true);
  await capture('disabled',{audit:true});

  await mount(render('parts={[]}'));
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('input[type="range"]:enabled').count(),0);
  await capture('empty',{audit:true});
  await mount(render(`defaultValue={{...${JSON.stringify(initial)},azimuth:NaN}}`));
  await page.getByRole('alert').waitFor();
  assert.equal(await turn().isDisabled(),true);
  await capture('invalid-view',{audit:true});

  await mount(`const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:getContext.call(this,type,...args)};window.enableGraphics=()=>HTMLCanvasElement.prototype.getContext=getContext;${render('')}`);
  await page.getByRole('alert').filter({hasText:'3D isn’t available'}).waitFor();
  await turn().press('End');assert.equal(Number(await turn().inputValue()),end,'Fallback still supports the view controls');
  await capture('graphics-unavailable',{audit:true});
  await page.evaluate(()=>window.enableGraphics());
  await page.getByRole('button',{name:'Try 3D again',exact:true}).press('Enter');
  await page.locator('.ea-canvas.ea-ready canvas').waitFor();
  assert.equal(await page.locator('canvas').count(),1,'Graphics recovery keeps one owned canvas');
  assert.equal(Number(await turn().inputValue()),end);
  await capture('graphics-recovered',{audit:true});
  for (const accent of ['#171717','#777777']) {
    await mount(render(`accent="${accent}"`));
    await page.locator('.ea-canvas.ea-ready canvas').waitFor();
    const badge=page.locator('label').filter({has:page.locator('input[type="radio"]:checked')}).locator('span[aria-hidden="true"]').first();
    const balloon=page.locator('[data-demo="assembly-view"] > div[aria-hidden="true"] > span').first();
    for (const number of [badge,balloon]) {
      const colors = await contrast(number);
      assert.ok(colors.ratio>=4.5,`Selected part number contrast: ${JSON.stringify(colors)}`);
    }
    const hint = page.locator('[data-demo="assembly-view"] > p');
    await hint.filter({hasText:'Drag to turn'}).waitFor();
    const hintColors = await contrast(hint, true);
    assert.ok(hintColors.ratio >= 4.5, `Canvas instruction contrast: ${JSON.stringify(hintColors)}`);
    await capture(accent==='#171717'?'dark-accent':'mid-grey-accent',{audit:true});
  }

}
