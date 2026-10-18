// Restore, host-replacement, diff and accessibility regression coverage.
export async function check({ page, mount, assert, capture = async () => {} }) {
  await page.setViewportSize({ width: 1440, height: 1300 });
  const blocks = [
    { id: "title", kind: "title", label: "Title" },
    { id: "body", kind: "paragraph", label: "Body" },
  ];
  const current = {
    id: "live",
    author: { name: "Mara" },
    day: "Today",
    time: "12:00",
    content: { title: "Current heading", body: "Current body" },
  };
  const versions = [
    {
      id: "old",
      name: "Reviewed draft",
      author: { name: "Ellis" },
      day: "Yesterday",
      time: "10:00",
      content: { title: "Earlier heading", body: "Earlier body" },
    },
  ];
  const props = `blocks={${JSON.stringify(blocks)}} current={${JSON.stringify(current)}} versions={${JSON.stringify(versions)}} defaultVersionId="old"`;
  await mount(
    `window.requests=[];window.undos=[];window.fail=true;window.diffWords=Subject.diffWords;createRoot(document.getElementById('root')).render(<Subject.EditorVersionRestore ${props} onRestore={async request=>{window.requests.push(structuredClone(request));request.content.title='Host mutation';request.content.body='Unexpected extra block';request.blockIds.push('body');request.versionId='wrong';if(window.fail)throw Error('The document store is offline.');await new Promise(resolve=>window.finishRestore=resolve)}} onUndo={request=>window.undos.push(structuredClone(request))}/>);`,
  );
  for (const [from, to] of [
    ["same old words", "same new words"],
    ["", "new paragraph"],
    ["snow 雪", "snow big 雪"],
    ["same", "same"],
  ]) {
    const result = await page.evaluate(
      ([from, to]) => window.diffWords(from, to),
      [from, to],
    );
    assert.equal(
      result
        .filter((part) => part.kind !== "add")
        .map((part) => part.text)
        .join(""),
      from,
    );
    assert.equal(
      result
        .filter((part) => part.kind !== "del")
        .map((part) => part.text)
        .join(""),
      to,
    );
  }
  const pick = () =>
    page.getByRole("checkbox", {
      name: "Restore title from this version",
      exact: true,
    });
  const restore = () => page.locator('[data-demo="restore"]');
  await pick().press("Space");
  await restore().press("Enter");
  await page
    .getByRole("status")
    .filter({ hasText: "The document store is offline." })
    .waitFor();
  assert.equal(await pick().isChecked(), true);
  assert.deepEqual(await page.evaluate(() => window.requests[0]), {
    versionId: "old",
    blockIds: ["title"],
    content: { title: "Earlier heading" },
  });
  await capture("restore-failed", { audit: true });
  await page.evaluate(() => (window.fail = false));
  await restore().press("Enter");
  await page.waitForFunction(() => typeof window.finishRestore === "function");
  assert.equal(await pick().isDisabled(), true);
  await restore().evaluate((node) => node.click());
  assert.equal(await page.evaluate(() => window.requests.length), 2);
  await capture("pending", { audit: true });
  await page.evaluate(() => window.finishRestore());
  await page
    .getByRole("status")
    .filter({ hasText: "Restored 1 block" })
    .waitFor();
  const slider = () =>
    page.getByRole("slider", { name: "Version", exact: true });
  await slider().press("End");
  await page.waitForTimeout(600);
  const liveArticle = page.getByRole("article", {
    name: "Current document",
    exact: true,
  });
  await liveArticle.getByText("Earlier heading", { exact: true }).waitFor();
  await liveArticle.getByText("Current body", { exact: true }).waitFor();
  assert.doesNotMatch(
    await liveArticle.innerText(),
    /Host mutation|Unexpected extra block/,
  );
  await capture("partial-restore", { audit: true });
  await page.locator('[data-demo="undo"]').click();
  await liveArticle.getByText("Current heading", { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.undos), [
    {
      versionId: "old",
      blockIds: ["title"],
      content: { title: "Earlier heading" },
    },
  ]);
  await capture("undone", { audit: true });
  await slider().press("Home");
  assert.match(await slider().getAttribute("aria-valuetext"), /Reviewed draft/);
  await slider().press("End");
  assert.match(
    await slider().getAttribute("aria-valuetext"),
    /Current version/,
  );
  assert.equal(await restore().isDisabled(), true);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorVersionRestore blocks={${JSON.stringify(blocks)}} current={${JSON.stringify(current)}} versions={[]}/>);`,
  );
  await page
    .getByRole("article", { name: "Current document", exact: true })
    .getByText("Current heading", { exact: true })
    .waitFor();
  assert.equal(await restore().isDisabled(), true);
  await capture("no-saved-versions", { audit: true });
  await mount(
    `window.whole=[];createRoot(document.getElementById('root')).render(<Subject.EditorVersionRestore blocks={${JSON.stringify(blocks)}} current={${JSON.stringify(current)}} versions={[{...${JSON.stringify(versions[0])},content:{title:'Only earlier title'}}]} onRestore={request=>window.whole.push(structuredClone(request))}/>);`,
  );
  assert.equal(
    await page
      .getByRole("checkbox", {
        name: "Restore body from this version",
        exact: true,
      })
      .count(),
    0,
  );
  await restore().click();
  await page
    .getByRole("status")
    .filter({ hasText: "Restored 1 block" })
    .waitFor();
  assert.deepEqual(await page.evaluate(() => window.whole[0]), {
    versionId: "old",
    blockIds: ["title"],
    content: { title: "Only earlier title" },
  });
  await capture("missing-block", { audit: true });
  await mount(
    `function Host(){const [live,setLive]=React.useState(${JSON.stringify(current)});window.replaceDocument=()=>setLive({...${JSON.stringify(current)},id:'external',content:{title:'External revision',body:'External body'}});return <Subject.EditorVersionRestore blocks={${JSON.stringify(blocks)}} current={live} versions={${JSON.stringify(versions)}} onRestore={()=>new Promise(resolve=>window.finishOldRestore=resolve)}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await restore().click();
  await page.waitForFunction(
    () => typeof window.finishOldRestore === "function",
  );
  await page.evaluate(() => window.replaceDocument());
  await page.evaluate(() => window.finishOldRestore());
  await slider().press("End");
  await page
    .getByRole("article", { name: "Current document", exact: true })
    .getByText("External revision", { exact: true })
    .waitFor();
  assert.doesNotMatch(
    await page.locator("section").innerText(),
    /Restored 2 blocks/,
  );
  await capture('replacement-document', {audit:true});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.EditorVersionRestore ${props}/>);`);
  await restore().click();
  await page.getByRole('status').filter({hasText:'Restored 2 blocks'}).waitFor();
  await slider().press('End');
  await page.waitForTimeout(600);
  const local = page.getByRole('article',{name:'Current document',exact:true});
  await local.getByText('Earlier heading',{exact:true}).waitFor();
  await local.getByText('Earlier body',{exact:true}).waitFor();
  await capture('local-restore',{audit:true});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.default accent="#777777"/>);`);
  await capture('mid-grey-accent',{audit:true});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.default accent="not-a-color"/>);`);
  assert.notEqual(await restore().evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)');
  await capture('invalid-accent-fallback',{audit:true});

}
