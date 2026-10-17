export async function check({ page, mount, assert }) {
  await mount(`window.calls=[];window.attempt=0;createRoot(document.getElementById('root')).render(<Subject.FashionWorkspace onSavePlan={async payload=>{window.calls.push(payload);if(!window.attempt++)throw Error('fixture')}}/>);`);
  await page.getByRole("tab", { name: "Line plan", exact: true }).click();
  const plan = page.locator('[data-workspace-panel="autumn-planning"]');
  const add = plan.getByRole("button", { name: "Add a style to Outerwear", exact: true });
  await add.click();
  const created = plan.locator('[data-demo="option-outer-new-1"]');
  await created.waitFor();
  const selector = page.getByRole("combobox").first();
  await selector.click();
  const labels = await page.getByRole("option").allTextContents();
  await page.getByRole("option").last().click();
  await selector.click();
  await page.getByRole("option", { name: labels[0].trim(), exact: true }).click();
  await created.waitFor();
  await plan.getByRole("button", { name: "Save line plan", exact: true }).click();
  await plan.getByRole("alert").filter({ hasText: "fixture" }).waitFor();
  await created.waitFor();
  await plan.getByRole("button", { name: "Save again", exact: true }).click();
  await plan.getByRole("status").filter({ hasText: "Line plan saved" }).waitFor();
  assert.equal(await page.evaluate(() => window.calls.length), 2);
  assert.equal(await page.evaluate(() => window.calls[1].collectionId), "autumn");
  assert.equal(await page.evaluate(() => window.calls[1].plan.categories[0].styles), 7);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.FashionWorkspace scopes={[]}/>);`);
  assert.ok(await page.getByText("No collection records supplied.").isVisible());
}
