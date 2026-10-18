export async function check({ page, mount, assert }) {
  const expectComposerVisible = async () => {
    await page.waitForFunction(() => {
      const card = document.querySelector('[data-demo="composer"]')?.getBoundingClientRect();
      const post = document.querySelector('[data-demo="post"]')?.getBoundingClientRect();
      return card && post && card.left >= 0 && card.right <= innerWidth && post.right <= innerWidth;
    });
    await page.waitForTimeout(200);
    const card = await page.locator('[data-demo="composer"]').boundingBox();
    const post = await page.locator('[data-demo="post"]').boundingBox();
    assert.ok(
      card &&
        post &&
        card.x >= 0 &&
        card.x + card.width <= page.viewportSize().width &&
        post.x + post.width <= page.viewportSize().width,
      "The full composer and Post action remain visible",
    );
  };
  const notes = [
    { id: "one", x: 0.3, y: 0.25, author: "Mara", initials: "MA", text: "Keep the heading aligned", time: "1h" },
  ];
  await mount(
    `window.resolves=[];window.adds=[];window.failResolve=true;window.failAdd=true;createRoot(document.getElementById('root')).render(<Subject.MobileReviewAnnotations annotations={${JSON.stringify(notes)}} onResolve={async(id,resolved)=>{window.resolves.push({id,resolved});if(window.failResolve)throw Error('Review offline')}} onAdd={async draft=>{window.adds.push(draft);if(window.failAdd)throw Error('Comment not synced');await new Promise(resolve=>window.finishAdd=()=>resolve({id:'saved',...draft,author:'You',initials:'JA',time:'now'}))}}/>);`,
  );
  await page.getByRole("button", { name: "Resolve comment 1", exact: true }).press("Enter");
  await page.getByText("Review offline", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Resolve comment 1", exact: true }).waitFor();
  await page.evaluate(() => (window.failResolve = false));
  await page.getByRole("button", { name: "Resolve comment 1", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Reopen comment 1", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.resolves), [
    { id: "one", resolved: true },
    { id: "one", resolved: true },
  ]);
  assert.equal(await page.getByRole("button", { name: "Cancel", exact: true }).count(), 0);
  assert.equal(
    await page.locator('[aria-label="Cancel"]').isDisabled(),
    true,
    "The closed placement hint cannot take focus",
  );
  await page.getByRole("button", { name: "Add a comment", exact: true }).press("Enter");
  const canvas = page.getByRole("button", { name: "Place a comment here", exact: true });
  const box = await canvas.boundingBox();
  assert.ok(box);
  await canvas.click({ position: { x: box.width * 0.45, y: box.height * 0.4 } });
  const comment = page.getByRole("textbox", { name: "Comment", exact: true });
  await comment.fill("Please add more space above this line.");
  await expectComposerVisible();
  await page.getByRole("button", { name: "Post comment", exact: true }).press("Enter");
  await page.getByRole("alert").filter({ hasText: "Comment not synced" }).waitFor();
  await expectComposerVisible();
  assert.equal(await comment.inputValue(), "Please add more space above this line.");
  await page.evaluate(() => (window.failAdd = false));
  await page.getByRole("button", { name: "Post comment", exact: true }).press("Enter");
  assert.equal(await page.getByRole("button", { name: "Post comment", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Discard comment", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Stop adding a comment", exact: true }).isDisabled(), true);
  await expectComposerVisible();
  await page.evaluate(() => window.finishAdd());
  await page.getByRole("button", { name: "Comment 2 by You", exact: true }).waitFor();
  const calls = await page.evaluate(() => window.adds);
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(calls[1].text, "Please add more space above this line.");
  assert.ok(Math.abs(calls[1].x - 0.45) < 0.03 && Math.abs(calls[1].y - 0.4) < 0.03);
  await mount(
    `window.resolveCalls=[];createRoot(document.getElementById('root')).render(<Subject.MobileReviewAnnotations annotations={${JSON.stringify(notes)}} onResolve={(id,resolved)=>new Promise(resolve=>{window.resolveCalls.push({id,resolved});window.finishResolve=resolve})}/>);`,
  );
  await page.getByRole("button", { name: "Resolve comment 1", exact: true }).press("Enter");
  assert.equal(await page.getByRole("button", { name: "Reopen comment 1", exact: true }).isDisabled(), true);
  assert.deepEqual(await page.evaluate(() => window.resolveCalls), [{ id: "one", resolved: true }]);
  await page.evaluate(() => window.finishResolve());
  await page.waitForFunction(
    () => document.querySelector('[data-demo="resolve-1"]').getAttribute("aria-disabled") !== "true",
  );
  await mount(
    `window.keyboardDraft=null;createRoot(document.getElementById('root')).render(<Subject.MobileReviewAnnotations annotations={[]} accent="#1A1A1A" onAdd={draft=>{window.keyboardDraft=draft}}/>);`,
  );
  assert.equal(await page.locator('[data-demo^="pin-"]').count(), 0);
  await page.getByRole("button", { name: "Add a comment", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Place a comment here", exact: true }).press("Enter");
  await page.getByRole("textbox", { name: "Comment", exact: true }).waitFor();
  await comment.fill("First note");
  await page.getByRole("button", { name: "Post comment", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Comment 1 by You", exact: true }).waitFor();
  const keyboard = await page.evaluate(() => window.keyboardDraft);
  assert.ok(Number.isFinite(keyboard.x) && Number.isFinite(keyboard.y));
  assert.ok(keyboard.x >= 0 && keyboard.x <= 1 && keyboard.y >= 0 && keyboard.y <= 1);
  await page.getByRole("button", { name: "Add a comment", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Place a comment here", exact: true }).press("Enter");
  await comment.waitFor();
  await page.getByRole("button", { name: "Discard comment", exact: true }).press("Enter");
  assert.equal(await page.getByRole("textbox", { name: "Comment", exact: true }).count(), 0);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileReviewAnnotations aspectRatio={NaN} annotations={[{...${JSON.stringify(notes[0])},x:NaN},{...${JSON.stringify(notes[0])},id:'outside',y:2}]}/>);`,
  );
  assert.equal(await page.locator('[data-demo^="pin-"]').count(), 0);
  await page.getByText("No comments", { exact: true }).waitFor();
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|1 of 0/);
}
