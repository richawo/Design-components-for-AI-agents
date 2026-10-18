export async function check({ page, mount, assert }) {
  const fields = [
    { id: "owner", label: "Owner", kind: "dimension" },
    { id: "stage", label: "Stage", kind: "dimension" },
    { id: "mrr", label: "MRR", kind: "measure", format: "currency" },
  ];
  const records = [
    { id: "a", label: "Acme", values: { owner: "Mara", stage: "Won", mrr: 100 } },
    { id: "b", label: "Beacon", values: { owner: "Mara", stage: "Open", mrr: 40 } },
    { id: "c", label: "Cedar", values: { owner: "Noor", stage: "Won", mrr: 70 } },
  ];
  const config = { rows: "owner", columns: "stage", measure: "sum", value: "mrr" };
  const props = `{...{fields:${JSON.stringify(fields)},records:${JSON.stringify(records)},defaultValue:${JSON.stringify(config)},currency:"GBP"}}`;
  await mount(
    `window.configs=[];window.cells=[];createRoot(document.getElementById('root')).render(<Subject.DataPivotConfigurator ${props} onChange={c=>window.configs.push(c)} onCellSelect={c=>window.cells.push(c)}/>);`,
  );
  const won = page.getByRole("button", { name: /^Mara, Won:/ });
  await won.press("Enter");
  assert.deepEqual(
    await page.evaluate(() => {
      const c = window.cells.at(-1);
      return { ...c, records: c.records.map((r) => r.id) };
    }),
    { row: "Mara", column: "Won", records: ["a"], value: 100 },
  );
  await page.getByRole("button", { name: "Close", exact: true }).press("Enter");
  assert.equal(
    await page.getByRole("button", { name: "Close", exact: true }).count(),
    0,
    "Retired inspector controls leave immediately",
  );
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "cell-0-1");
  await page.locator('[data-demo="swap"]').press("Space");
  assert.deepEqual(await page.evaluate(() => window.configs.at(-1)), { ...config, rows: "stage", columns: "owner" });
  assert.equal(await page.evaluate(() => window.cells.at(-1)), null);
  await page.locator('[data-demo="columns-none"]').press("Enter");
  assert.equal(await page.locator('[data-demo="swap"]').isDisabled(), true);
  assert.equal(await page.evaluate(() => window.configs.at(-1).columns), null);
  await page.locator('[data-demo="measure-sum"]').press("Home");
  assert.equal(await page.locator('[data-demo="measure-count"]').getAttribute("aria-checked"), "true");
  assert.equal(await page.locator('[data-demo="value-mrr"]').isDisabled(), true);
  await mount(
    `window.configs=[];createRoot(document.getElementById('root')).render(<Subject.DataPivotConfigurator ${props} disabled onChange={c=>window.configs.push(c)}/>);`,
  );
  assert.equal(await page.locator('[data-demo="swap"]').isDisabled(), true);
  await page.locator('[data-demo="rows-owner"]').press("ArrowRight");
  assert.deepEqual(await page.evaluate(() => window.configs), []);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.DataPivotConfigurator fields={[]} records={[]}/>);`,
  );
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);

  // Host changes invalidate the old drill-down before it can describe another configuration.
  await mount(
    `window.cells=[];function Host(){const [config,setConfig]=useState(${JSON.stringify(config)});window.swap=()=>setConfig(c=>({...c,rows:'stage',columns:'owner'}));return <Subject.DataPivotConfigurator fields={${JSON.stringify(fields)}} records={${JSON.stringify(records)}} value={config} onCellSelect={c=>window.cells.push(c)}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.getByRole("button", { name: /^Mara, Won:/ }).press("Enter");
  await page.evaluate(() => window.swap());
  await page.waitForFunction(() => window.cells.at(-1) === null);
  assert.equal(await page.getByRole("button", { name: "Close", exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.cells.length), 2);
  await mount(
    `window.cells=[];function Host(){const [config,setConfig]=useState(${JSON.stringify(config)});window.breakConfig=()=>setConfig(c=>({...c,rows:'missing'}));window.fixConfig=()=>setConfig(${JSON.stringify(config)});return <Subject.DataPivotConfigurator fields={${JSON.stringify(fields)}} records={${JSON.stringify(records)}} value={config} onCellSelect={c=>window.cells.push(c)}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.getByRole("button", { name: /^Mara, Won:/ }).press("Enter");
  await page.evaluate(() => window.breakConfig());
  await page.getByRole("alert").waitFor();
  await page.waitForFunction(() => window.cells.at(-1) === null);
  await page.evaluate(() => window.fixConfig());
  await page.getByRole("grid").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Close", exact: true }).count(),
    0,
    "Invalid state cannot revive an old selection",
  );
  // A real dimension value cannot be mistaken for the collapsed total column.
  await mount(
    `window.cells=[];createRoot(document.getElementById('root')).render(<Subject.DataPivotConfigurator fields={${JSON.stringify(fields)}} records={[{id:'a',label:'Acme',values:{owner:'Mara',stage:'__total',mrr:100}}]} defaultValue={${JSON.stringify(config)}} onCellSelect={c=>window.cells.push(c)}/>);`,
  );
  await page.locator('[data-demo="cell-0-0"]').press("Enter");
  assert.equal(await page.evaluate(() => window.cells.at(-1).column), "__total");
  // Opaque row/column keys keep distinct groups even when values contain separators.
  const special = [
    { id: "a", label: "First", values: { owner: "X\u0000Y", stage: "Z", mrr: 100 } },
    { id: "b", label: "Second", values: { owner: "X", stage: "Y\u0000Z", mrr: 200 } },
  ];
  await mount(
    `window.cells=[];createRoot(document.getElementById('root')).render(<Subject.DataPivotConfigurator fields={${JSON.stringify(fields)}} records={${JSON.stringify(special)}} defaultValue={${JSON.stringify(config)}} onCellSelect={c=>window.cells.push(c)}/>);`,
  );
  await page.locator('[data-demo="cell-0-0"]').press("Enter");
  assert.deepEqual(
    await page.evaluate(() => ({
      value: window.cells.at(-1).value,
      ids: window.cells.at(-1).records.map((r) => r.id),
    })),
    { value: 200, ids: ["b"] },
  );
  // A single total column still publishes null, and zero cells remain inspectable.
  await mount(
    `window.cells=[];createRoot(document.getElementById('root')).render(<Subject.DataPivotConfigurator ${props} onCellSelect={c=>window.cells.push(c)}/>);`,
  );
  await page.getByRole("button", { name: /^Noor, Open:/ }).press("Space");
  assert.deepEqual(
    await page.evaluate(() => ({
      value: window.cells.at(-1).value,
      ids: window.cells.at(-1).records.map((r) => r.id),
    })),
    { value: 0, ids: [] },
  );
  await page.locator('[data-demo="columns-none"]').press("Enter");
  await page.locator('[data-demo="cell-0-0"]').press("Enter");
  assert.equal(await page.evaluate(() => window.cells.at(-1).column), null);
  // Fractions stay readable and average does not overflow before dividing.
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.DataPivotConfigurator fields={${JSON.stringify(fields)}} records={[{id:'a',label:'Fraction',values:{owner:'Mara',stage:'Won',mrr:.25}}]} defaultValue={${JSON.stringify(config)}} currency="GBP"/>);`,
  );
  assert.match(await page.locator('[data-demo="cell-0-0"]').getAttribute("aria-label"), /£0\.25/);
  const huge = [
    { id: "a", label: "First", values: { owner: "Mara", stage: "Won", mrr: 1e308 } },
    { id: "b", label: "Second", values: { owner: "Mara", stage: "Won", mrr: 1e308 } },
  ];
  await mount(
    `window.cells=[];createRoot(document.getElementById('root')).render(<Subject.DataPivotConfigurator fields={${JSON.stringify(fields)}} records={${JSON.stringify(huge)}} defaultValue={{...${JSON.stringify(config)},measure:'avg'}} onCellSelect={c=>window.cells.push(c)}/>);`,
  );
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  await page.locator('[data-demo="cell-0-0"]').press("Enter");
  assert.equal(await page.evaluate(() => window.cells.at(-1).value), 1e308);
  // Invalid schemas, configurations, formats and overflowing sums have written states.
  for (const invalid of [
    `fields={[{id:'x',label:'First',kind:'dimension'},{id:'x',label:'Duplicate',kind:'dimension'}]} records={[]}`,
    `${props} value={{...${JSON.stringify(config)},rows:'missing'}}`,
    `${props} value={{...${JSON.stringify(config)},columns:'owner'}}`,
    `${props} value={{...${JSON.stringify(config)},measure:'median'}}`,
    `fields={${JSON.stringify(fields)}} records={[{id:'a',label:'Bad',values:{owner:'Mara',stage:'Won',mrr:NaN}}]}`,
    `fields={${JSON.stringify(fields)}} records={${JSON.stringify(huge)}} defaultValue={${JSON.stringify(config)}}`,
    `${props} locale="not_a_locale"`,
    `${props} currency="$"`,
  ]) {
    await mount(`createRoot(document.getElementById('root')).render(<Subject.DataPivotConfigurator ${invalid}/>);`);
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByRole("grid").count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  }
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.DataPivotConfigurator fields={[{id:'owner',label:'Owner',kind:'dimension'}]} records={[{id:'a',label:'Acme',values:{owner:'Mara'}}]}/>);`,
  );
  assert.equal(await page.locator('[data-demo="measure-count"]').getAttribute("aria-checked"), "true");

  assert.equal(await page.locator('[data-demo="columns-owner"]').isDisabled(), true);
  await page.locator('[data-demo="columns-none"]').press("ArrowRight");
  assert.equal(await page.getByRole("alert").count(), 0, "A single dimension cannot create an invalid same-axis view");
  assert.equal(await page.locator('[data-demo="measure-sum"]').isDisabled(), true);
  assert.equal(await page.locator('[data-demo="measure-avg"]').isDisabled(), true);
  await page.locator('[data-demo="measure-count"]').press("ArrowRight");
  assert.equal(await page.locator('[data-demo="measure-count"]').getAttribute("aria-checked"), "true");
  const singleCellBox = await page.locator('[data-demo="cell-0-0"]').boundingBox();
  assert.ok(
    singleCellBox.x >= 0 && singleCellBox.x + singleCellBox.width <= page.viewportSize().width,
    "A single total column fits a narrow card",
  );
  await mount(
    `window.proposed=[];createRoot(document.getElementById('root')).render(<Subject.DataPivotConfigurator fields={${JSON.stringify(fields)}} records={${JSON.stringify(records)}} defaultValue={{...${JSON.stringify(config)},measure:'count',value:''}} onChange={c=>window.proposed.push(c)}/>);`,
  );
  await page.locator('[data-demo="measure-sum"]').press("Enter");
  assert.equal(
    await page.evaluate(() => window.proposed.at(-1).value),
    "mrr",
    "Leaving Count picks an available numeric field",
  );
  assert.equal(await page.getByRole("alert").count(), 0);
  // Omitted defaults recover as an asynchronous custom schema arrives or changes.
  await mount(
    `window.cells=[];function Host(){const [data,setData]=useState({fields:[],records:[]});window.load=()=>setData({fields:[{id:'owner',label:'Owner',kind:'dimension'},{id:'amount',label:'Amount',kind:'measure'}],records:[{id:'a',label:'Acme',values:{owner:'Mara',amount:25}}]});window.replace=()=>setData({fields:[{id:'region',label:'Region',kind:'dimension'},{id:'value',label:'Value',kind:'measure'}],records:[{id:'b',label:'Beacon',values:{region:'East',value:12}}]});return <Subject.DataPivotConfigurator {...data} onCellSelect={c=>window.cells.push(c)}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  assert.equal(await page.getByRole("grid").count(), 0);
  await page.evaluate(() => window.load());
  await page.getByRole("grid").waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);
  await page.locator('[data-demo="cell-0-0"]').press("Enter");
  assert.equal(await page.evaluate(() => window.cells.at(-1).value), 25);
  await page.evaluate(() => window.replace());
  await page.waitForFunction(() => window.cells.at(-1) === null);
  assert.equal(await page.getByRole("alert").count(), 0);
  await page.getByRole("button", { name: /^East:/ }).waitFor();
}
