export async function check({ page, mount, assert }) {
  const alpha = {
    id: "alpha",
    name: "Northstar",
    kind: "iOS app",
    glyph: "triangle",
    openIssues: 4,
    issuesDelta: -2,
    cycle: { name: "Cycle 1", progress: 0.5, ends: "Friday" },
    activity: [1, 2, 3, 2, 1, 0, 1],
    recent: [],
    members: 3,
    updated: "today",
  };
  const beta = { ...alpha, id: "beta", name: "Ledger", glyph: "ledger" };
  const locked = { ...alpha, id: "locked", name: "Payroll", glyph: "shield", locked: "Mara approves access" };
  const props = `projects={${JSON.stringify([alpha, beta, locked])}}`;
  await mount(
    `window.calls=[];window.access=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.MobileProjectSwitcher ${props} onRequestAccess={p=>window.access.push(p.id)} onValueChange={async(id,p)=>{window.calls.push({id,project:p});if(window.fail)throw Error('Project offline');await new Promise(resolve=>window.finishSwitch=resolve)}}/>);`,
  );
  await page.locator('[data-demo="project-open"]').press("Enter");
  const search = page.getByRole("textbox", { name: "Search projects", exact: true });
  const dialog = page.getByRole("dialog", { name: "Switch project", exact: true });
  await dialog.waitFor();
  await page.waitForFunction(() => document.activeElement?.dataset.demo === "project-search");
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await dialog
      .getByRole("button")
      .last()
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Tab");
  assert.equal(await close.evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await page.locator('[data-demo="project-open"]').evaluate((el) => el === document.activeElement), true);
  assert.equal(await page.getByRole("textbox", { name: "Search projects", exact: true }).count(), 0);
  await page.locator('[data-demo="project-open"]').press("Enter");
  await search.waitFor();
  await page.getByRole("button", { name: "Close the project list", exact: true }).click({ position: { x: 2, y: 2 } });
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    await page.locator('[data-demo="project-open"]').evaluate((el) => el === document.activeElement),
    true,
    "Backdrop dismissal restores its opener",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator('[data-demo="project-open"]').press("Enter");
  await search.waitFor();
  await dialog.getByRole("button", { name: "Close", exact: true }).press("Enter");
  assert.equal(
    await page.getByRole("dialog", { name: "Switch project", exact: true }).count(),
    0,
    "The retiring sheet leaves the accessibility tree immediately",
  );
  const retiringRow = page.locator('[data-demo="project-row-beta"]');
  if (await retiringRow.count()) assert.equal(await retiringRow.isDisabled(), true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator('[data-demo="project-open"]').press("Enter");
  await search.waitFor();
  await search.fill("unmatched");
  await page.getByText("No project called “unmatched”", { exact: true }).waitFor();
  await search.fill("");
  await page.locator('[data-demo="project-row-locked"]').press("Enter");
  await page.getByText(/Request sent for Payroll\./).waitFor();
  assert.deepEqual(await page.evaluate(() => window.access), ["locked"]);
  assert.equal(await page.evaluate(() => window.calls.length), 0);
  await search.fill("Ledger");
  await page.locator('[data-demo="project-row-beta"]').press("Space");
  await page.getByText("Project offline", { exact: true }).waitFor();
  assert.equal(await search.inputValue(), "Ledger");
  await page.waitForFunction(() => document.activeElement?.dataset.demo === "project-row-beta", null, { timeout: 1000 });
  await page.waitForTimeout(200);
  assert.equal(
    await page.locator('[data-demo="project-row-beta"]').evaluate((el) => el === document.activeElement),
    true,
  );
  assert.match(await page.locator('[data-demo="project-row-beta"]').getAttribute("aria-label"), /Project offline/);
  await search.fill("");
  assert.match(await page.locator('[data-demo="project-open"]').getAttribute("aria-label"), /Northstar/);
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="project-row-beta"]').press("Enter");
  assert.equal(await page.locator('[data-demo="project-row-alpha"]').isDisabled(), true);
  assert.equal(await dialog.evaluate((el) => el === document.activeElement), true, "Pending rows keep focus in the dialog");
  await page.evaluate(() => window.finishSwitch());
  await page.waitForFunction(() =>
    document.querySelector('[data-demo="project-open"]').getAttribute("aria-label").includes("Ledger"),
  );
  assert.deepEqual(await page.evaluate(() => window.calls[1]), { id: "beta", project: beta });
  await mount(
    `window.access=[];window.accessFail=true;createRoot(document.getElementById('root')).render(<Subject.MobileProjectSwitcher ${props} defaultOpen onRequestAccess={async project=>{window.access.push(project);if(window.accessFail)throw Error('Request offline');await new Promise(resolve=>window.finishAccess=resolve)}}/>);`,
  );
  await page.locator('[data-demo="project-row-locked"]').press("Enter");
  await page.getByText("Request offline", { exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement?.dataset.demo === "project-row-locked", null, { timeout: 1000 });
  assert.equal(await page.getByText(/Request sent/).count(), 0);
  await page.evaluate(() => (window.accessFail = false));
  await page.locator('[data-demo="project-row-locked"]').press("Enter");
  assert.equal(await page.locator('[data-demo="project-row-beta"]').isDisabled(), true);
  assert.equal(await page.getByText(/Request sent/).count(), 0);
  await search.focus();
  await page.evaluate(() => window.finishAccess());
  await page.getByText(/Request sent for Payroll\./).waitFor();
  assert.equal(await search.evaluate((el) => el === document.activeElement), true, "Acknowledgement preserves the user's newer focus");
  assert.deepEqual(await page.evaluate(() => window.access), [locked, locked]);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileProjectSwitcher ${props} defaultOpen/>);`,
  );
  await page.locator('[data-demo="project-row-locked"]').press("Enter");
  await page.getByText("Access requests are unavailable.", { exact: true }).waitFor();
  assert.equal(await page.getByText(/Request sent/).count(), 0);
  await dialog.getByRole("button", { name: "Close", exact: true }).press("Enter");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    await page.locator('[data-demo="project-open"]').evaluate((el) => el === document.activeElement),
    true,
    "A sheet open on mount returns to its own project trigger",
  );
  await mount(`function Host(){const [open,setOpen]=useState(false);window.closeProject=()=>setOpen(false);return <Subject.MobileProjectSwitcher ${props} open={open} onOpenChange={setOpen}/>};createRoot(document.getElementById('root')).render(<Host/>);const outside=document.createElement('button');outside.textContent='Outside workspace';outside.onclick=()=>window.closeProject();document.body.append(outside);`);
  await page.locator('[data-demo="project-open"]').press("Enter");
  await search.waitFor();
  const outside = page.getByRole("button", { name: "Outside workspace", exact: true });
  await outside.click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await outside.evaluate((el) => el === document.activeElement), true, "Closing preserves outside focus ownership");
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileProjectSwitcher projects={[]}/>);`);
  await page.getByText("No projects yet", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-demo="project-open"]').count(), 0);
}
