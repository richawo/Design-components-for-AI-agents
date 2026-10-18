export async function check({ page, mount, assert, capture = async () => {} }) {
  await mount(
    `window.applied=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.QueryBuilder onChange={query=>{query.rules.splice(0)}} onApply={async(query,ids)=>{window.applied.push({query:structuredClone(query),ids:[...ids]});if(window.fail)throw Error('The segment service is offline.');query.rules[0].value='Mutated by host';ids.splice(0);return new Promise(resolve=>window.finishApply=resolve)}}/>);`,
  );
  const count = () =>
    page.getByRole("status").filter({ hasText: /matching record/ });
  const threshold = () =>
    page.getByRole("textbox", { name: "Value for condition 2", exact: true });
  assert.match(await count().innerText(), /3 matching records/);
  await threshold().fill("20");
  assert.match(await count().innerText(), /2 matching records/);
  assert.equal(
    await page
      .getByRole("textbox", { name: "Value for condition 1", exact: true })
      .inputValue(),
    "Team",
  );
  await page.getByRole("button", { name: "Use segment", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "The segment service is offline." })
    .waitFor();
  assert.equal(await threshold().inputValue(), "20");
  // A rejected apply leaves the pointer on the retry action. Its hover ink must stay readable.
  const retry = page.getByRole("button", { name: "Use segment", exact: true });
  await retry.hover();
  await page.waitForTimeout(200);
  const contrast = await retry.evaluate((node) => {
    const style = getComputedStyle(node),
      canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = style.color;
    ctx.fillRect(1, 0, 1, 1);
    const pixels = ctx.getImageData(0, 0, 2, 1).data;
    const light = (offset) =>
      [0, 1, 2]
        .map((i) => {
          const channel = pixels[offset + i] / 255;
          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i],
          0,
        );
    const a = light(0),
      b = light(4);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  assert.ok(
    contrast >= 4.5,
    `Hovered segment action contrast: ${contrast.toFixed(2)}:1`,
  );
  await capture("apply-failed", { audit: true });
  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "Use segment", exact: true }).click();
  assert.equal(await threshold().isDisabled(), true);
  assert.equal(
    await page.getByRole("button", { name: /Add condition/ }).isDisabled(),
    true,
  );
  await page
    .locator('[data-demo="apply-segment"]')
    .evaluate((node) => node.click());
  assert.equal(await page.evaluate(() => window.applied.length), 2);
  assert.deepEqual(await page.evaluate(() => window.applied[1]), {
    query: {
      match: "all",
      rules: [
        { id: "plan", field: "plan", operator: "equals", value: "Team" },
        { id: "seats", field: "seats", operator: "gt", value: "20" },
      ],
    },
    ids: ["cedar", "orbit"],
  });
  await capture("pending", { audit: true });
  await page.evaluate(() => window.finishApply());
  await page
    .getByRole("status")
    .filter({ hasText: "Segment applied · 2 records" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Value for condition 1", exact: true })
      .inputValue(),
    "Team",
  );
  assert.equal(await page.getByRole("alert").count(), 0);
  await capture("applied", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.QueryBuilder onApply={()=>{}}/>);`,
  );
  const match = page.getByRole("combobox", {
    name: "Match conditions",
    exact: true,
  });
  await match.press("End");
  await match.press("Enter");
  assert.match(await count().innerText(), /4 matching records/);
  await match.press("Space");
  await match.press("Escape");
  assert.equal(await match.getAttribute("aria-expanded"), "false");
  await page.getByRole("button", { name: "All records", exact: true }).click();
  await page.getByText("Morrow", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("Outside these conditions", { exact: true }).count(),
    1,
  );
  await capture("all-records", { audit: true });
  for (const raw of ["Infinity", "1e-400", ""]) {
    await threshold().fill(raw);
    assert.equal(
      await page
        .getByRole("button", { name: "Use segment", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(await threshold().getAttribute("aria-invalid"), "true");
  }
  assert.match(
    await page.getByRole("status").first().innerText(),
    /Complete the conditions/,
  );
  await capture("incomplete", { audit: true });
  await page
    .getByRole("button", { name: "Remove condition 2", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: /Add condition/ })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await page
    .getByRole("button", { name: "Remove condition 1", exact: true })
    .click();
  assert.match(await count().innerText(), /5 matching records/);
  await page.getByRole("button", { name: /Add condition/ }).click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Value for condition 1", exact: true })
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.QueryBuilder fields={[{id:'constructor',label:'Reserved key',type:'text'}]} records={[{id:'one',label:'No inherited values',values:{}}]} defaultValue={{match:'all',rules:[{id:'raw',field:'constructor',operator:'contains',value:'function'}]}}/>);`,
  );
  assert.match(await count().innerText(), /0 matching records/);
  await mount(
    `window.readOnly=[];createRoot(document.getElementById('root')).render(<Subject.QueryBuilder value={{match:'all',rules:[]}} onApply={(query,ids)=>window.readOnly.push({query,ids})}/>);`,
  );
  assert.equal(
    await page
      .getByRole("combobox", { name: "Match conditions", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page.getByRole("button", { name: /Add condition/ }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Use segment", exact: true }).click();
  assert.equal(await page.evaluate(() => window.readOnly[0].ids.length), 5);
  await capture("read-only", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.QueryBuilder fields={[]} records={[]} defaultValue={{match:'all',rules:[]}}/>);`,
  );
  assert.match(
    await page.locator("section").innerText(),
    /No records available/,
  );
  await capture("empty", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.QueryBuilder fields={[{id:'x',label:'First',type:'text'},{id:'x',label:'Second',type:'text'}]}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /unique/);
  await capture("invalid-data", { audit: true });
  await mount(
    `function Host(){const [value,setValue]=React.useState({match:'all',rules:[{id:'seats',field:'seats',operator:'gt',value:'20'}]});window.replaceQuery=()=>setValue({match:'all',rules:[{id:'seats',field:'seats',operator:'gt',value:'40'}]});return <Subject.QueryBuilder value={value} onChange={setValue} onApply={()=>new Promise(resolve=>window.oldApply=resolve)}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.getByRole("button", { name: "Use segment", exact: true }).click();
  await page.evaluate(() => window.replaceQuery());
  await page.waitForFunction(
    () =>
      document.querySelector('input[data-demo="rule-value-0"]').value === "40",
  );
  await page.evaluate(() => window.oldApply());
  assert.doesNotMatch(
    await page.locator("section").innerText(),
    /Segment applied/,
  );
  assert.match(await count().innerText(), /1 matching record/);
}
