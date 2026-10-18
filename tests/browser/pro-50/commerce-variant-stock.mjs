export async function check({ page, mount, assert, capture = async () => {} }) {
  await mount(
    `window.saves=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.VariantStock onSave={async rows=>{window.saves.push(structuredClone(rows));if(window.fail)throw Error('The stock service is offline.');rows[0].stock.xl=777;return new Promise(resolve=>window.finishStock=resolve)}}/>);`,
  );
  const cell = () => page.getByRole("spinbutton", { name: "Ink / XL stock", exact: true });
  await cell().fill("12");
  assert.match(await page.locator("section").innerText(), /3 → 12/);
  assert.match(await page.locator("section").innerText(), /204/);
  await capture("edited", { audit: true });
  await page.getByRole("button", { name: "Save stock", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "The stock service is offline." }).waitFor();
  assert.equal(await cell().inputValue(), "12");
  await capture("save-failed", { audit: true });
  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "Save stock", exact: true }).click();
  assert.equal(await cell().isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Discard changes", exact: true }).isDisabled(), true);
  await page.locator('[data-demo="save-stock"]').evaluate((node) => node.click());
  assert.equal(await page.evaluate(() => window.saves.length), 2);
  assert.equal(await page.evaluate(() => window.saves[1][0].stock.xl), 12);
  await capture("pending", { audit: true });
  await page.evaluate(() => window.finishStock());
  await page.getByText("Stock saved · 1 cell updated", { exact: true }).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0, "Acknowledged stock retires earlier failure announcements");
  assert.equal(await cell().inputValue(), "12", "Host mutation cannot rewrite the retained snapshot");
  await capture("saved", { audit: true });
  assert.equal(await page.getByRole("button", { name: "Saved", exact: true }).isDisabled(), true);
  await cell().fill("1.5");
  assert.equal(await page.getByRole("button", { name: "Save stock", exact: true }).isDisabled(), true);
  assert.match(await page.getByRole("alert").innerText(), /whole stock counts/);
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  assert.equal(await cell().inputValue(), "12", "Discard returns to the last acknowledged save");
  await cell().press("Shift+ArrowUp");
  assert.equal(await cell().inputValue(), "22");
  await page.getByRole("button", { name: "Discard changes", exact: true }).click();
  assert.equal(await cell().inputValue(), "12");
  await cell().fill("-1");
  assert.equal(await page.getByRole("button", { name: "Save stock", exact: true }).isDisabled(), true);
  assert.match(await page.getByRole("alert").innerText(), /whole stock counts/);
  await capture("invalid", { audit: true });

  await mount(`createRoot(document.getElementById('root')).render(<Subject.VariantStock defaultVariants={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /No variants are available/);
  assert.equal(await page.getByRole("button", { name: "Save stock", exact: true }).isDisabled(), true);
  await capture("empty", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.VariantStock sizes={[{id:'m',label:'M'}]} defaultVariants={[{id:'row',label:'Row',sku:'ROW',swatch:'#444444',stock:{}}]}/>);`,
  );
  assert.equal(await page.getByRole("spinbutton").inputValue(), "");
  assert.match(await page.locator("section").innerText(), /Missing values remain unavailable/);

  await mount(
    `window.rawSaves=[];createRoot(document.getElementById('root')).render(<Subject.VariantStock sizes={[{id:'constructor',label:'Raw size'}]} defaultVariants={[{id:'__proto__',label:'Raw colour',sku:'RAW',swatch:'#444444',stock:Object.fromEntries([['constructor',3]])}]} onSave={rows=>window.rawSaves.push(rows)}/>);`,
  );
  await page.getByRole("spinbutton", { name: "Raw colour / Raw size stock", exact: true }).fill("5");
  await page.getByRole("button", { name: "Save stock", exact: true }).click();
  await page.getByText("Stock saved · 1 cell updated", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.rawSaves[0][0].stock.constructor), 5);

  await mount(
    `function Host(){const [rows,setRows]=React.useState([{id:'crew',label:'Charcoal',sku:'MC-CHR',swatch:'#444444',stock:{m:4}}]);window.replaceStock=()=>setRows([{id:'crew',label:'Charcoal',sku:'MC-CHR',swatch:'#444444',stock:{m:7}}]);return <Subject.VariantStock sizes={[{id:'m',label:'M'}]} defaultVariants={rows} onSave={()=>new Promise(resolve=>window.oldStock=resolve)}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.getByRole("spinbutton").fill("6");
  await page.getByRole("button", { name: "Save stock", exact: true }).click();
  await page.evaluate(() => window.replaceStock());
  await page.waitForFunction(() => document.querySelector('input[role="spinbutton"]')?.value === "7");
  await page.evaluate(() => window.oldStock());
  assert.doesNotMatch(await page.locator("section").innerText(), /Stock saved/);

  await page.setViewportSize({ width: 320, height: 1800 });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
  const region = page.getByRole("region", { name: "Inventory by colour and size", exact: true });
  await region.evaluate((node) => (node.scrollLeft = node.scrollWidth));
  const last = page.getByRole("spinbutton", { name: "Rust / XL stock", exact: true });
  await last.scrollIntoViewIfNeeded();
  const rect = await region.boundingBox(),
    field = await last.boundingBox();
  assert.ok(
    field.x >= rect.x && field.x + field.width <= rect.x + rect.width,
    "The whole last editable cell fits its scroller",
  );
  assert.equal(
    await last.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === node;
    }),
    true,
    "The sticky identity column cannot cover the last editable cell",
  );
  await last.click();
  await page.keyboard.press("ArrowUp");
  assert.equal(await last.inputValue(), "3");
  await capture("narrow-last-cell");
  await page.setViewportSize({ width: 390, height: 1800 });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.VariantStock/>);`);
  const header = page.getByRole("heading", { name: "Merino crew", exact: true }).locator("..");
  const metadata = await header
    .locator("p")
    .last()
    .evaluate((node) => ({
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(node).lineHeight),
    }));
  assert.ok(
    metadata.width >= 120 && metadata.height <= metadata.lineHeight * 2,
    "Phone product metadata stays readable",
  );
}
