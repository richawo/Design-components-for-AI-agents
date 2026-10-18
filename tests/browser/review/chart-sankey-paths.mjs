export async function check({ page, mount, assert }) {
  const nodes = [
    { id: "search", label: "Search", column: 0 },
    { id: "direct", label: "Direct", column: 0 },
    { id: "trial", label: "Trial", column: 1 },
    { id: "paid", label: "Paid", column: 2 },
  ];
  const links = [
    { id: "search-trial", source: "search", target: "trial", value: 80 },
    { id: "direct-trial", source: "direct", target: "trial", value: 20 },
    { id: "trial-paid", source: "trial", target: "paid", value: 30 },
  ];
  const periods = [
    { key: "previous", label: "Previous", links: links.map((l) => ({ ...l, value: l.value / 2 })) },
    { key: "current", label: "Current", links },
  ];
  const props = `{...${JSON.stringify({ nodes, periods })}}`;
  await mount(
    `window.picks=[];window.periods=[];createRoot(document.getElementById('root')).render(<Subject.ChartSankeyPaths ${props} onSelectionChange={v=>window.picks.push(v)} onPeriodChange={v=>window.periods.push(v)}/>);`,
  );
  const search = page.locator('[data-demo="node-search"]');
  await search.press("Enter");
  assert.equal(await search.getAttribute("aria-pressed"), "true");
  assert.deepEqual(await page.evaluate(() => window.picks.at(-1)), { nodeId: "search", linkId: null });
  await search.press("Escape");
  assert.deepEqual(await page.evaluate(() => window.picks.at(-1)), { nodeId: null, linkId: null });
  const flow = page.locator('[data-demo="flow-search-trial"]');
  assert.equal(await flow.getAttribute("role"), "button");
  assert.equal(await flow.getAttribute("tabindex"), "0");
  await flow.press("Enter");
  assert.equal(await flow.getAttribute("aria-pressed"), "true");
  assert.deepEqual(await page.evaluate(() => window.picks.at(-1)), { nodeId: null, linkId: "search-trial" });
  await page.locator('[data-demo="sankey-clear"]').press("Space");
  assert.deepEqual(await page.evaluate(() => window.picks.at(-1)), { nodeId: null, linkId: null });
  await page.locator('[data-demo="period-current"]').press("Home");
  assert.deepEqual(await page.evaluate(() => window.periods), ["previous"]);
  assert.match(await search.getAttribute("aria-label"), /40 signups/);
  await mount(
    `window.retried=0;const root=createRoot(document.getElementById('root'));window.renderStatus=status=>root.render(<Subject.ChartSankeyPaths ${props} status={status} onRetry={()=>{window.retried++;window.renderStatus('ready')}}/>);window.renderStatus('unavailable');`,
  );
  await page.getByRole("button", { name: "Retry", exact: true }).press("Enter");
  await search.waitFor();
  assert.equal(await page.evaluate(() => window.retried), 1);
  await page.locator('[data-demo="period-current"]').press("Home");
  await search.click();
  await page.evaluate(() => window.renderStatus("unavailable"));
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('[data-demo="node-search"]')?.getAttribute("aria-pressed") === "true",
  );
  assert.equal(await page.locator('[data-demo="period-previous"]').getAttribute("aria-checked"), "true");
  assert.match(await search.getAttribute("aria-label"), /40 signups/);
  await page.setViewportSize({ width: 1200, height: 1600 });
  await page.locator("#root").evaluate((node) => (node.style.maxWidth = "1200px"));
  await page.waitForFunction(() => document.querySelector('[data-demo="node-search"]').classList.contains("absolute"));
  await page.setViewportSize({ width: 390, height: 1600 });
  await page.waitForFunction(() => document.querySelector('[data-demo="node-search"]').classList.contains("relative"));
  for (const values of [
    "[]",
    "[{id:'broken',source:'absent',target:'trial',value:5}]",
    "[{id:'bad',source:'search',target:'trial',value:NaN}]",
  ]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.ChartSankeyPaths nodes={${JSON.stringify(nodes)}} links={${values}}/>);`,
    );
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
    assert.equal(await page.locator('[data-demo^="flow-"]').count(), 0);
    await page.getByRole(values === "[]" ? "status" : "alert").waitFor();
  }

  for (const extra of [
    "nodes={[{id:'a',label:'Invalid',column:Infinity}]}",
    "nodes={[{id:'a',label:'First',column:0},{id:'a',label:'Duplicate',column:1}]}",
    "nodes={[{id:'a',label:'First',column:0},{id:'b',label:'Skipped',column:2}]}",
    "periods={[{key:'x',label:'Previous',links:[]},{key:'x',label:'Duplicate',links:[]}]}",
    'period="absent"',
    'locale="invalid_locale"',
  ]) {
    await mount(`createRoot(document.getElementById('root')).render(<Subject.ChartSankeyPaths ${props} ${extra}/>);`);
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator('[data-demo^="flow-"]').count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  }
  await mount(
    `window.periods=[];const root=createRoot(document.getElementById('root'));window.renderPeriod=key=>root.render(<Subject.ChartSankeyPaths nodes={${JSON.stringify(nodes)}} periods={[{key:'empty',label:'Empty',links:[]},{key:'populated',label:'Populated',links:${JSON.stringify(links)}}]} period={key} onPeriodChange={v=>window.periods.push(v)}/>);window.renderPeriod('empty');`,
  );
  await page.getByText("No flows yet", { exact: true }).waitFor();
  await page.locator('[data-demo="period-empty"]').press("End");
  assert.deepEqual(await page.evaluate(() => window.periods), ["populated"]);
  assert.equal(await page.locator('[data-demo^="flow-"]').count(), 0, "Controlled periods await acknowledgement");
  await page.evaluate(() => window.renderPeriod("populated"));
  await flow.waitFor();
  await page.locator('[data-demo="period-populated"]').press("Home");
  assert.deepEqual(await page.evaluate(() => window.periods), ["populated", "empty"]);
  await mount(
    `window.picks=[];const root=createRoot(document.getElementById('root'));window.select=value=>root.render(<Subject.ChartSankeyPaths ${props} selection={value} onSelectionChange={s=>window.picks.push(s)}/>);window.select({nodeId:'search',linkId:null});`,
  );
  await flow.press("Space");
  assert.deepEqual(await page.evaluate(() => window.picks.at(-1)), { nodeId: null, linkId: "search-trial" });
  assert.equal(await search.getAttribute("aria-pressed"), "true");
  assert.equal(await flow.getAttribute("aria-pressed"), "false");
  await page.evaluate(() => window.select({ nodeId: null, linkId: "search-trial" }));
  await page.waitForFunction(
    () => document.querySelector('[data-demo="flow-search-trial"]').getAttribute("aria-pressed") === "true",
  );
  await flow.press("Escape");
  assert.deepEqual(await page.evaluate(() => window.picks.at(-1)), { nodeId: null, linkId: null });
  await page.evaluate(() => window.select({ nodeId: "absent", linkId: null }));
  await page.waitForFunction(() => !document.querySelector('[aria-pressed="true"]'));
  await page.locator('[data-demo="sankey-clear"]').waitFor({ state: "hidden" });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartSankeyPaths nodes={[{id:'a',label:'Start',column:0},{id:'b',label:'Finish',column:1}]} links={[{id:'ab',source:'a',target:'b',value:.25}]}/>);`,
  );
  assert.match(await page.locator('[data-demo="node-a"]').getAttribute("aria-label"), /0.25 signups, 100%/);
  await page.locator('[data-demo="flow-ab"]').press("Enter");
  await page.locator("header").getByText("0.25", { exact: true }).first().waitFor();
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartSankeyPaths nodes={${JSON.stringify(nodes)}} links={[{id:'st',source:'search',target:'trial',value:1e308},{id:'dt',source:'direct',target:'trial',value:1e308}]}/>);`,
  );
  await page.getByRole("alert").getByText("Totals are too large", { exact: true }).waitFor();
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartSankeyPaths nodes={[{id:'a',label:'Start',column:0},{id:'b',label:'Finish',column:1}]} links={[{id:'ab',source:'a',target:'b',value:1e308}]}/>);`,
  );
  await page.locator('[data-demo="flow-ab"]').waitFor();
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  assert.doesNotMatch(
    await page.locator("svg").evaluateAll((nodes) => nodes.map((node) => node.outerHTML).join("")),
    /NaN|Infinity/,
  );
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ChartSankeyPaths/>);`);
  const firstFlow = page.locator('[data-demo^="flow-"]').first();
  await firstFlow.press("Enter");
  const tooltip = page.getByRole("tooltip");
  await tooltip.waitFor();
  await page.waitForTimeout(250);
  const tipBox = await tooltip.boundingBox(),
    plotBox = await page.getByRole("group", { name: "Flows", exact: true }).boundingBox();
  assert.ok(
    tipBox.x >= plotBox.x - 1 && tipBox.x + tipBox.width <= plotBox.x + plotBox.width + 1,
    "Flow tooltip fits the plot width",
  );
  assert.ok(
    tipBox.y >= plotBox.y - 1 && tipBox.y + tipBox.height <= plotBox.y + plotBox.height + 1,
    "Flow tooltip stays inside the plot, clear of header controls",
  );
  assert.equal(await firstFlow.getAttribute("aria-describedby"), await tooltip.getAttribute("id"));
}
