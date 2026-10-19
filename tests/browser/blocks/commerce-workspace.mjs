import {check as checkOrderPhone} from '../review/dashboard-orders-table-phone.mjs';
import {check as checkOrderContrast} from '../review/dashboard-orders-table-contrast.mjs';
export async function check({ page, mount, assert }) {
  await mount(
    `window.calls=[];window.attempt=0;createRoot(document.getElementById('root')).render(<Subject.CommerceWorkspace onReturn={async payload=>{window.calls.push(payload);if(!window.attempt++)throw Error('fixture');return {reference:'RETURN-FIXTURE'};}}/>);`,
  );
  await page.getByRole("link", { name: "Open order workspace", exact: true }).click();
  await page.getByRole("heading", { name: "Order workspace", exact: true }).waitFor();
  await page.getByRole("link", { name: "Back to overview", exact: true }).click();
  await page.getByRole("tab", { name: "Returns", exact: true }).click();
  await page.getByRole("checkbox", { name: "Return Merino crew", exact: true }).check();
  await page.getByRole("radio", { name: "The fit was not right", exact: true }).check();
  const note = page.getByRole("textbox", { name: /Internal note/ });
  await note.fill("Please retain the reviewed return note.");
  const selector = page.getByRole("combobox").first();
  await selector.click();
  const labels = await page.getByRole("option").allTextContents();
  await page.getByRole("option").last().click();
  await selector.click();
  await page.getByRole("option", { name: labels[0].trim(), exact: true }).click();
  assert.equal(await note.inputValue(), "Please retain the reviewed return note.");
  await page.getByRole("button", { name: /Review return/ }).click();
  await page.getByRole("button", { name: /Submit return/ }).click();
  await page.getByRole("alert").filter({ hasText: "fixture" }).waitFor();
  await page.getByRole("button", { name: /Submit return/ }).click();
  await page.getByText("RETURN-FIXTURE · Return request recorded", { exact: true }).waitFor();
  const calls = await page.evaluate(() => window.calls);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], {
    periodId: "oct",
    request: {
      orderId: "ORD-1042",
      lines: [{ itemId: "crew", quantity: 1 }],
      reasonId: "fit",
      resolution: "refund",
      note: "Please retain the reviewed return note.",
      expectedAmountMinor: "12500",
    },
  });
  assert.deepEqual(calls[0], calls[1]);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CommerceWorkspace periods={[]}/>);`);
  assert.ok(await page.getByText("No store periods supplied.").isVisible());
  await checkOrderContrast({page,mount,assert});
  await checkOrderPhone({page,mount,assert});
}
