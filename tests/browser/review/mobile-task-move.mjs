export async function check({ page, mount, assert }) {
  const statuses = [
    { id: "todo", label: "To do", kind: "todo", count: 4 },
    { id: "doing", label: "In progress", kind: "started", count: 2, limit: 2 },
    { id: "review", label: "Review", kind: "review", count: 1, limit: 3 },
    { id: "done", label: "Done", kind: "done", count: 5 },
  ];
  const task = {
    id: "task",
    key: "LED-12",
    title: "Fix invoice totals",
    assignee: "Mara",
    priority: "high",
    status: "todo",
  };
  const props = `statuses={${JSON.stringify(statuses)}} task={${JSON.stringify(task)}} undoSeconds={60}`;
  await mount(
    `window.moves=[];window.undos=[];window.backs=0;window.actions=[];window.failMove=true;window.failUndo=true;createRoot(document.getElementById('root')).render(<Subject.MobileTaskMove ${props} onBack={()=>window.backs++} onMore={task=>window.actions.push(task)} onMove={async p=>{window.moves.push(p);if(window.failMove)throw Error('Move declined');await new Promise(r=>window.finish=r)}} onUndo={async p=>{window.undos.push(p);if(window.failUndo)throw Error('Undo declined');await new Promise(resolve=>window.finishUndo=resolve)}}/>);`,
  );
  await page.getByRole("button", { name: "Back to the sprint board", exact: true }).press("Enter");
  assert.equal(await page.evaluate(() => window.backs), 1);
  const blocked = page.getByRole("radio", { name: /In progress, unavailable/ });
  assert.equal(await blocked.isDisabled(), true);
  await blocked.press("Enter");
  assert.equal(
    await page.getByRole("button", { name: "Drag the puck to a new status", exact: true }).isDisabled(),
    true,
  );
  const puck = page.getByRole("slider", { name: /^Status:/ });
  await puck.press("ArrowDown");
  assert.equal(await puck.getAttribute("aria-valuenow"), "2", "Keyboard adjustment skips the full column");
  await puck.press("Home");
  const start = await puck.boundingBox(),
    end = await page.getByRole("radio", { name: "Done", exact: true }).boundingBox();
  assert.ok(start && end);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2, end.y + end.height / 2, { steps: 16 });
  await page.mouse.up();
  await page.waitForFunction(
    () => document.querySelector('[data-demo="task-status-done"]').getAttribute("aria-checked") === "true",
  );
  await page.getByRole("radio", { name: "Review", exact: true }).press("Space");
  assert.equal(await page.getByRole("radio", { name: "Review", exact: true }).isChecked(), true);
  const note = page.getByRole("textbox", { name: "Note to post with the move", exact: true });
  await note.fill("Check the rounding");
  await page.getByRole("button", { name: "Move to Review", exact: true }).press("Enter");
  await page.getByRole("alert").filter({ hasText: "Move declined" }).waitFor();
  assert.equal(await note.inputValue(), "Check the rounding");
  await page.evaluate(() => (window.failMove = false));
  await page.getByRole("button", { name: "Try again. Move to Review", exact: true }).press("Enter");
  assert.equal(await note.isEditable(), false);
  assert.equal(await page.getByRole("radio", { name: "Done", exact: true }).isDisabled(), true);
  assert.deepEqual(
    await page.evaluate(() => window.moves),
    Array(2).fill({ task, from: "todo", to: "review", note: "Check the rounding" }),
  );
  await page.evaluate(() => window.finish());
  const undo = page.getByRole("button", { name: "Undo, back to To do", exact: true });
  await undo.waitFor();
  await page.getByRole("button", { name: "More actions", exact: true }).press("Space");
  assert.deepEqual(await page.evaluate(() => window.actions), [{ ...task, status: "review" }]);
  await undo.press("Enter");
  await page.getByRole("alert").filter({ hasText: "Undo declined" }).waitFor();
  assert.equal(await page.getByRole("radio", { name: "Review, current status", exact: true }).isChecked(), true);
  await page.evaluate(() => (window.failUndo = false));
  await undo.press("Enter");
  assert.equal(await undo.isDisabled(), true);
  assert.equal(await page.getByRole("radio", { name: "Review, current status", exact: true }).isChecked(), true);
  assert.deepEqual(
    await page.evaluate(() => window.undos),
    Array(2).fill({ task: { ...task, status: "review" }, from: "todo", to: "review" }),
  );
  await page.evaluate(() => window.finishUndo());
  await page.getByRole("radio", { name: "To do, current status", exact: true }).waitFor();
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileTaskMove statuses={[${JSON.stringify(statuses[0])}]} task={${JSON.stringify(task)}}/>);`,
  );
  assert.equal(await page.getByRole("radio").count(), 1);
  assert.equal(await page.getByRole("button", { name: "Back to the sprint board", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "More actions", exact: true }).isDisabled(), true);
  assert.equal(
    await page.getByRole("button", { name: "Drag the puck to a new status", exact: true }).isDisabled(),
    true,
  );
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileTaskMove ${props} onMove={async()=>{}}/>);`,
  );
  await page.getByRole("radio", { name: "Review", exact: true }).press("Space");
  await page.getByRole("button", { name: "Move to Review", exact: true }).press("Enter");
  await page.getByText("Moved to Review", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Undo, back to To do", exact: true }).count(),
    0,
    "A persisted move requires a matching undo handler",
  );
  await mount(
    `window.emptyBacks=0;window.emptyActions=[];createRoot(document.getElementById('root')).render(<Subject.MobileTaskMove onBack={()=>window.emptyBacks++} onMore={t=>window.emptyActions.push(t)} statuses={[]} task={${JSON.stringify(task)}}/>);`,
  );
  await page.getByText("No statuses available", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Back to the sprint board", exact: true }).press("Enter");
  await page.getByRole("button", { name: "More actions", exact: true }).press("Space");
  assert.equal(await page.evaluate(() => window.emptyBacks), 1);
  assert.deepEqual(await page.evaluate(() => window.emptyActions), [task]);
  assert.equal(await page.getByRole("radio").count(), 0);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  await checkHostCounts({ page, mount, assert });
}

