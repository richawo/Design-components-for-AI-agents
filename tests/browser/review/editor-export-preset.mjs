export async function check({ page, mount, assert, capture = async () => {} }) {
  await page.setViewportSize({ width: 390, height: 2000 });
  await mount(
    `window.exports=[];window.changes=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.EditorExportPreset onChange={settings=>window.changes.push(settings)} onExport={async settings=>{window.exports.push(settings);if(window.fail)throw Error('The file writer is offline.');await new Promise(resolve=>window.finishExport=resolve)}}/>);`,
  );
  const preset = page.getByRole("radiogroup", { name: "Artboard size", exact: true });
  await preset.getByRole("radio").first().press("End");
  assert.equal(await page.locator('[data-demo="preset-banner"]').getAttribute("aria-checked"), "true");
  await preset.getByRole("radio").last().press("Home");
  assert.equal(await page.locator('[data-demo="preset-og"]').getAttribute("aria-checked"), "true");
  assert.equal(await page.getByRole("slider", { name: "Quality", exact: true }).isDisabled(), true);
  const format = page.getByRole("radiogroup", { name: "Format", exact: true });
  await format.getByRole("radio", { name: "PNG", exact: true }).press("ArrowRight");
  assert.equal(await page.locator('[data-demo="format-jpg"]').getAttribute("aria-checked"), "true");
  assert.equal(await page.getByRole("switch", { name: /Transparent background/ }).isDisabled(), true);
  await page.locator('[data-demo="format-jpg"]').press("ArrowRight");
  assert.equal(await page.locator('[data-demo="format-webp"]').getAttribute("aria-checked"), "true");
  await page.getByRole("switch", { name: /Transparent background/ }).press("Space");
  assert.equal(await page.getByRole("switch", { name: /Transparent background/ }).isChecked(), true);
  const quality = page.getByRole("slider", { name: "Quality", exact: true });
  await quality.press("End");
  assert.equal(await quality.inputValue(), "100");
  await quality.press("Home");
  await quality.press("ArrowRight");
  assert.equal(await quality.inputValue(), "2");
  const compare = page.getByRole("slider", { name: "Compare original and export", exact: true });
  assert.equal(await compare.getAttribute("aria-valuemin"), "4");
  assert.equal(await compare.getAttribute("aria-valuemax"), "96");
  await compare.press("Home");
  assert.equal(await compare.getAttribute("aria-valuenow"), "4");
  await compare.press("End");
  assert.equal(await compare.getAttribute("aria-valuenow"), "96");
  await compare.press("Shift+ArrowLeft");
  assert.equal(await compare.getAttribute("aria-valuenow"), "86");
  await compare.scrollIntoViewIfNeeded();
  const box = await page.locator('[data-demo="compare"]').boundingBox();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  assert.ok(Math.abs(Number(await compare.getAttribute("aria-valuenow")) - 25) <= 2);
  await page.locator('[data-demo="scale-3"]').press("Enter");
  const name = page.getByRole("textbox", { name: "File name", exact: true });
  const exportButton = () => page.locator('[data-demo="export"]');
  await name.fill("bad/name");
  assert.equal(await name.getAttribute("aria-invalid"), "true");
  assert.equal(await exportButton().isDisabled(), true);
  await name.fill("summer-proof");
  await capture("draft");
  await exportButton().press("Enter");
  await page.getByRole("status").filter({ hasText: "The file writer is offline." }).waitFor();
  assert.equal(await name.inputValue(), "summer-proof");
  assert.equal(await quality.inputValue(), "2");
  await capture("failed");
  await page.evaluate(() => (window.fail = false));
  await exportButton().press("Enter");
  await page.waitForFunction(() => typeof window.finishExport === "function");
  assert.equal(await name.isDisabled(), true, "Settings are pinned while the file is written");
  await exportButton().evaluate((element) => element.click());
  assert.equal(await page.evaluate(() => window.exports.length), 2);
  const payload = await page.evaluate(() => window.exports[1]);
  assert.deepEqual(
    { ...payload, estimatedBytes: undefined },
    {
      presetId: "og",
      width: 3600,
      height: 1890,
      scale: 3,
      format: "webp",
      quality: 2,
      transparent: true,
      fileName: "summer-proof@3x.webp",
      estimatedBytes: undefined,
    },
  );
  assert.ok(Number.isSafeInteger(payload.estimatedBytes) && payload.estimatedBytes > 0);
  assert.deepEqual(await page.evaluate(() => window.exports[0]), payload);
  await capture("pending");
  const changes = await page.evaluate(() => window.changes.length);
  await page.evaluate(() => window.finishExport());
  await page.getByRole("button", { name: "Exported", exact: true }).waitFor();
  assert.match(await page.locator('div[role="status"]').innerText(), /summer-proof@3x.webp/);
  assert.equal(
    await page.evaluate(() => window.changes.length),
    changes,
    "Status transitions do not publish settings changes",
  );
  await capture("exported");

  await mount(`createRoot(document.getElementById('root')).render(<Subject.EditorExportPreset/>);`);
  assert.equal(await exportButton().isDisabled(), true, "A missing file writer cannot acknowledge an export");
  await mount(`createRoot(document.getElementById('root')).render(<Subject.EditorExportPreset presets={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /Nothing to export yet/);
  assert.equal(await exportButton().count(), 0);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.EditorExportPreset formats={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /No supported export formats|No export formats/);
  assert.equal(await page.getByRole("button", { name: "Export", exact: true }).count(), 0);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorExportPreset presets={[{id:'bad',label:'Invalid',width:0,height:Infinity}]} onExport={()=>{throw Error('Invalid dimensions must not be exported')}}/>);`,
  );
  assert.equal(await exportButton().count(), 0);
  assert.doesNotMatch(await page.locator("section").innerText(), /NaN|Infinity/);
  await mount(
    `function Host(){const [layer,setLayer]=React.useState('old-layer');window.replaceLayer=()=>setLayer('new-layer');return <Subject.EditorExportPreset layerName={layer} onExport={()=>new Promise(resolve=>window.finishOldExport=resolve)}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await exportButton().click();
  await page.waitForFunction(() => typeof window.finishOldExport === "function");
  await page.evaluate(() => window.replaceLayer());
  await page.waitForFunction(() => document.querySelector('input[id$="-name"]')?.value === "new-layer");
  await page.evaluate(() => window.finishOldExport());
  assert.doesNotMatch(await exportButton().innerText(), /Exported/);
  await page
    .getByRole("status")
    .filter({ hasText: /new-layer@2x.png/ })
    .waitFor();
}
