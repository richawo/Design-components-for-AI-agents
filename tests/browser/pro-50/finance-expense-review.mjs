export async function check({ page, mount, assert }) {
  const desk = () => page.getByLabel("Claim under review", { exact: true });
  const section = () => page.locator("section").first();
  await mount(
    `window.decisions=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.ExpenseReview onDecision={async d=>{window.decisions.push(d);if(window.fail){window.fail=false;throw Error('Approvals are offline.')}}}/>);`,
  );
  assert.match(await desk().innerText(), /Alex Morgan/);
  assert.match(await section().innerText(), /5 to review/);

  // Keyboard: J moves to the next claim, R opens the reason picker seeded with the claim's own flag.
  await desk().focus();
  await page.keyboard.press("j");
  await page.getByText("Dinner for the four of us", { exact: false }).waitFor();
  assert.match(await desk().innerText(), /Taylor Reed/);
  await page.keyboard.press("r");
  const reason = page.getByRole("radio", { name: "Alcohol isn’t reimbursable", exact: true });
  await reason.waitFor();
  assert.equal(await reason.getAttribute("aria-checked"), "true");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("radio", { name: "Service is capped at 10%" }).getAttribute("aria-checked"), "true");
  await page.keyboard.press("ArrowLeft");
  await page.getByLabel("Note to the claimant").fill("Resubmit without the wine.");

  // A failed save keeps the claim, the reason and the note.
  await page.getByRole("button", { name: /Reject and tell Taylor/ }).click();
  await page.getByText(/Approvals are offline\. Nothing changed; your reason is kept\./).waitFor();
  assert.equal(await page.getByLabel("Note to the claimant").inputValue(), "Resubmit without the wine.");
  assert.equal(await reason.getAttribute("aria-checked"), "true");
  assert.match(await desk().innerText(), /Taylor Reed/);

  // Try again succeeds, the claim drains and the next one comes up.
  await page.getByRole("button", { name: /Try again/ }).click();
  await page.waitForFunction(() => window.decisions.length === 2);
  assert.deepEqual(await page.evaluate(() => window.decisions[1]), {
    claimId: "EXP-2202",
    decision: "reject",
    amountMinor: 18776,
    reason: "Alcohol isn’t reimbursable",
    note: "Resubmit without the wine.",
  });
  await page.getByText("Overnight before the Northstar workshop", { exact: false }).waitFor();
  assert.match(await section().innerText(), /4 to review/);

  // A approves from the keyboard once focus is back on the desk; the running total moves.
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Claim under review");
  await page.keyboard.press("a");
  await page.waitForFunction(() => window.decisions.length === 3);
  assert.deepEqual(await page.evaluate(() => window.decisions[2]), { claimId: "EXP-2203", decision: "approve", amountMinor: 24600 });
  await page.getByText("£1,530.50").first().waitFor({ state: "attached" });

  // Shortcuts are ignored while typing.
  await page.getByText("Home after the quarter-end close", { exact: false }).waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Claim under review");
  await page.keyboard.press("r");
  await page.getByLabel("Note to the claimant").fill("a");
  assert.equal(await page.evaluate(() => window.decisions.length), 3);
  await page.keyboard.press("Escape");

  // Empty, duplicate and missing-receipt data.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ExpenseReview claims={[]}/>);`);
  assert.match(await section().innerText(), /Nothing waiting for you/);
  const claim = {
    id: "X-1",
    claimant: { name: "Ada Park", team: "Ops" },
    merchant: "Ryman",
    category: "Office",
    purpose: "Pens",
    spentOn: "2026-10-14",
    amountMinor: 4200,
    paidWith: { kind: "personal" },
    checks: [{ id: "r", label: "Receipts are required over £25", status: "violation" }],
  };
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ExpenseReview claims={${JSON.stringify([claim, { ...claim, merchant: "Duplicate" }])}}/>);`);
  assert.match(await section().innerText(), /1 to review/);
  assert.match(await desk().innerText(), /No receipt attached/);
  assert.doesNotMatch(await section().innerText(), /Duplicate|NaN/);
}
