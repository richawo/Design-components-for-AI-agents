export async function check({ page, mount, assert, capture = async () => {} }) {
  await mount(
    `window.diff=Subject.compareRevisions;window.restored=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.VersionHistory onRestore={async revision=>{window.restored.push(structuredClone(revision));if(window.fail)throw Error('The document service is offline.');revision.text='Mutated by host';return new Promise(resolve=>window.finishRestore=resolve)}}/>);`,
  );
  const revision = (index) => page.locator('[data-demo="revision-' + index + '"]');
  const lines = await page.evaluate(() => window.diff("A\nB\nA", "A\nA\nC"));
  assert.equal(
    lines
      .filter((line) => line.kind !== "added")
      .map((line) => line.text)
      .join("\n"),
    "A\nB\nA",
  );
  assert.equal(
    lines
      .filter((line) => line.kind !== "removed")
      .map((line) => line.text)
      .join("\n"),
    "A\nA\nC",
  );
  assert.equal(await page.evaluate(() => window.diff("x".repeat(100001), "x")), null);
  assert.equal(await page.evaluate(() => window.diff(Array(401).fill("x").join("\n"), "x")), null);
  await revision(1).focus();
  await revision(1).press("Home");
  assert.equal(await revision(0).getAttribute("aria-pressed"), "true");
  await revision(0).press("End");
  assert.equal(await revision(2).getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByRole("button", { name: "Restore this revision", exact: true }).isDisabled(), true);
  await revision(2).press("ArrowUp");
  assert.equal(await revision(1).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Text", exact: true }).click();
  assert.match(
    await page.getByRole("region", { name: "Revision comparison", exact: true }).innerText(),
    /Each party will nominate one review contact/,
  );
  await capture("selected-text", { audit: true });
  await page.getByRole("button", { name: "Changes", exact: true }).click();
  await page.getByRole("button", { name: "Restore this revision", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.restored), []);
  await page.getByRole("button", { name: "Confirm restore", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "The document service is offline." }).waitFor();
  assert.equal(await page.evaluate(() => window.restored[0].id), "r2");
  await capture("restore-failed", { audit: true });
  await page.evaluate(() => {
    window.realFrame = requestAnimationFrame;
    window.heldFrames = [];
    window.requestAnimationFrame = (callback) => {
      window.heldFrames.push(callback);
      return window.heldFrames.length;
    };
  });
  try {
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Restore this revision", exact: true })
        .evaluate((node) => node === document.activeElement),
      true,
      "Cancel restores focus before the next frame",
    );
  } finally {
    await page.evaluate(() => {
      window.requestAnimationFrame = window.realFrame;
      for (const callback of window.heldFrames) window.realFrame(callback);
    });
  }
  await page.getByRole("button", { name: "Restore this revision", exact: true }).click();
  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "Confirm restore", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Restoring…", exact: true }).isDisabled(), true);
  assert.equal(await revision(0).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Cancel", exact: true }).isDisabled(), true);
  await page.locator('[data-demo="confirm-restore"]').evaluate((node) => node.click());
  assert.equal(await page.evaluate(() => window.restored.length), 2);
  await capture("pending", { audit: true });
  await page.evaluate(() => window.finishRestore());
  await page.getByRole("status").filter({ hasText: "Restoration completed · Revision 2" }).waitFor();
  assert.doesNotMatch(
    await page.getByRole("region", { name: "Revision comparison", exact: true }).innerText(),
    /Mutated by host/,
  );
  assert.equal(await page.getByRole("alert").count(), 0);
  await capture("restored", { audit: true });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.VersionHistory versions={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /No revision history yet/);
  assert.doesNotMatch(await page.locator("section").innerText(), /0 lines added/);
  await capture("empty", { audit: true });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.VersionHistory currentId="missing"/>);`);
  assert.match(await page.getByRole("alert").innerText(), /not in this history/);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.VersionHistory versions={[{id:'same',label:'First',author:'A',date:'Today',summary:'First',text:'A'},{id:'same',label:'Second',author:'B',date:'Today',summary:'Second',text:'B'}]}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /unique/);
  await capture("invalid-history", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.VersionHistory versions={[{id:'before',label:'Before',author:'A',date:'Today',summary:'Before',text:'A'},{id:'after',label:'After',author:'B',date:'Today',summary:'After',text:'x'.repeat(100001)}]} onRestore={()=>{}}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /comparison limit/);
  assert.match(await page.locator("section").innerText(), /Comparison unavailable/);
  assert.doesNotMatch(await page.locator("section").innerText(), /0 lines added/);
  await mount(
    `function Host(){const [versions,setVersions]=React.useState([{id:'before',label:'Before',author:'A',date:'Today',summary:'Before',text:'Original'},{id:'current',label:'Current',author:'B',date:'Today',summary:'Current',text:'Latest'}]);window.replaceRevision=()=>setVersions(old=>old.map(item=>item.id==='before'?{...item,text:'Revised upstream'}:item));return <Subject.VersionHistory versions={versions} onRestore={()=>new Promise(resolve=>window.oldRestore=resolve)}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.getByRole("button", { name: "Restore this revision", exact: true }).click();
  await page.getByRole("button", { name: "Confirm restore", exact: true }).click();
  await page.evaluate(() => window.replaceRevision());
  await page.getByText("Revised upstream", { exact: false }).waitFor();
  await page.evaluate(() => window.oldRestore());
  assert.doesNotMatch(await page.locator("section").innerText(), /Restoration completed/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
  await revision(0).click();
  await page.getByRole("button", { name: "Restore this revision", exact: true }).click();
  await page.getByRole("button", { name: "Confirm restore", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Restoration completed · Revision 1" }).waitFor();
  assert.equal(await page.locator('[data-demo^="revision-"]').count(), 4);
  assert.match(await page.locator("header").innerText(), /Current · Revision 4/);
  await capture("new-current", { audit: true });
}
