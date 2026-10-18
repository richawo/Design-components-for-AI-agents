export async function check({ page, mount, assert, choose, capture = async () => {} }) {
  await mount(
    `window.imports=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.CatalogImport onImport={async rows=>{window.imports.push(structuredClone(rows));if(window.fail)throw Error('The catalogue service is offline.');rows[0].product='Mutated by host';return new Promise(resolve=>window.finishImport=resolve)}}/>);`,
  );
  const stages = page.getByRole("navigation", { name: "Import stages", exact: true }).getByRole("button");
  for (const stage of await stages.all()) {
    const target = await stage.boundingBox();
    assert.ok(target.width >= 44 && target.height >= 44, "Import stages have 44px targets");
  }
  await page.getByRole("button", { name: "Read CSV", exact: true }).press("Enter");
  assert.equal(await page.getByRole("combobox").count(), 4);
  await choose(page.getByRole("combobox", { name: "Map SKU column 2", exact: true }), "product");
  assert.match(await page.getByRole("alert").innerText(), /only once/);
  assert.equal(await page.getByRole("button", { name: "Review records", exact: true }).isDisabled(), true);
  await capture("invalid-mapping", { audit: true });
  const skuMenu = page.getByRole("combobox", { name: "Map SKU column 2", exact: true });
  await skuMenu.press("Home");
  await skuMenu.press("ArrowDown");
  await skuMenu.press("ArrowDown");
  await skuMenu.press("Enter");
  assert.equal(await skuMenu.getAttribute("data-value"), "sku");
  assert.equal(await skuMenu.getAttribute("aria-expanded"), "false");
  await skuMenu.press("Space");
  await skuMenu.press("Escape");
  assert.equal(await skuMenu.getAttribute("aria-expanded"), "false");
  assert.equal(await skuMenu.evaluate((node) => node === document.activeElement), true);
  await stages.nth(0).click();
  await page.getByRole("textbox", { name: "CSV data", exact: true }).waitFor();
  await stages.nth(1).click();
  assert.equal(await page.getByRole("combobox").count(), 4);
  await page.getByRole("button", { name: "Review records", exact: true }).click();
  assert.match(await page.getByRole("region", { name: "Mapped records", exact: true }).innerText(), /Merino crew/);
  await capture("review", { audit: true });
  await page.getByRole("button", { name: "Import records", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "The catalogue service is offline." }).waitFor();
  await capture("import-failed", { audit: true });
  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "Import records", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Importing…", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Edit mapping", exact: true }).isDisabled(), true);
  await page.locator('[data-demo="commit-import"]').evaluate((node) => node.click());
  assert.equal(await page.evaluate(() => window.imports.length), 2);
  assert.deepEqual(await page.evaluate(() => window.imports[1]), [
    { product: "Merino crew", sku: "MC-CHR-L", price: 84, email: "orders@holm.example" },
    { product: "Wool beanie", sku: "WB-RST", price: 36, email: "orders@holm.example" },
    { product: "Linen apron", sku: "LA-OAT", price: 54, email: "orders@holm.example" },
  ]);
  await capture("pending", { audit: true });
  await page.evaluate(() => window.finishImport());
  await page.getByRole("heading", { name: "Import complete", exact: true }).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0, "Earlier import failures retire after acknowledgement");
  assert.doesNotMatch(
    await page.getByRole("region", { name: "Mapped records", exact: true }).innerText(),
    /Mutated by host/,
  );
  await capture("imported", { audit: true });

  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CatalogImport initialCsv={'Product,SKU,Unit price,Supplier email\\nMerino crew,DUP,9007199254740992,not-email\\nWool beanie,DUP,-1,orders@holm.example'}/>);`,
  );
  await page.getByRole("button", { name: "Read CSV", exact: true }).click();
  const issues = await page.getByRole("alert").innerText();
  assert.match(issues, /safe range/);
  assert.match(issues, /must be unique/);
  assert.match(issues, /valid email/);
  assert.match(issues, /at least 0/);
  assert.equal(await page.getByRole("button", { name: "Review records", exact: true }).isDisabled(), true);
  await capture("record-errors", { audit: true });

  await mount(
    `window.parse=Subject.parseCatalogCsv;createRoot(document.getElementById('root')).render(<Subject.CatalogImport initialCsv={'Product,SKU\\n"Missing quote,MC-CHR'}/>);`,
  );
  await page.getByRole("button", { name: "Read CSV", exact: true }).click();
  assert.match(await page.getByRole("alert").innerText(), /missing its closing quote/);
  const parsed = await page.evaluate(() => window.parse('Product,SKU\r\n"Merino, crew",MC-CHR\r\n"Two\nlines",SECOND'));
  assert.deepEqual(parsed, {
    headers: ["Product", "SKU"],
    rows: [
      ["Merino, crew", "MC-CHR"],
      ["Two\nlines", "SECOND"],
    ],
  });
  await capture("parse-failed", { audit: true });
  assert.deepEqual(
    await page.evaluate(() => window.parse('\ufeffName,Note\r\n"Form, Studio","A ""quoted"" note\ncontinued"')),
    { headers: ["Name", "Note"], rows: [["Form, Studio", 'A "quoted" note\ncontinued']] },
  );
  for (const source of ['Name\n"unfinished', 'Name\n"closed"junk', "Name\nextra,column"]) {
    assert.equal(
      await page.evaluate((source) => {
        try {
          window.parse(source);
          return false;
        } catch {
          return true;
        }
      }, source),
      true,
      "Malformed CSV must be rejected",
    );
  }
  assert.deepEqual(
    await page.evaluate(() => {
      const sources = [
        "Name\n" + "x".repeat(200001),
        "Name\n" + "x\n".repeat(1001),
        Array.from({ length: 41 }, (_, i) => "C" + i).join(",") + "\nx",
      ];
      return sources.map((source) => {
        try {
          window.parse(source);
          return "";
        } catch (error) {
          return error.message;
        }
      });
    }),
    ["Keep the CSV below 200,000 characters.", "Import at most 1,000 records at a time.", "Use at most 40 columns."],
  );

  await mount(`createRoot(document.getElementById('root')).render(<Subject.CatalogImport/>);`);
  await page.getByRole("button", { name: "Read CSV", exact: true }).click();
  await choose(page.getByRole("combobox", { name: "Map Unit price column 3", exact: true }), "");
  assert.match(await page.getByRole("alert").innerText(), /Map the required Unit price/);
  assert.equal(await page.getByRole("button", { name: "Review records", exact: true }).isDisabled(), true);
  await choose(page.getByRole("combobox", { name: "Map Unit price column 3", exact: true }), "price");
  await page.getByRole("button", { name: "Review records", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Import records", exact: true }).isDisabled(), true);

  const manyCsv =
    "Product\n" + Array.from({ length: 25 }, (_, index) => `Product ${String(index + 1).padStart(2, "0")}`).join("\n");
  await mount(
    `window.manyImports=[];createRoot(document.getElementById('root')).render(<Subject.CatalogImport fields={[{id:'product',label:'Product',type:'text',required:true}]} initialCsv={${JSON.stringify(manyCsv)}} onImport={rows=>window.manyImports.push(rows)}/>);`,
  );
  await page.getByRole("button", { name: "Read CSV", exact: true }).click();
  await page.getByRole("button", { name: "Review records", exact: true }).click();
  const records = page.getByRole("region", { name: "Mapped records", exact: true });
  assert.match(await page.locator("section").innerText(), /25 records · 1 column\b/);
  assert.match(await records.innerText(), /Product 20/);
  assert.doesNotMatch(await records.innerText(), /Product 21/);
  await page.getByRole("button", { name: "Next rows", exact: true }).click();
  assert.match(await records.innerText(), /Product 21/);
  assert.match(await records.innerText(), /Product 25/);
  assert.doesNotMatch(await records.innerText(), /Product 01/);
  assert.equal(await page.getByRole("button", { name: "Next rows", exact: true }).isDisabled(), true);
  await capture("second-page", { audit: true });
  await page.getByRole("button", { name: "Previous rows", exact: true }).click();
  assert.match(await records.innerText(), /Product 01/);
  assert.equal(await page.getByRole("button", { name: "Previous rows", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Import records", exact: true }).click();
  await page.getByRole("heading", { name: "Import complete", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.manyImports[0].length), 25);
  assert.deepEqual(await page.evaluate(() => [window.manyImports[0][0], window.manyImports[0][24]]), [
    { product: "Product 01" },
    { product: "Product 25" },
  ]);

  await mount(`createRoot(document.getElementById('root')).render(<Subject.CatalogImport fields={[]}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /destination fields/);
  assert.equal(await page.getByRole("button", { name: "Read CSV", exact: true }).isDisabled(), true);
  await mount(
    `window.records=[];createRoot(document.getElementById('root')).render(<Subject.CatalogImport fields={[{id:'__proto__',label:'Raw',type:'text',required:true}]} initialCsv={'Raw\\nOpaque value'} onImport={rows=>window.records.push(rows)}/>);`,
  );
  await page.getByRole("button", { name: "Read CSV", exact: true }).click();
  await page.getByRole("button", { name: "Review records", exact: true }).click();
  await page.getByRole("button", { name: "Import records", exact: true }).click();
  assert.match(await page.locator("section").innerText(), /1 record · 1 column\b/);
  assert.equal(await page.evaluate(() => Object.hasOwn(window.records[0][0], "__proto__")), true);
  assert.equal(await page.evaluate(() => window.records[0][0].__proto__), "Opaque value");

  await mount(
    `function Host(){const [csv,setCsv]=React.useState('Product\\nMerino crew');window.replaceCsv=()=>setCsv('Product\\nWool beanie');return <Subject.CatalogImport initialCsv={csv} fields={[{id:'product',label:'Product',type:'text',required:true}]} onImport={()=>new Promise(resolve=>window.oldImport=resolve)}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.getByRole("button", { name: "Read CSV", exact: true }).click();
  await page.getByRole("button", { name: "Review records", exact: true }).click();
  await page.getByRole("button", { name: "Import records", exact: true }).click();
  await page.evaluate(() => window.replaceCsv());
  await page.getByRole("textbox", { name: "CSV data", exact: true }).waitFor();
  await page.evaluate(() => window.oldImport());
  assert.doesNotMatch(await page.locator("section").innerText(), /Import complete/);
}
