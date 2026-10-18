export async function check({ page, mount, assert }) {
  const groups = [
    { id: "alpha", label: "Alpha", values: [100, 110, 120] },
    { id: "beta", label: "Beta", values: [200, 210, 220] },
    { id: "gamma", label: "Gamma", values: [300, 310, 320] },
  ];
  await mount(
    `window.limits=[];window.sorts=[];const root=createRoot(document.getElementById('root'));window.renderStatus=status=>root.render(<Subject.ChartBoxDistribution groups={${JSON.stringify(groups)}} defaultThreshold={200} onThresholdChange={v=>window.limits.push(v)} onSortChange={s=>window.sorts.push(s)} status={status} onRetry={()=>window.renderStatus('ready')}/>);window.renderStatus('ready');`,
  );
  const limit = page.getByRole("slider", { name: "Latency limit", exact: true });
  await limit.press("Home");
  assert.equal(await limit.getAttribute("aria-valuenow"), "0");
  await limit.press("ArrowRight");
  const small = Number(await limit.getAttribute("aria-valuenow"));
  assert.ok(small > 0);
  await limit.press("Shift+ArrowRight");
  assert.equal(Number(await limit.getAttribute("aria-valuenow")), small * 6);
  await limit.press("End");
  assert.equal(await limit.getAttribute("aria-valuenow"), await limit.getAttribute("aria-valuemax"));
  const max = Number(await limit.getAttribute("aria-valuemax"));
  const handle = await limit.boundingBox();
  const track = await page.locator("[data-limit-track]").boundingBox();
  assert.ok(handle && track);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width / 2, handle.y + handle.height / 2, { steps: 12 });
  await page.mouse.up();
  const dragged = Number(await limit.getAttribute("aria-valuenow"));
  assert.ok(dragged > 0 && dragged < max, "Dragging changes the measured threshold");
  await page.locator('[data-demo="sort-p50"]').press("ArrowRight");
  assert.equal(await page.locator('[data-demo="sort-p95"]').getAttribute("aria-checked"), "true");
  assert.equal(await page.locator('[data-demo^="row-"]').first().getAttribute("data-demo"), "row-gamma");
  await page.locator('[data-demo="row-alpha"]').focus();
  assert.match(await page.locator('[data-demo="row-alpha"]').getAttribute("aria-label"), /median 110/);
  await page.evaluate(() => window.renderStatus("unavailable"));
  await page.getByText("Couldn’t load samples", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry", exact: true }).press("Enter");
  await limit.waitFor();
  assert.equal(Number(await limit.getAttribute("aria-valuenow")), dragged);
  assert.equal(await page.locator('[data-demo="sort-p95"]').getAttribute("aria-checked"), "true");
  assert.equal(await page.evaluate(() => window.limits.every(Number.isFinite)), true);
  assert.deepEqual(await page.evaluate(() => window.sorts), ["p95"]);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartBoxDistribution groups={[{id:'bad',label:'Bad samples',values:[NaN,Infinity]}]}/>);`,
  );
  await page.getByText("No samples yet", { exact: true }).waitFor();
  assert.equal(await page.getByRole("slider").count(), 0);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartBoxDistribution groups={${JSON.stringify(groups.slice(0, 1))}}/>);`,
  );
  const firstLimit = Number(await limit.getAttribute("aria-valuenow"));
  const firstAxisMax = await limit.getAttribute("aria-valuemax");
  assert.ok(
    firstLimit <= Number(await limit.getAttribute("aria-valuemax")),
    "The default limit fits a small dataset’s axis",
  );
  await limit.press("ArrowRight");
  assert.ok(Number(await limit.getAttribute("aria-valuenow")) >= firstLimit, "Right cannot decrease the limit");
  await limit.press("Home");
  assert.equal(
    await limit.getAttribute("aria-valuemax"),
    firstAxisMax,
    "Lowering the limit keeps drag geometry stable",
  );
  await mount(
    `const root=createRoot(document.getElementById('root'));window.ready=()=>root.render(<Subject.ChartBoxDistribution groups={${JSON.stringify(groups)}}/>);root.render(<Subject.ChartBoxDistribution groups={${JSON.stringify(groups)}} status="unavailable" onRetry={()=>window.ready()}/>);`,
  );
  await page.getByRole("button", { name: "Retry", exact: true }).press("Enter");
  await limit.waitFor();
  assert.ok(
    (await page.locator("[data-limit-track]").boundingBox()).width > 200,
    "Retry attaches and measures the plot",
  );
  await page.setViewportSize({ width: 768, height: 900 });
  await page.waitForFunction(() => document.querySelector('[data-demo="row-alpha"]').style.gridTemplateColumns !== "");
  assert.ok((await page.locator('[data-demo="row-alpha"]').boundingBox()).width > 390);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('[data-demo="row-alpha"]').style.gridTemplateColumns === "");
  for (const [props, message] of [
    ["defaultThreshold={NaN}", "Check the latency limit"],
    ["threshold={Infinity}", "Check the latency limit"],
    ["defaultThreshold={-1}", "Check the latency limit"],
    ["target={1.1}", "Check the pass target"],
    ["target={NaN}", "Check the pass target"],
    ["decimals={Infinity}", "Check number formatting"],
    ["decimals={-1}", "Check number formatting"],
    ['locale="invalid_locale"', "Check number formatting"],
    ['defaultSort="unknown"', "Check the row order"],
  ]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.ChartBoxDistribution groups={${JSON.stringify(groups)}} ${props}/>);`,
    );
    await page.getByRole("alert").getByText(message, { exact: true }).waitFor();
    assert.equal(await page.getByRole("slider").count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  }
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartBoxDistribution groups={[{id:'huge',label:'Large samples',values:[1e308,1.5e308,1.7e308]}]} defaultThreshold={1.6e308} showMean/>);`,
  );
  await limit.waitFor();
  assert.equal(Number.isFinite(Number(await limit.getAttribute("aria-valuemax"))), true);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  assert.equal(
    await page
      .locator("svg path")
      .evaluateAll((paths) => paths.every((path) => !/(?:NaN|Infinity)/.test(path.getAttribute("d") || ""))),
    true,
  );
  assert.ok(
    (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1,
    "Large values stay inside the viewport",
  );
  assert.match(await limit.getAttribute("aria-valuetext"), /E308/);
  for (const name of ["aria-valuemin", "aria-valuemax", "aria-valuenow"])
    assert.match(await limit.getAttribute(name), /^\d+(?:\.\d+)?$/, "Slider bounds use plain decimal ARIA syntax");
}
