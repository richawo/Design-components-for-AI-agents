export async function check({ page, mount, assert }) {
  const project = {
    name: "Autumn campaign",
    start: "2026-10-20",
    end: "2027-02-28",
    uses: [
      { id: "feed", label: "Instagram feed", aspect: [4, 5], detail: "4 : 5" },
      { id: "story", label: "Instagram story", aspect: [9, 16], detail: "9 : 16" },
    ],
  };
  const asset = {
    id: "tide",
    title: "Low tide",
    creator: "Ines Moreau",
    year: "2025",
    medium: "Photograph",
    holder: "Northlight",
    licence: "Rights-managed",
    reference: "NL-25-0815",
    territory: "UK & EU",
    termStart: "2026-09-01",
    termEnd: "2027-06-30",
    covers: ["feed"],
    credit: "Photo: Ines Moreau / Northlight",
    size: [6000, 4000],
    defaultUses: ["feed"],
  };
  const other = { ...asset, id: "frost", title: "First frost", covers: ["feed", "story"], defaultUses: [] };
  const props = `project={${JSON.stringify(project)}} assets={${JSON.stringify([asset, other])}.map(a=>({...a,media:<svg aria-hidden="true" viewBox="0 0 3 2"><rect width="3" height="2" fill="#777"/></svg>}))}`;
  await mount(
    `window.added=[];window.requests=[];window.assets=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.EditorAssetLicenseSheet ${props} onAssetChange={id=>window.assets.push(id)} onAdd={async request=>{window.added.push(request);if(window.fail)throw Error('Campaign not saved');await new Promise(resolve=>window.finishAdd=resolve)}} onRequest={async request=>{window.requests.push(request);if(window.fail)throw Error('Rights holder is unavailable')}}/>);`,
  );
  const feed = page.locator('[data-demo="check-feed"]'),
    story = page.locator('[data-demo="check-story"]');
  assert.equal(await feed.isChecked(), true);
  await story.focus();
  await page.getByText("9 : 16 crop", { exact: false }).waitFor();
  await story.press("Space");
  await page.locator('[data-demo="action"]').press("Enter");
  await page.getByRole("status").filter({ hasText: "Rights holder is unavailable" }).waitFor();
  assert.equal(await story.isChecked(), true);
  assert.deepEqual(await page.evaluate(() => window.requests[0]), {
    assetId: "tide",
    useIds: ["feed", "story"],
    action: "request",
    blocked: [{ useId: "story", reason: "not-licensed" }],
  });
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="action"]').press("Enter");
  await page.getByRole("button", { name: "Request sent", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.requests[1]), await page.evaluate(() => window.requests[0]));
  await page.locator('[data-demo="asset-tide"]').press("ArrowRight");
  assert.equal(await page.locator('[data-demo="asset-frost"]').getAttribute("aria-checked"), "true");
  await page.locator('[data-demo="asset-frost"]').press("ArrowLeft");
  assert.equal(await story.isChecked(), true, "Returning to an asset retains its placement choices");
  await story.press("Space");
  await page.evaluate(() => (window.fail = true));
  await page.locator('[data-demo="action"]').press("Enter");
  await page.getByRole("status").filter({ hasText: "Campaign not saved" }).waitFor();
  assert.equal(await feed.isChecked(), true);
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="action"]').press("Enter");
  await page.waitForFunction(() => typeof window.finishAdd === "function");
  assert.equal(await feed.isDisabled(), true, "A pending submission owns its exact placement selection");
  assert.equal(await story.isDisabled(), true);
  assert.equal(await page.locator('[data-demo="asset-frost"]').isDisabled(), true);
  assert.equal(await page.locator('[data-demo="action"]').isDisabled(), true);
  await page.evaluate(() => window.finishAdd());
  await page.getByRole("button", { name: "Added", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.added[1]), {
    assetId: "tide",
    useIds: ["feed"],
    action: "add",
    blocked: [],
  });
  assert.deepEqual(await page.evaluate(() => window.assets), ["frost", "tide"]);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.EditorAssetLicenseSheet ${props}/>);`);
  assert.equal(
    await page.locator('[data-demo="action"]').isDisabled(),
    true,
    "An absent host action cannot acknowledge an addition",
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorAssetLicenseSheet project={${JSON.stringify(project)}} assets={[]}/>);`,
  );
  await page.getByText("No assets in Autumn campaign yet", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-demo="action"]').count(), 0);

  // Real dates and the complete campaign window decide the request, not just the end date.
  const late = { ...asset, termStart: "2026-11-01" };
  await mount(
    `window.sent=[];createRoot(document.getElementById('root')).render(<Subject.EditorAssetLicenseSheet project={${JSON.stringify(project)}} assets={[{...${JSON.stringify(late)},media:<div/>}]} onRequest={r=>window.sent.push(r)}/>);`,
  );
  await page.getByText("From 1 Nov", { exact: true }).waitFor();
  await page.locator('[data-demo="action"]').press("Enter");
  assert.deepEqual(await page.evaluate(() => window.sent[0].blocked), [{ useId: "feed", reason: "term-starts" }]);
  await mount(
    `window.results={};const project=${JSON.stringify(project)},asset=${JSON.stringify(asset)},use=project.uses[0];window.results.start=Subject.licenceStatus({...asset,termStart:project.start,termEnd:project.end},use,project);window.results.end=Subject.licenceStatus({...asset,termEnd:'2027-02-27'},use,project);try{Subject.licenceStatus({...asset,termEnd:'2027-02-30'},use,project)}catch(error){window.results.invalid=error.name};createRoot(document.getElementById('root')).render(<p>Checked dates</p>);`,
  );
  assert.deepEqual(await page.evaluate(() => window.results), {
    start: "cleared",
    end: "term-ends",
    invalid: "RangeError",
  });

  // A host replacement retires the pending receipt, even if the old promise later resolves.
  await mount(
    `window.sent=[];function Host(){const [project,setProject]=useState(${JSON.stringify(project)});window.replace=()=>setProject(p=>({...p,name:'Winter campaign'}));return <Subject.EditorAssetLicenseSheet project={project} assets={[{...${JSON.stringify(asset)},media:<div/>}]} onAdd={r=>{window.sent.push(r);return new Promise(resolve=>window.finish=resolve)}}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.locator('[data-demo="action"]').press("Enter");
  await page.waitForFunction(() => typeof window.finish === "function");
  await page.evaluate(() => window.replace());
  await page.getByRole("button", { name: "Add to Winter campaign", exact: true }).waitFor();
  await page.evaluate(() => window.finish());
  await page.waitForTimeout(300);
  assert.equal(await page.getByRole("button", { name: "Added", exact: true }).count(), 0);
  assert.equal(await page.locator('[data-demo="check-feed"]').isDisabled(), false);

  // Newly arriving assets get their defaults, normalized into known project order.
  await mount(
    `function Host(){const [assets,setAssets]=useState([]);window.arrive=()=>setAssets([{...${JSON.stringify(asset)},defaultUses:['story','unknown','feed','feed'],media:<div/>},{...${JSON.stringify(other)},media:<div/>}]);return <Subject.EditorAssetLicenseSheet project={${JSON.stringify(project)}} assets={assets} onRequest={r=>window.sent=r}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.evaluate(() => window.arrive());
  assert.equal(await page.locator('[data-demo="check-feed"]').isChecked(), true);
  assert.equal(await page.locator('[data-demo="check-story"]').isChecked(), true);
  await page.locator('[data-demo="asset-tide"]').press("End");
  assert.equal(await page.locator('[data-demo="asset-frost"]').getAttribute("aria-checked"), "true");
  await page.locator('[data-demo="asset-frost"]').press("Home");
  await page.locator('[data-demo="action"]').press("Enter");
  assert.deepEqual(await page.evaluate(() => window.sent.useIds), ["feed", "story"]);

  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorAssetLicenseSheet project={{...${JSON.stringify(project)},uses:[]}} assets={[{...${JSON.stringify(asset)},media:<div/>}]}/>);`,
  );
  await page.getByText("No placements planned for this campaign.", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-demo="action"]').isDisabled(), true);
  for (const patch of [
    { termEnd: "2027-02-30" },
    { termStart: "2028-01-01" },
    { size: [0, 4000] },
    { focus: [2, 0] },
  ]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.EditorAssetLicenseSheet project={${JSON.stringify(project)}} assets={[{...${JSON.stringify({ ...asset, ...patch })},media:<div/>}]}/>);`,
    );
    await page.getByRole("alert").filter({ hasText: "Licence sheet unavailable" }).waitFor();
    assert.equal(await page.locator('[data-demo="action"]').count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  }
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorAssetLicenseSheet project={{...${JSON.stringify(project)},uses:[${JSON.stringify(project.uses[0])},${JSON.stringify(project.uses[0])}]}} assets={[]}/>);`,
  );
  await page.getByRole("alert").waitFor();
}
