export async function check({ page, mount, assert }) {
  const current = { name: "main", author: "Mara", updated: "2 h ago" },
    incoming = { name: "tone", author: "Theo", updated: "1 h ago" };
  const blocks = [
    { id: "title", kind: "title", label: "Page title", current: "Simple pricing", incoming: "Pricing that grows" },
    { id: "same", kind: "paragraph", current: "Always included", incoming: "Always included" },
    { id: "add", kind: "item", label: "New feature", incoming: "New feature" },
    { id: "remove", kind: "item", label: "Legacy support", current: "Legacy support" },
  ];
  const props = `current={${JSON.stringify(current)}} incoming={${JSON.stringify(incoming)}} blocks={${JSON.stringify(blocks)}}`;
  const choices = { title: "current", add: "incoming", remove: "incoming" };
  const expected = {
    choices,
    blocks: [
      { id: "title", kind: "title", text: "Simple pricing" },
      { id: "same", kind: "paragraph", text: "Always included" },
      { id: "add", kind: "item", text: "New feature" },
    ],
  };
  await page.setViewportSize({ width: 390, height: 1600 });
  await mount(
    `window.changes=[];window.sent=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.EditorBranchCompare ${props} onChange={c=>window.changes.push(c)} onMerge={r=>{window.sent.push(r);if(window.fail)return Promise.reject(Error('Revision could not be saved'));return new Promise(resolve=>window.finish=resolve)}}/>);`,
  );
  assert.equal(await page.locator('[data-demo="merge"]').isDisabled(), true);
  await page.getByRole("radio", { name: "Result", exact: true }).press("Enter");
  await page.getByRole("button", { name: /Unresolved.*Page title.*choose a side/ }).press("Enter");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "keep-title");
  await page.locator('[data-demo="keep-title"]').press("ArrowRight");
  assert.equal(await page.locator('[data-demo="take-title"]').getAttribute("aria-checked"), "true");
  await page.locator('[data-demo="take-title"]').press("Home");
  assert.equal(await page.locator('[data-demo="keep-title"]').getAttribute("aria-checked"), "true");
  await page.locator('[data-demo="keep-add"]').press("End");
  await page.locator('[data-demo="keep-remove"]').press("ArrowDown");
  assert.deepEqual(await page.evaluate(() => window.changes.at(-1)), choices);
  assert.equal(await page.evaluate(() => window.changes.length), 4, "Each keyboard choice publishes once");
  const path = page.getByRole("slider", { name: "Scrub changes" });
  await path.press("Home");
  assert.equal(await path.getAttribute("aria-valuenow"), "1");
  await path.press("End");
  assert.equal(await path.getAttribute("aria-valuenow"), "3");
  await path.scrollIntoViewIfNeeded();
  const box = await path.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + 25, box.y + 26);
  await page.mouse.down();
  await page.mouse.move(box.x + 25, box.y + 78, { steps: 4 });
  await page.mouse.up();
  assert.equal(await path.getAttribute("aria-valuenow"), "2");
  await page.getByRole("radio", { name: "Compare", exact: true }).press("End");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "view-result");
  assert.equal(
    await page.getByRole("radio", { name: "Keep main", exact: true }).count(),
    0,
    "Retired comparison controls are hidden from interaction",
  );
  await page.getByRole("region", { name: "Merged document preview", exact: true }).waitFor();
  await page.getByText("Simple pricing", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: /Unresolved/ }).count(), 0);
  await page.locator('[data-demo="merge"]').press("Enter");
  await page.getByRole("status").filter({ hasText: "Revision could not be saved" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.sent[0]), expected);
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="merge"]').press("Enter");
  await page.waitForFunction(() => typeof window.finish === "function");
  assert.equal(await page.locator('[data-demo="merge"]').isDisabled(), true);
  assert.equal(await page.locator('[data-demo="take-all"]').isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Keep main", exact: true }).isDisabled(), true);
  await page.getByRole("radio", { name: "Result", exact: true }).press("Home");
  await page.locator('[data-demo="keep-title"]').waitFor();
  assert.equal(await page.locator('[data-demo="take-title"]').isDisabled(), true);
  await page.evaluate(() => window.finish());
  await page.getByRole("button", { name: "Merged", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.sent[1]), expected);
  assert.equal(await page.locator('[data-demo="keep-title"]').getAttribute("aria-checked"), "true");

  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorBranchCompare ${props} defaultChoices={${JSON.stringify(choices)}}/>);`,
  );
  assert.equal(await page.locator('[data-demo="merge"]').isDisabled(), true);
  await page.getByRole("status").filter({ hasText: "Merging is unavailable." }).waitFor();
  await mount(
    `window.sent=[];createRoot(document.getElementById('root')).render(<Subject.EditorBranchCompare ${props} defaultChoices={{title:'unknown',add:'incoming',remove:'incoming',missing:'current'}} onMerge={r=>window.sent.push(r)}/>);`,
  );
  assert.equal(await page.locator('[data-demo="merge"]').isDisabled(), true);
  await page.locator('[data-demo="keep-title"]').press("Enter");
  await page.locator('[data-demo="merge"]').press("Enter");
  assert.deepEqual(await page.evaluate(() => window.sent[0]), expected);

  await mount(
    `window.changes=[];function Host(){const [blocks,setBlocks]=useState(${JSON.stringify(blocks)});window.replace=()=>setBlocks(b=>b.map(block=>({...block,incoming:block.id==='title'?'A replacement revision':block.incoming})));return <Subject.EditorBranchCompare current={${JSON.stringify(current)}} incoming={${JSON.stringify(incoming)}} blocks={blocks} defaultChoices={${JSON.stringify(choices)}} onChange={c=>window.changes.push(c)} onMerge={()=>new Promise(resolve=>window.finish=resolve)}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.locator('[data-demo="merge"]').press("Enter");
  await page.waitForFunction(() => typeof window.finish === "function");
  await page.evaluate(() => window.replace());
  await page.waitForFunction(() => window.changes.length === 1);
  assert.deepEqual(await page.evaluate(() => window.changes), [{}]);
  assert.equal(await page.locator('[data-demo="merge"]').isDisabled(), true);
  assert.equal(await page.locator('[data-demo="keep-title"]').getAttribute("aria-checked"), "false");
  await page.evaluate(() => window.finish());
  await page.waitForTimeout(300);
  assert.equal(await page.getByRole("button", { name: "Merged", exact: true }).count(), 0);
  assert.equal(await page.locator('[data-demo="take-title"]').isDisabled(), false);
  await page.locator('[data-demo="take-all"]').press("Enter");
  assert.deepEqual(await page.evaluate(() => window.changes.at(-1)), {
    title: "incoming",
    add: "incoming",
    remove: "incoming",
  });
  await page.getByRole("button", { name: "Keep main", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.changes.at(-1)), {
    title: "current",
    add: "current",
    remove: "current",
  });

  // Opaque ids stay data, and callback mutation cannot change the selected side.
  const unusual = [
    { id: "__proto__", kind: "paragraph", current: "Before", incoming: "After" },
    { id: 'a"[]', kind: "paragraph", current: "Another", incoming: "Revision" },
  ];
  await mount(
    `window.sent=[];createRoot(document.getElementById('root')).render(<Subject.EditorBranchCompare blocks={${JSON.stringify(unusual)}} onChange={c=>{c['__proto__']='current'}} onMerge={r=>window.sent.push(r)}/>);`,
  );
  await page.locator('[data-demo="take-all"]').press("Enter");
  await page.locator('[data-demo="merge"]').press("Enter");
  assert.deepEqual(await page.evaluate(() => Object.keys(window.sent[0].choices)), ["__proto__", 'a"[]']);
  assert.deepEqual(await page.evaluate(() => window.sent[0].blocks.map((b) => b.text)), ["After", "Revision"]);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.EditorBranchCompare blocks={[]}/>);`);
  await page.getByText("No document blocks to compare", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-demo="merge"]').count(), 0);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorBranchCompare blocks={[{id:'same',kind:'paragraph',current:'Same',incoming:'Same'}]}/>);`,
  );
  await page.getByText("The branches match. Nothing to merge.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "No changes to merge", exact: true }).isDisabled(), true);
  for (const invalid of [
    [blocks[0], blocks[0]],
    [{ id: "bad", kind: "paragraph", current: 3 }],
    [{ id: "none", kind: "item" }],
  ]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.EditorBranchCompare blocks={${JSON.stringify(invalid)}}/>);`,
    );
    await page.getByRole("alert").filter({ hasText: "Branch comparison unavailable" }).waitFor();
    assert.equal(await page.locator('[data-demo="merge"]').count(), 0);
  }
}
