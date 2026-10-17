export async function check({ page, mount, assert }) {
  const d = (name) => page.locator(`[data-demo="${name}"]`);
  const footer = () => page.locator("footer").innerText();
  await mount(
    `window.calls=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.SavedViews onSave={async p=>{window.calls.push(p);if(window.fail)throw Error('offline')}}/>);`,
  );
  // A filter applies to the table straight away and shows up in the diff.
  assert.match(await page.locator("tfoot").innerText(), /10\s+accounts/);
  await d("add-filter").click();
  await d("option-health-below-60").click();
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 6);
  assert.match(await page.getByRole("list", { name: "Unsaved changes" }).innerText(), /Health below 60/);
  // A rejected save keeps the draft and says so.
  await d("save").click();
  await page.getByRole("alert").filter({ hasText: "offline" }).waitFor();
  assert.match(await footer(), /Your changes are kept/);
  assert.equal(await page.getByRole("button", { name: "Remove filter: Health below 60" }).count(), 1);
  await page.evaluate(() => (window.fail = false));
  await d("save").click();
  await page.getByText("Updated “Renewing this quarter”").waitFor();
  const update = await page.evaluate(() => window.calls[1]);
  assert.equal(update.mode, "update");
  assert.equal(update.view.id, "renewing");
  assert.deepEqual(
    update.view.filters.map((f) => `${f.column}:${f.op}:${f.value}`),
    ["renewsOn:withinDays:90", "health:below:60"],
  );
  // Arrow keys move between views.
  await d("view-renewing").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await d("view-all").getAttribute("aria-selected"), "true");
  // Someone else’s view can only be saved as a copy, and the name must be new.
  await d("add-filter").click();
  await d("option-region-is-emea").click();
  await page.getByRole("button", { name: "Save as new", exact: true }).waitFor();
  assert.match(await d("save").innerText(), /Save as new/);
  await d("save").click();
  await d("view-name").fill("At-risk book");
  await d("create-view").click();
  await page.getByText("A view with that name already exists.").waitFor();
  await d("view-name").fill("EMEA book");
  await page.keyboard.press("Enter");
  await page.getByText("Created “EMEA book”").waitFor();
  const created = await page.evaluate(() => window.calls.at(-1));
  assert.equal(created.mode, "create");
  assert.equal(created.view.name, "EMEA book");
  assert.equal(created.view.owner, "Noor Ali");
  assert.equal(await page.getByRole("tab", { name: /EMEA book/ }).getAttribute("aria-selected"), "true");
  // Sorting is keyboard reachable and lands in the diff.
  await d("sort-arr").click();
  assert.match(await page.getByRole("list", { name: "Unsaved changes" }).innerText(), /Sort ARR/);

  // Empty and invalid data.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SavedViews views={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /No saved views yet/);
  assert.match(await page.locator("tfoot").innerText(), /16\s+accounts/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SavedViews rows={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /No accounts yet/);
  await mount(
    `const v={id:'x',name:'One',filters:[{column:'nope',op:'is',value:'a'}],columns:['plan'],sort:{column:'name',dir:'asc'}};createRoot(document.getElementById('root')).render(<Subject.SavedViews views={[v,{...v,name:'Two'}]}/>);`,
  );
  const alert = await page.getByRole("alert").innerText();
  assert.match(alert, /used twice/);
  assert.match(alert, /column that doesn’t exist/);
  assert.equal(await page.getByRole("tab").count(), 1);
}
