export async function check({ page, mount, assert, capture = async () => {} }) {
  await mount(
    `window.selected=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.WaterfallBridge onSelect={async index=>{window.selected.push(index);if(window.fail)throw Error('The linked report is offline.');return new Promise(resolve=>window.finishSelection=resolve)}}/>);`,
  );
  const bar = (index) => page.locator('[data-demo="bridge-' + index + '"]');
  await page.getByText("Closing balance 164 $k", { exact: true }).waitFor();
  const origins = await page
    .locator('[data-demo^="bridge-"] > span[aria-hidden="true"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().top),
    );
  assert.equal(origins.length, 6);
  assert.ok(
    Math.max(...origins) - Math.min(...origins) < 1,
    "All bars share one scale origin",
  );
  await bar(3).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "The linked report is offline." })
    .waitFor();
  assert.equal(await bar(3).getAttribute("aria-pressed"), "true");
  assert.equal(
    await bar(3).evaluate((node) => node === document.activeElement),
    true,
    "Failed selection retains chart focus",
  );
  await capture("selection-failed", { audit: true });
  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  assert.equal(await bar(3).isDisabled(), true);
  assert.equal(
    await bar(3).evaluate((node) => node === document.activeElement),
    true,
    "Retry retains focus on the pending selection",
  );
  await bar(4).evaluate((node) => node.click());
  assert.deepEqual(await page.evaluate(() => window.selected), [3, 3]);
  await capture("pending", { audit: true });
  await page.evaluate(() => window.finishSelection());
  await page
    .getByRole("status")
    .filter({ hasText: "Selection complete" })
    .waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.equal(
    await bar(3).evaluate((node) => node === document.activeElement),
    true,
    "Acknowledgement preserves chart focus",
  );
  await capture("selected", { audit: true });
  await mount(
    `window.keys=[];createRoot(document.getElementById('root')).render(<Subject.WaterfallBridge onSelect={index=>{window.keys.push(index)}}/>);`,
  );
  await bar(1).focus();
  await bar(1).press("End");
  assert.equal(await bar(5).getAttribute("aria-pressed"), "true");
  await bar(5).press("ArrowRight");
  assert.equal(await bar(0).getAttribute("aria-pressed"), "true");
  await bar(0).press("ArrowLeft");
  assert.equal(await bar(5).getAttribute("aria-pressed"), "true");
  await bar(5).press("Home");
  assert.equal(await bar(0).getAttribute("aria-pressed"), "true");
  assert.deepEqual(await page.evaluate(() => window.keys), [5, 0, 5, 0]);
  assert.equal(
    await bar(0).evaluate((node) => node === document.activeElement),
    true,
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.WaterfallBridge opening={0} changes={[]}/>);`,
  );
  assert.equal(await page.locator('[data-demo^="bridge-"]').count(), 2);
  assert.match(
    await page.locator("section").innerText(),
    /No contributions in this period/,
  );
  await capture("zero-period", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.WaterfallBridge opening={-20} changes={[{label:'New',amount:5},{label:'Lost',amount:-10}]} unit="hours"/>);`,
  );
  await page.getByText("Closing balance -25 hours", { exact: true }).waitFor();
  await page.locator('[data-demo="bridge-2"]').click();
  assert.match(await page.locator("footer").innerText(), /-15 → -25 hours/);
  await capture("negative-balance", { audit: true });
  for (const props of [
    "opening={NaN}",
    'changes={[{label:"Bad",amount:NaN}]}',
    'opening={1e308} changes={[{label:"Huge",amount:1e308}]}',
  ]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.WaterfallBridge ${props}/>);`,
    );
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator('[data-demo^="bridge-"]').count(), 0);
    assert.match(await page.locator("section").innerText(), /Unavailable/);
  }
  await capture("invalid-data", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.WaterfallBridge opening={-Number.MAX_VALUE} changes={[{label:'Recover',amount:Number.MAX_VALUE},{label:'Add',amount:Number.MAX_VALUE}]}/>);`,
  );
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.equal(
    await page
      .locator("[style]")
      .evaluateAll((nodes) =>
        nodes.some((node) => /NaN|Infinity/.test(node.getAttribute("style"))),
      ),
    false,
  );
  const axisLines = await page
    .locator('div[aria-hidden="true"] > span')
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return { text: node.textContent, lines: range.getClientRects().length };
      }),
    );
  assert.ok(axisLines.length >= 3);
  assert.ok(
    axisLines.every((tick) => tick.lines === 1),
    JSON.stringify(axisLines),
  );
  await capture("finite-extremes", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.WaterfallBridge opening={0} changes={[{label:'Tiny',amount:1e-8}]}/>);`,
  );
  assert.match(await bar(1).getAttribute("aria-label"), /0\.00000001/);
  assert.doesNotMatch(await page.locator("footer").innerText(), /Tiny \+0 /);
  await mount(
    `function Host(){const [changes,setChanges]=React.useState([{label:'Before refresh',amount:3}]);window.replaceBridge=()=>setChanges([{label:'After refresh',amount:8}]);return <><button type="button">Outside chart</button><Subject.WaterfallBridge changes={changes} onSelect={()=>new Promise(resolve=>window.oldSelection=resolve)}/></>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await bar(1).click();
  await page
    .getByRole("button", { name: "Outside chart", exact: true })
    .click();
  await page.evaluate(() => window.replaceBridge());
  await page.getByRole("button", { name: /After refresh:/ }).waitFor();
  await page.evaluate(() => window.oldSelection());
  assert.doesNotMatch(
    await page.locator("section").innerText(),
    /Selection complete/,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Outside chart", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
}
