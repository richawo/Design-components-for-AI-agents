import { check as checkSelection } from "../review/block-people-selection.mjs";
export async function check({ page, mount, assert }) {
  await checkSelection({ page, mount, assert });
  await mount(
    `window.calls=[];window.attempt=0;createRoot(document.getElementById('root')).render(<Subject.PeopleWorkspace onComplete={async payload=>{window.calls.push(payload);if(!window.attempt++)throw Error('fixture');}}/>);`,
  );
  await page.getByRole("tab", { name: "Onboarding", exact: true }).click();
  await page.getByRole("button", { name: /^Workspace and account access/ }).click();
  const note = page.getByRole("textbox", { name: "Completion note", exact: true });
  await note.fill("Access provisioned and checked with Noor.");
  await page.getByRole("checkbox", { name: /I confirm this step is complete for Noor Ali/ }).check();
  const selector = page.getByRole("combobox").first();
  await selector.click();
  const labels = await page.getByRole("option").allTextContents();
  await page.getByRole("option").last().click();
  await selector.click();
  await page.getByRole("option", { name: labels[0].trim(), exact: true }).click();
  assert.equal(await note.inputValue(), "Access provisioned and checked with Noor.");
  await page.getByRole("button", { name: "Record completion", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /could not|failed|again/i })
    .waitFor();
  assert.equal(await note.inputValue(), "Access provisioned and checked with Noor.");
  await page.getByRole("button", { name: "Record completion", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: /recorded/i })
    .waitFor();
  const calls = await page.evaluate(() => window.calls);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].departmentId, "commercial");
  assert.equal(calls[1].completion.hireId, "noor");
  assert.equal(calls[1].completion.taskId, "access");
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PeopleWorkspace scopes={[]}/>);`);
  assert.ok(await page.getByText("No department records supplied.").isVisible());
}
