export async function check({ page, mount, assert }) {
  const points = [
    { id: "fast", label: "/fast", x: 1, y: 100 },
    { id: "middle", label: "/middle", x: 2, y: 200 },
    { id: "slow", label: "/slow", x: 3, y: 300 },
  ];
  const datasets = [
    { key: "desktop", label: "Desktop", points },
    { key: "mobile", label: "Mobile", points: points.map((p) => ({ ...p, y: p.y * 1.2 })) },
  ];
  const presets = [{ key: "slow", label: "Slow pages", brush: { x: [0, Infinity], y: [180, Infinity] } }];
  const props = `{...{datasets:${JSON.stringify(datasets)},x:{label:'Load',unit:'s'},y:{label:'Delay',unit:'ms'},presets:[{key:'slow',label:'Slow pages',brush:{x:[0,Infinity],y:[180,Infinity]}}]}}`;
  await mount(
    `window.brushes=[];window.records=[];window.datasets=[];createRoot(document.getElementById('root')).render(<Subject.ChartScatterBrush ${props} onBrushChange={(brush,selected)=>{window.brushes.push({brush,ids:selected.map(p=>p.id)});window.records.push({brush,selected})}} onDatasetChange={v=>window.datasets.push(v)}/>);`,
  );
  const plot = page.locator('[data-demo="scatter-plot"]');
  const live = plot.locator("[aria-live]");
  await plot.press("Enter");
  await page.waitForFunction(() =>
    document.querySelector('[data-demo="scatter-plot"] [aria-live]').textContent.includes("/fast"),
  );
  await plot.press("ArrowRight");
  await page.waitForFunction(() =>
    document.querySelector('[data-demo="scatter-plot"] [aria-live]').textContent.includes("/middle"),
  );
  await plot.press("Space");
  await page.waitForFunction(() => !document.querySelector('[data-demo="scatter-plot"] [aria-live]').textContent);
  await page.getByRole("button", { name: "Slow pages", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.brushes.at(-1).ids), ["middle", "slow"]);
  assert.equal(
    await page.getByRole("button", { name: "Slow pages", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  assert.deepEqual(await page.evaluate(() => window.records.at(-1)), {
    brush: { x: [0, 3], y: [180, 400] },
    selected: [points[1], points[2]],
  });
  await plot.press("ArrowRight");
  await plot.press("Escape");
  await plot.press("Escape");
  assert.deepEqual(await page.evaluate(() => window.brushes.at(-1)), { brush: null, ids: [] });
  await page.locator('[data-demo="dataset-desktop"]').press("ArrowRight");
  assert.deepEqual(await page.evaluate(() => window.datasets), ["mobile"]);
  await page.getByRole("button", { name: "Slow pages", exact: true }).press("Space");
  assert.deepEqual(await page.evaluate(() => window.brushes.at(-1).ids), ["middle", "slow"]);
  const clear = page.locator('[data-demo="scatter-clear"]');
  await clear.press("Enter");
  await clear.waitFor({ state: "hidden" });
  const rectangle = await plot.boundingBox();
  assert.ok(rectangle);
  await page.mouse.move(rectangle.x + rectangle.width * 0.2, rectangle.y + rectangle.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(rectangle.x + rectangle.width * 0.8, rectangle.y + rectangle.height * 0.8, { steps: 15 });
  await page.mouse.up();
  assert.equal(
    await page.evaluate(() => {
      const brush = window.brushes.at(-1).brush;
      return brush && [...brush.x, ...brush.y].every(Number.isFinite);
    }),
    true,
  );
  assert.deepEqual(await page.evaluate(() => window.brushes.at(-1).ids), ["fast", "middle"]);
  await clear.waitFor();
  const beforeMove = await page.evaluate(() => window.brushes.at(-1).brush);
  const moved = await plot.boundingBox();
  await page.mouse.move(moved.x + moved.width * 0.5, moved.y + moved.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(moved.x + moved.width * 0.4, moved.y + moved.height * 0.6, { steps: 12 });
  await page.mouse.up();
  const afterMove = await page.evaluate(() => window.brushes.at(-1).brush);
  for (const axis of ["x", "y"])
    assert.ok(
      Math.abs(afterMove[axis][1] - afterMove[axis][0] - (beforeMove[axis][1] - beforeMove[axis][0])) < 1e-9,
      "Moving preserves the brush extent",
    );
  assert.ok(afterMove.x[0] < beforeMove.x[0] || afterMove.y[0] < beforeMove.y[0]);
  const beforeCancel = await page.evaluate(() => window.brushes.length);
  await page.mouse.move(moved.x + moved.width * 0.95, moved.y + moved.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(moved.x + moved.width * 0.6, moved.y + moved.height * 0.6, { steps: 10 });
  await plot.press("Escape");
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.brushes.length), beforeCancel, "Cancelled drawing cannot emit a brush");
  await page.locator('[data-demo="scatter-clear"]').press("Enter");
  assert.deepEqual(await page.evaluate(() => window.brushes.at(-1)), { brush: null, ids: [] });
  await mount(
    `window.retried=0;const root=createRoot(document.getElementById('root'));window.renderStatus=status=>root.render(<Subject.ChartScatterBrush ${props} status={status} onRetry={()=>{window.retried++;window.renderStatus('ready')}}/>);window.renderStatus('unavailable');`,
  );
  await page.getByRole("button", { name: "Retry", exact: true }).press("Enter");
  await plot.waitFor();
  assert.equal(await page.evaluate(() => window.retried), 1);
  await page.locator('[data-demo="dataset-desktop"]').press("End");
  await page.getByRole("button", { name: "Slow pages", exact: true }).press("Enter");
  await page.evaluate(() => window.renderStatus("unavailable"));
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-demo="dataset-mobile"]')?.getAttribute("aria-checked") === "true",
  );
  assert.equal(
    await page.getByRole("button", { name: "Slow pages", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  for (const values of ["[]", "[{key:'bad',label:'Bad',points:[{id:'bad',label:'Invalid point',x:NaN,y:Infinity}]}]"]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.ChartScatterBrush datasets={${values}}/>);`,
    );
    assert.equal(await plot.count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  }

  for (const extra of [
    "x={{label:'Bad',unit:'s',limit:Infinity}}",
    "y={{label:'Bad',unit:'ms',decimals:NaN}}",
    'locale="invalid_locale"',
    'dataset="missing"',
    "defaultBrush={{x:[NaN,Infinity],y:[0,Infinity]}}",
    "presets={[{key:'bad',label:'Bad',brush:{x:[0,NaN],y:[0,Infinity]}}]}",
    "datasets={[{key:'x',label:'First',points:[]},{key:'x',label:'Duplicate',points:[]}]}",
  ]) {
    await mount(`createRoot(document.getElementById('root')).render(<Subject.ChartScatterBrush ${props} ${extra}/>);`);
    await page.getByRole("alert").waitFor();
    assert.equal(await plot.count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  }
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartScatterBrush datasets={[{key:'all',label:'All',points:[{id:'zero',label:'/zero',x:0,y:0}]}]} x={{label:'Load',unit:'s'}} y={{label:'Delay',unit:'ms'}} presets={[]}/>);`,
  );
  await plot.waitFor();
  assert.doesNotMatch(
    await page.locator("svg").evaluateAll((nodes) => nodes.map((node) => node.outerHTML).join("")),
    /NaN|Infinity/,
  );
  await plot.press("Enter");
  await page.waitForFunction(() =>
    document.querySelector('[data-demo="scatter-plot"] [aria-live]').textContent.includes("/zero"),
  );
  await mount(
    `window.changed=[];const root=createRoot(document.getElementById('root'));window.setDataset=dataset=>root.render(<Subject.ChartScatterBrush ${props} datasets={[${JSON.stringify(datasets[0])},{key:'empty',label:'Empty',points:[]}]} dataset={dataset} onDatasetChange={key=>window.changed.push(key)}/>);window.setDataset('empty');`,
  );
  await page.locator('[data-demo="dataset-empty"]').press("Home");
  assert.deepEqual(await page.evaluate(() => window.changed), ["desktop"]);
  assert.equal(await plot.count(), 0);
  await page.evaluate(() => window.setDataset("desktop"));
  await plot.waitFor();
  await mount(
    `window.records=[];const root=createRoot(document.getElementById('root'));window.setBrush=brush=>root.render(<Subject.ChartScatterBrush ${props} brush={brush} onBrushChange={(brush,selected)=>window.records.push({brush,selected})}/>);window.setBrush({x:[3,0],y:[400,180]});`,
  );
  assert.equal(
    await page.getByRole("button", { name: "Slow pages", exact: true }).getAttribute("aria-pressed"),
    "true",
    "Reversed controlled bounds normalize",
  );
  await page.locator('[data-demo="scatter-clear"]').press("Enter");
  assert.deepEqual(await page.evaluate(() => window.records.at(-1)), { brush: null, selected: [] });
  assert.equal(
    await page.getByRole("button", { name: "Slow pages", exact: true }).getAttribute("aria-pressed"),
    "true",
    "Controlled brushes await their host",
  );
  await page.evaluate(() => window.setBrush(null));
  await page.locator('[data-demo="scatter-clear"]').waitFor({ state: "hidden" });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartScatterBrush ${props} datasets={[{key:'large',label:'Large',points:[{id:'a',label:'/a',x:1e308,y:1e308},{id:'b',label:'/b',x:1.7e308,y:1.7e308}]}]}/>);`,
  );
  await plot.waitFor();
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  assert.doesNotMatch(
    await page.locator("svg").evaluateAll((nodes) => nodes.map((node) => node.outerHTML).join("")),
    /NaN|Infinity/,
  );
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
}
