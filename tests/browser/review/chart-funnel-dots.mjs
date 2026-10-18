export async function check({ page, mount, assert }) {
  const stages = [
    { id: "visit", label: "Visit" },
    { id: "trial", label: "Trial" },
    { id: "paid", label: "Paid" },
  ];
  const segments = [
    { key: "all", label: "All", counts: [100, 40, 10] },
    { key: "ads", label: "Ads", counts: [20, 8, 2] },
  ];
  const props = `{...${JSON.stringify({ stages, segments, defaultSelected: null })}}`;
  await mount(
    `window.picks=[];window.segments=[];createRoot(document.getElementById('root')).render(<Subject.ChartFunnelDots ${props} onSelect={id=>window.picks.push(id)} onSegmentChange={key=>window.segments.push(key)}/>);`,
  );
  await page.locator('[data-demo="stage-trial"]').press("Enter");
  assert.equal(await page.locator('[data-demo="stage-trial"]').getAttribute("aria-checked"), "true");
  await page.locator('[data-demo="stage-trial"]').press("End");
  assert.equal(await page.locator('[data-demo="stage-paid"]').getAttribute("aria-checked"), "true");
  await page.locator('[data-demo="stage-paid"]').press("Space");
  assert.deepEqual(await page.evaluate(() => window.picks), ["trial", "paid", null]);
  await page.locator('[data-demo="stage-paid"]').press("ArrowUp");
  assert.equal(
    await page.locator('[data-demo="stage-trial"]').getAttribute("aria-checked"),
    "true",
    "Arrows start at the focused row after clearing it",
  );
  await page.locator('[data-demo="stage-trial"]').press("Home");
  await page.locator('[data-demo="stage-visit"]').press("ArrowDown");
  assert.equal(await page.locator('[data-demo="stage-trial"]').getAttribute("aria-checked"), "true");
  await page.locator('[data-demo="segment-all"]').press("ArrowRight");
  assert.deepEqual(await page.evaluate(() => window.segments), ["ads"]);
  assert.match(await page.locator('[data-demo="stage-trial"]').getAttribute("aria-label"), /8 people, 40%/);
  await mount(
    `window.retried=0;const root=createRoot(document.getElementById('root'));window.renderStatus=status=>root.render(<Subject.ChartFunnelDots ${props} status={status} onRetry={()=>{window.retried++;window.renderStatus('ready')}}/>);window.renderStatus('unavailable');`,
  );
  await page.getByRole("button", { name: "Retry", exact: true }).press("Enter");
  await page.locator('[data-demo="stage-paid"]').waitFor();
  assert.equal(await page.evaluate(() => window.retried), 1);
  await page.locator('[data-demo="stage-trial"]').click();
  await page.locator('[data-demo="segment-ads"]').click();
  await page.evaluate(() => window.renderStatus("unavailable"));
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-demo="stage-trial"]')?.getAttribute("aria-checked") === "true",
  );
  assert.equal(await page.locator('[data-demo="segment-ads"]').getAttribute("aria-checked"), "true");
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.locator("#root").evaluate((node) => (node.style.maxWidth = "1100px"));
  await page.waitForFunction(() =>
    getComputedStyle(document.querySelector('[data-demo="stage-trial"]')).gridTemplateColumns.startsWith("260px "),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () =>
      !getComputedStyle(document.querySelector('[data-demo="stage-trial"]')).gridTemplateColumns.startsWith("260px "),
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartFunnelDots ${props} segments={[{key:'all',label:'All',counts:[125,50,5]}]}/>);`,
  );
  await page.getByText("1 dot = 1.25 people", { exact: true }).waitFor();
  for (const values of ["[]", "[{key:'bad',label:'Empty',counts:[0,0,0]}]"]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.ChartFunnelDots stages={${JSON.stringify(stages)}} segments={${values}}/>);`,
    );
    assert.equal(await page.locator('[data-demo^="stage-"]').count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  }
  for (const extra of [
    "segments={[{key:'bad',label:'Invalid',counts:[NaN,Infinity,-1]}]}",
    "segments={[{key:'bad',label:'Increasing',counts:[100,120,10]}]}",
    "segments={[{key:'bad',label:'Missing counts',counts:[100]}]}",
    "segments={[{key:'x',label:'First',counts:[100,40,10]},{key:'x',label:'Duplicate',counts:[20,8,2]}]}",
    "stages={[{id:'x',label:'First'},{id:'x',label:'Duplicate'}]}",
    "maxDots={NaN}",
    "maxDots={Infinity}",
    "maxDots={0}",
    "maxDots={1001}",
    'locale="invalid_locale"',
    'segment="missing"',
  ]) {
    await mount(`createRoot(document.getElementById('root')).render(<Subject.ChartFunnelDots ${props} ${extra}/>);`);
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator('[data-demo^="stage-"]').count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  }
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartFunnelDots stages={${JSON.stringify(stages)}} segments={[{key:'huge',label:'Large',counts:[1.7e308,8e307,1]}]} maxDots={1}/>);`,
  );
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  assert.ok((await page.locator('[data-demo="stage-visit"] svg circle').count()) <= 1);
  assert.ok(
    (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1,
    "Large finite figures fit",
  );
  const svg = await page.locator("svg").evaluateAll((nodes) => nodes.map((node) => node.outerHTML).join(""));
  assert.doesNotMatch(svg, /NaN|Infinity/);
  await mount(
    `window.choices=[];const root=createRoot(document.getElementById('root'));window.chooseSegment=value=>root.render(<Subject.ChartFunnelDots ${props} segment={value} selected="trial" onSegmentChange={key=>window.choices.push(key)}/>);window.chooseSegment('all');`,
  );
  await page.locator('[data-demo="segment-all"]').press("ArrowRight");
  assert.deepEqual(await page.evaluate(() => window.choices), ["ads"]);
  assert.equal(await page.locator('[data-demo="segment-all"]').getAttribute("aria-checked"), "true");
  await page.evaluate(() => window.chooseSegment("ads"));
  await page.waitForFunction(
    () => document.querySelector('[data-demo="segment-ads"]').getAttribute("aria-checked") === "true",
  );
  assert.equal(await page.locator('[data-demo="stage-trial"]').getAttribute("aria-checked"), "true");
}