async function checkHostCounts({ page, mount, assert }) {
  const task = {
    id: "task",
    key: "LED-12",
    title: "Fix invoice totals",
    assignee: "Mara",
    priority: "high",
    status: "todo",
  };
  const columns = [
    { id: "todo", label: "To do", kind: "todo", count: 4 },
    { id: "review", label: "Review", kind: "review", count: 1, limit: 3 },
  ];
  await mount(
    `function Host(){const [columns,setColumns]=useState(${JSON.stringify(columns)});return <Subject.MobileTaskMove statuses={columns} task={${JSON.stringify(task)}} undoSeconds={60} onMove={()=>new Promise(resolve=>{window.publishMove=()=>setColumns(items=>items.map(s=>({...s,count:s.id==='todo'?3:2})));window.finishMove=resolve})} onUndo={()=>new Promise(resolve=>{window.publishUndo=()=>setColumns(items=>items.map(s=>({...s,count:s.id==='todo'?4:1})));window.finishUndo=resolve})}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  const todo = page.locator('[data-demo="task-status-todo"]');
  const review = page.locator('[data-demo="task-status-review"]');
  const counts = async () => {
    const text = await review.innerText();
    const amount = text.match(/(\d+) of 3 in this column|At its limit of (\d+)/);
    return {
      todo: Number((await todo.innerText()).match(/(\d+) issues/)?.[1]),
      review: Number(amount?.[1] ?? amount?.[2]),
    };
  };
  const snapshots = [];
  const save = async (label) => snapshots.push({ label, ...(await counts()) });
  await page.getByRole("radio", { name: "Review", exact: true }).press("Space");
  await page.getByRole("button", { name: "Move to Review", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Moving to Review", exact: true }).waitFor();
  await page.evaluate(() => window.publishMove());
  await todo.getByText("3 issues", { exact: true }).waitFor();
  await save("move-published");
  await page.evaluate(() => window.finishMove());
  await page.getByText("Moved to Review", { exact: true }).waitFor();
  await save("move-acknowledged");
  await page.getByRole("button", { name: "Undo, back to To do", exact: true }).press("Enter");
  await page.evaluate(() => window.publishUndo());
  await todo.getByText("4 issues", { exact: true }).waitFor();
  await save("undo-published");
  await page.evaluate(() => window.finishUndo());
  await page.getByRole("radio", { name: "To do, current status", exact: true }).waitFor();
  await save("undo-acknowledged");
  assert.deepEqual(
    snapshots,
    [
      { label: "move-published", todo: 3, review: 2 },
      { label: "move-acknowledged", todo: 3, review: 2 },
      { label: "undo-published", todo: 4, review: 1 },
      { label: "undo-acknowledged", todo: 4, review: 1 },
    ],
    "Server-published column counts must be applied once",
  );
}
