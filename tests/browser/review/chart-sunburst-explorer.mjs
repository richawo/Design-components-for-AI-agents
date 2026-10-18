export async function check({ page, mount, assert }) {
  const data = {
    name: "bundle",
    children: [
      {
        name: "app",
        children: [
          { name: "editor", value: 60 },
          { name: "settings", value: 40 },
        ],
      },
      { name: "assets", children: [{ name: "logo", value: 25 }] },
    ],
  };
  await mount(
    `window.paths=[];const root=createRoot(document.getElementById('root'));window.renderData=data=>root.render(<Subject.ChartSunburstExplorer data={data} format="number" unit="modules" onDrill={p=>window.paths.push(p)}/>);window.renderData(${JSON.stringify(data)});`,
  );
  await page.locator('[data-demo="sunburst-row-app"]').press("Enter");
  await page.locator('[data-demo="sunburst-row-editor"]').waitFor();
  assert.equal(
    await page.locator('[data-demo="sunburst-row-assets"]').count(),
    0,
    "Retired rows leave the keyboard immediately",
  );
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-demo")), "sunburst-centre");
  assert.deepEqual(await page.evaluate(() => window.paths.at(-1)), ["bundle", "app"]);
  await page.locator('[data-demo="sunburst-centre"]').press("Escape");
  await page.locator('[data-demo="sunburst-row-assets"]').waitFor();
  assert.deepEqual(await page.evaluate(() => window.paths.at(-1)), ["bundle"]);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-demo")), "sunburst-plot");
  await page.locator('[data-demo="sunburst-arc-assets"]').click();
  await page.locator('[data-demo="sunburst-row-logo"]').waitFor();
  assert.deepEqual(await page.evaluate(() => window.paths.at(-1)), ["bundle", "assets"]);
  await page.locator('[data-demo="sunburst-crumb-0"]').press("Space");
  await page.locator('[data-demo="sunburst-row-app"]').waitFor();
  assert.deepEqual(await page.evaluate(() => window.paths.at(-1)), ["bundle"]);
  await page.locator('[data-demo="sunburst-row-app"]').press("Enter");
  await page.evaluate(() => window.renderData({ name: "next bundle", children: [{ name: "styles", value: 20 }] }));
  await page.locator('[data-demo="sunburst-row-styles"]').waitFor();
  assert.equal(await page.locator('[data-demo="sunburst-row-editor"]').count(), 0);
  for (const tree of [
    "{name:'Empty',children:[]}",
    "{name:'Invalid',children:[{name:'Bad',value:NaN},{name:'Infinite',value:Infinity},{name:'Negative',value:-1}]}",
  ]) {
    await mount(`createRoot(document.getElementById('root')).render(<Subject.ChartSunburstExplorer data={${tree}}/>);`);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
    assert.equal(await page.locator('[data-demo^="sunburst-arc-"]').count(), 0);
  }

  const slashTree = {
    name: "bundle",
    children: [
      { name: "a/b", children: [{ name: "x", value: 3 }] },
      { name: "a", children: [{ name: "b", children: [{ name: "y", value: 2 }] }] },
    ],
  };
  await mount(
    `window.paths=[];createRoot(document.getElementById('root')).render(<Subject.ChartSunburstExplorer data={${JSON.stringify(slashTree)}} onDrill={p=>window.paths.push(p)}/>);`,
  );
  await page.locator('[data-demo="sunburst-row-a-b"]').press("Enter");
  await page.locator('[data-demo="sunburst-row-x"]').waitFor();
  assert.equal(await page.locator('[data-demo="sunburst-row-y"]').count(), 0);
  assert.deepEqual(await page.evaluate(() => window.paths), [["bundle", "a/b"]]);
  await mount(
    `window.paths=[];createRoot(document.getElementById('root')).render(<Subject.ChartSunburstExplorer data={${JSON.stringify(data)}} showList={false} onDrill={p=>window.paths.push(p)}/>);`,
  );
  const app = page.locator('[data-demo="sunburst-arc-app"]');
  assert.equal(await app.getAttribute("role"), "button");
  assert.equal(await app.getAttribute("tabindex"), "0");
  await app.press("Space");
  assert.deepEqual(await page.evaluate(() => window.paths.at(-1)), ["bundle", "app"]);
  assert.equal(await app.getAttribute("aria-hidden"), "true");
  assert.equal(await app.getAttribute("tabindex"), "-1");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-demo")), "sunburst-centre");
  await page.locator('[data-demo="sunburst-centre"]').press("Escape");
  assert.deepEqual(await page.evaluate(() => window.paths.at(-1)), ["bundle"]);
  assert.equal(await page.locator('[data-demo^="sunburst-crumb-"]').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-demo")), "sunburst-plot");
  await page.locator('[data-demo="sunburst-arc-assets"]').press("Enter");
  assert.deepEqual(await page.evaluate(() => window.paths.at(-1)), ["bundle", "assets"]);
  const leaf = page.locator('[data-demo="sunburst-arc-logo"]');
  await leaf.focus();
  assert.equal(await leaf.getAttribute("role"), "img");
  await page.waitForFunction(() => document.querySelector("[aria-live]").textContent.includes("logo"));
  assert.deepEqual(
    await page.evaluate(() => window.paths.at(-1)),
    ["bundle", "assets"],
    "Reading a leaf cannot invent another drill",
  );
  for (const extra of [
    "rings={NaN}",
    "rings={0}",
    "rings={6}",
    'locale="invalid_locale"',
    "data={{name:'bundle',children:[{name:'duplicate',value:1},{name:'duplicate',value:2}]}}",
    "data={{name:'bundle',children:[{name:'a',value:1e308},{name:'b',value:1e308}]}}",
  ]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.ChartSunburstExplorer {...{data:${JSON.stringify(data)}}} ${extra}/>);`,
    );
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator('[data-demo^="sunburst-arc-"]').count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  }
  await mount(
    `const data={name:'Cycle'};data.children=[data];createRoot(document.getElementById('root')).render(<Subject.ChartSunburstExplorer data={data}/>);`,
  );
  await page.getByRole("alert").waitFor();
  await mount(
    `const root=createRoot(document.getElementById('root'));window.renderData=data=>root.render(<Subject.ChartSunburstExplorer data={data}/>);window.renderData({name:'Invalid',value:NaN});`,
  );
  await page.getByRole("alert").waitFor();
  await page.evaluate((data) => window.renderData(data), data);
  await page.locator('[data-demo="sunburst-arc-app"]').waitFor();
  await page.locator('[data-demo="sunburst-row-app"]').press("Enter");
  await page.locator('[data-demo="sunburst-row-editor"]').waitFor();
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartSunburstExplorer data={{name:'Large',children:[{name:'a',value:1e308},{name:'b',value:5e307}]}} format="number"/>);`,
  );
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  assert.doesNotMatch(
    await page.locator("svg").evaluateAll((nodes) => nodes.map((node) => node.outerHTML).join("")),
    /NaN|Infinity/,
  );
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
}
