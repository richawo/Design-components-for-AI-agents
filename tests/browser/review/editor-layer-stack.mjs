// Exercise optimistic stack proposals, rollback bounds and keyboard/drag edits.
export async function check({ page, mount, assert, capture = async () => {} }) {
  await page.setViewportSize({ width: 1440, height: 1200 });
  const layers = [
    {
      id: "title",
      name: "Title",
      kind: "text",
      visible: true,
      locked: false,
      opacity: 100,
      render: "Title art",
      bounds: [0.1, 0.1, 0.8, 0.2],
    },
    {
      id: "photo",
      name: "Photo",
      kind: "image",
      visible: true,
      locked: false,
      opacity: 100,
      render: "Photo art",
    },
    {
      id: "base",
      name: "Background",
      kind: "shape",
      visible: true,
      locked: true,
      opacity: 100,
      render: "Background art",
    },
  ];
  const fixture = `window.stacks=[];window.selected=[];window.fail=true;window.originalLayers=[{"id":"title","name":"Title","kind":"text","visible":true,"locked":false,"opacity":100,"render":"Title art","bounds":[0.1,0.1,0.8,0.2]},{"id":"photo","name":"Photo","kind":"image","visible":true,"locked":false,"opacity":100,"render":"Photo art"},{"id":"base","name":"Background","kind":"shape","visible":true,"locked":true,"opacity":100,"render":"Background art"}];createRoot(document.getElementById('root')).render(<Subject.EditorLayerStack defaultValue={window.originalLayers} onSelectedIdChange={id=>window.selected.push(id)} onValueChange={async next=>{window.stacks.push(structuredClone(next));next[0].name='Host mutation';if(next[0].bounds)next[0].bounds[0]=.9;if(window.fail)throw Error('The layer service is offline.');await new Promise(resolve=>window.finishLayers=resolve)}}/>);`;
  const row = (id) => page.locator('[data-demo="layer-' + id + '"]');
  await mount(fixture);
  await row("title").press("Enter");
  const selectionFrame = () =>
    page
      .locator('div[aria-hidden="true"]')
      .filter({ has: page.getByText("Title", { exact: true }) })
      .last();
  const originalSelection = await selectionFrame().boundingBox();
  assert.ok(originalSelection);

  await page
    .getByRole("button", { name: "Hide Title", exact: true })
    .press("Enter");
  await page
    .getByRole("status")
    .filter({ hasText: "The layer service is offline." })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Hide Title", exact: true }).count(),
    1,
    "A rejected visibility edit rolls back",
  );
  assert.equal((await page.evaluate(() => window.stacks[0]))[0].visible, false);
  assert.deepEqual(
    await page.evaluate(() => window.originalLayers[0].bounds),
    [0.1, 0.1, 0.8, 0.2],
    "Host mutation cannot alter incoming bounds or the rollback snapshot",
  );
  await capture("visibility-failed", { audit: true });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const restoredSelection = await selectionFrame().boundingBox();
  assert.ok(
    restoredSelection &&
      Math.abs(restoredSelection.x - originalSelection.x) < 1,
    "A rejected proposal cannot move the restored layer’s visible bounds",
  );

  await page.evaluate(() => (window.fail = false));
  await page
    .getByRole("button", { name: "Hide Title", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Show Title", exact: true }).waitFor();
  assert.deepEqual(
    await page.evaluate(() => window.stacks[1]),
    await page.evaluate(() => window.stacks[0]),
  );
  await page.evaluate(() => window.finishLayers());
  await capture("visibility-accepted", { audit: true });
  await row("photo").press("Enter");
  assert.equal(await page.evaluate(() => window.selected.at(-1)), "photo");
  assert.equal(await page.getByRole("button", { name: "Rename Title", exact: true }).count(), 0, "Previous-layer controls retire with selection");
  const beforeRename = await page.evaluate(() => window.stacks.length);
  await row("photo").press("F2");
  const rename = page.getByRole("textbox", {
    name: "Rename Photo",
    exact: true,
  });
  await rename.waitFor();
  await rename.fill("  Cover photo  ");
  await rename.press("Escape");
  await row("photo").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Rename Photo", exact: true })
      .count(),
    1,
  );
  const afterCancel = await page.evaluate(() => window.stacks.length);
  assert.equal(
    afterCancel,
    beforeRename,
    "Cancelling rename never writes a stack",
  );
  await row("photo").press("F2");
  await page
    .getByRole("textbox", { name: "Rename Photo", exact: true })
    .fill("Cover photo");
  await page
    .getByRole("textbox", { name: "Rename Photo", exact: true })
    .press("Enter");
  assert.equal(
    await page.evaluate(() => window.stacks.length),
    afterCancel + 1,
  );
  assert.equal(
    (await page.evaluate(() => window.stacks.at(-1)))[1].name,
    "Cover photo",
  );
  await page.evaluate(() => window.finishLayers());
  await mount(
    `window.stacks=[];createRoot(document.getElementById('root')).render(<Subject.EditorLayerStack defaultValue={${JSON.stringify(layers)}} onValueChange={next=>window.stacks.push(structuredClone(next))}/>);`,
  );
  await row("title").press("Enter");
  await row("title").press("Alt+ArrowDown");
  assert.deepEqual(
    (await page.evaluate(() => window.stacks.at(-1))).map((layer) => layer.id),
    ["photo", "title", "base"],
  );
  const count = await page.evaluate(() => window.stacks.length);
  await row("title").press("Alt+ArrowDown");
  assert.equal(
    await page.evaluate(() => window.stacks.length),
    count,
    "A reorder cannot displace the locked background",
  );
  await mount(
    `window.stacks=[];createRoot(document.getElementById('root')).render(<Subject.EditorLayerStack defaultValue={${JSON.stringify(layers)}} onValueChange={next=>window.stacks.push(structuredClone(next))}/>);`,
  );
  const grip = page.locator('[data-demo="layer-grip-photo"]');
  await grip.scrollIntoViewIfNeeded();
  const a = await row("title").boundingBox(),
    b = await grip.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, a.y - 4, { steps: 12 });
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => window.stacks.length),
    0,
    "Reordering reports after release",
  );
  await page.mouse.up();
  await page.waitForFunction(() => window.stacks.length === 1);
  assert.deepEqual(
    (await page.evaluate(() => window.stacks[0])).map((layer) => layer.id),
    ["photo", "title", "base"],
  );
  await capture("dragged-stack", { audit: true });
  await mount(
    `window.stacks=[];createRoot(document.getElementById('root')).render(<Subject.EditorLayerStack defaultValue={${JSON.stringify(layers)}} disabled onValueChange={next=>window.stacks.push(next)}/>);`,
  );
  await row("photo").press("Enter");
  assert.equal(
    await page
      .getByRole("button", { name: "Hide Photo", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("slider", { name: "Opacity", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(await page.evaluate(() => window.stacks.length), 0);
  await capture("read-only", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorLayerStack defaultValue={[]}/>);`,
  );
  assert.equal(await page.locator('[data-demo^="layer-grip-"]').count(), 0);
  assert.match(
    await page.locator("section").innerText(),
    /No layers|Add.*layer/i,
  );
  await capture("empty", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorLayerStack defaultValue={[${JSON.stringify(layers[0])},${JSON.stringify(layers[0])}]}/>);`,
  );
  assert.match(
    await page.locator("section").innerText(),
    /Two layers share the id/,
  );
  assert.equal(await page.locator('[data-demo^="layer-grip-"]').count(), 0);
  await capture("duplicate", { audit: true });
  await mount(`window.viewStackWrites=0;createRoot(document.getElementById('root')).render(<Subject.default defaultExploded={false} onValueChange={()=>window.viewStackWrites++}/>);`);
  const artboard = page.locator('[data-demo="artboard"]');
  const explode = page.locator('[data-demo="explode"]');
  const flatTransform = await artboard.evaluate(el => getComputedStyle(el).transform);
  assert.equal(await explode.getAttribute('aria-pressed'), 'false');
  await explode.press('Space');
  await page.waitForFunction(() => document.querySelector('[data-demo="explode"]').getAttribute('aria-pressed') === 'true');
  await page.waitForFunction(flat => getComputedStyle(document.querySelector('[data-demo="artboard"]')).transform !== flat, flatTransform);
  const contrast = await page.getByText("Top of stack nearest you", { exact: true }).evaluate(node => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    const rgb = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
    const text = getComputedStyle(node), foreground = rgb(text.color), background = rgb(getComputedStyle(node.parentElement).backgroundColor);
    const alpha = foreground[3] / 255 * Number(text.opacity);
    const ink = foreground.slice(0, 3).map((value, i) => value * alpha + background[i] * (1 - alpha));
    const luminance = color => color.slice(0, 3).map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const a = luminance(ink), b = luminance(background);
    return { ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), foreground, background, opacity: text.opacity };
  });
  console.log('Exploded caption contrast:', JSON.stringify(contrast));
  assert.ok(contrast.ratio >= 4.5, 'Exploded view caption meets 4.5:1 over the dotted stage');
  await capture('exploded-artwork', { audit: true });
  await explode.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-demo="explode"]').getAttribute('aria-pressed') === 'false');
  await page.waitForFunction(flat => getComputedStyle(document.querySelector('[data-demo="artboard"]')).transform === flat, flatTransform);
  assert.equal(await page.evaluate(() => window.viewStackWrites), 0, 'Changing the artwork view does not write layers');
  await capture('collapsed-artwork', { audit: true });

  await mount(`window.pendingLayers=[];createRoot(document.getElementById('root')).render(<Subject.EditorLayerStack defaultValue={${JSON.stringify(layers)}} onValueChange={next=>new Promise((resolve,reject)=>window.pendingLayers.push({payload:structuredClone(next),resolve,reject}))}/>);`);
  await page.getByRole('button',{name:'Hide Title',exact:true}).press('Enter');
  await page.waitForFunction(()=>window.pendingLayers.length===1);
  assert.equal(await page.getByRole('button',{name:'Hide Photo',exact:true}).isDisabled(),true,'Dependent stack writes wait for acknowledgement');
  assert.equal(await page.locator('[data-demo="backward"]').isDisabled(),true,'Pending inspector edits are visibly unavailable');
  await page.getByRole('button',{name:'Hide Photo',exact:true}).evaluate(node=>node.click());
  assert.equal(await page.evaluate(()=>window.pendingLayers.length),1);
  await page.getByRole('status').filter({hasText:'Saving layer changes...'}).waitFor();
  await capture('pending-write',{audit:true});
  await page.evaluate(()=>window.pendingLayers[0].reject(Error('The store is unavailable.')));
  await page.getByRole('status').filter({hasText:'The store is unavailable.'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Hide Title',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Hide Photo',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Hide Title',exact:true}).evaluate(node=>node===document.activeElement),true,'A rejected save returns keyboard focus to its action');
  await page.getByRole('button',{name:'Hide Title',exact:true}).press('Enter');
  assert.deepEqual(await page.evaluate(()=>window.pendingLayers[1].payload),await page.evaluate(()=>window.pendingLayers[0].payload));
  await row('photo').press('Enter');
  await page.evaluate(()=>window.pendingLayers[1].resolve());
  await page.waitForFunction(()=>!document.querySelector('[data-demo="layer-visible-photo"]').disabled);
  assert.equal(await row('photo').evaluate(node=>node===document.activeElement),true,'Acknowledgement does not steal focus after inspecting another layer');
  await page.getByRole('button',{name:'Hide Photo',exact:true}).press('Enter');
  await page.waitForFunction(()=>window.pendingLayers.length===3);
  await page.evaluate(()=>window.pendingLayers[2].reject(Error('The photo edit was refused.')));
  await page.getByRole('status').filter({hasText:'The photo edit was refused.'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Show Title',exact:true}).count(),1,'A later rejection retains the earlier accepted edit');
  assert.equal(await page.getByRole('button',{name:'Hide Photo',exact:true}).count(),1);
  await capture('accepted-then-rejected',{audit:true});
  await mount(`window.inspected=[];createRoot(document.getElementById('root')).render(<Subject.EditorLayerStack value={${JSON.stringify(layers)}} onSelectedIdChange={id=>window.inspected.push(id)}/>);`);
  await row('photo').press('Enter');
  assert.equal(await page.evaluate(()=>window.inspected.at(-1)),'photo');
  assert.equal(await page.getByRole('button',{name:'Hide Photo',exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('slider',{name:'Opacity',exact:true}).isDisabled(),true);
  assert.equal(await page.locator('[data-demo="forward"]').isDisabled(),true,'Controlled read-only inspectors cannot reorder');
  await page.getByRole('status').filter({hasText:'read-only'}).waitFor();
  await capture('controlled-read-only',{audit:true});

}
