const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");
// The table's sortable headers show from a 768px container, so give the frame room.
const rowFor = (page, id) => page.locator(`[data-demo="matter-${id}"]`).locator('xpath=ancestor::*[@role="row"][1]');
const WIDE = "document.getElementById('root').style.maxWidth='1320px';";

export async function check({ page, mount, assert }) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  try {
    await mount(`${WIDE}window.opened=[];createRoot(document.getElementById('root')).render(<Subject.MatterDashboard referenceDate="2026-10-17" onOpenMatter={id=>window.opened.push(id)}/>);`);
    const root = page.getByRole("region", { name: "Matters, Legal · Portfolio" });
    const kpis = root.locator("dl").first();
    const table = page.getByRole("table", { name: "Matters" });
    const pipeline = page.getByRole("group", { name: "Filter by phase" });
    const agenda = page.getByRole("complementary", { name: "Coming up in 14 days" });
    const order = async () =>
      (await table.locator('[data-demo^="matter-"]').evaluateAll((els) => els.map((e) => e.dataset.demo.slice(7))));
    const header = (name) => table.getByRole("columnheader").filter({ hasText: name });

    // KPIs across live matters (closed matters excluded), money in GBP via Intl.
    assert.match(await txt(kpis), /Open matters 6 1 on hold/);
    assert.match(await txt(kpis), /Spend to date £196,200 of £265,000 budget/);
    assert.match(await txt(kpis), /Over budget 1 £2,400 over/);
    assert.match(await txt(kpis), /Due in 14 days 7 1 overdue/);
    assert.match(await txt(pipeline.locator('[data-demo="phase-negotiation"]')), /03 Negotiation 2 £78,000/i);
    // Completion holds only a closed matter, so it has nothing to filter.
    assert.equal(await pipeline.locator('[data-demo="phase-completion"]').isDisabled(), true);

    // Next date ascending by default; the overdue date outranks the next one; closed sinks.
    assert.equal(await header("Next date").getAttribute("aria-sort"), "ascending");
    assert.deepEqual(await order(), ["mat-205", "mat-209", "mat-207", "mat-204", "mat-198", "mat-201", "mat-187"]);
    assert.match(await txt(rowFor(page, "mat-205")), /Document response 15 Oct · 2d overdue/);
    assert.match(await txt(rowFor(page, "mat-205")), /£26,400 \/ £24,000 110%/);
    assert.match(await txt(rowFor(page, "mat-187")), /Closed/);
    assert.match(await txt(rowFor(page, "mat-187")), /Nothing scheduled/);

    // Sorting by spend: highest share first, then ascending on a second press.
    await page.locator('[data-demo="sort-spend"]').click();
    assert.equal(await header("Spend").getAttribute("aria-sort"), "descending");
    assert.equal(await header("Next date").getAttribute("aria-sort"), "none");
    assert.deepEqual(await order(), ["mat-205", "mat-198", "mat-204", "mat-207", "mat-201", "mat-209", "mat-187"]);
    await page.locator('[data-demo="sort-spend"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(await header("Spend").getAttribute("aria-sort"), "ascending");
    assert.deepEqual(await order(), ["mat-209", "mat-201", "mat-207", "mat-204", "mat-198", "mat-205", "mat-187"]);
    await page.locator('[data-demo="sort-name"]').click();
    assert.equal(await header("Matter").getAttribute("aria-sort"), "ascending");
    assert.equal((await order())[0], "mat-209");

    // A phase filters the table and can be cleared.
    const negotiation = pipeline.locator('[data-demo="phase-negotiation"]');
    await negotiation.click();
    assert.equal(await negotiation.getAttribute("aria-pressed"), "true");
    await page.waitForFunction(() => document.querySelectorAll('[role="table"] [data-demo^="matter-"]').length === 2);
    assert.deepEqual((await order()).sort(), ["mat-204", "mat-207"]);
    assert.match(await txt(root), /2 of 7/);
    await root.getByRole("button", { name: "Negotiation", exact: true }).click();
    assert.equal(await negotiation.getAttribute("aria-pressed"), "false");
    await page.waitForFunction(() => document.querySelectorAll('[role="table"] [data-demo^="matter-"]').length === 7);

    // Keyboard: a row opens in place with its next step, dates and budget.
    const harbour = page.locator('[data-demo="matter-mat-205"]');
    await harbour.focus();
    await page.keyboard.press("Enter");
    assert.equal(await harbour.getAttribute("aria-expanded"), "true");
    const detail = page.locator(`[id="${await harbour.getAttribute("aria-controls")}"]`);
    await detail.filter({ hasText: "Chase the landlord’s insurance certificate" }).waitFor();
    assert.match(await txt(detail), /15 Oct Document response 2d overdue 30 Oct Report to client in 13d/);
    assert.match(await txt(detail), /Agreed £24,000 Spent £26,400 Over by £2,400/);
    await detail.getByRole("button", { name: "Open matter" }).click();
    assert.deepEqual(await page.evaluate(() => window.opened), ["MAT-205"]);
    await harbour.focus();
    await page.keyboard.press("Space");
    assert.equal(await harbour.getAttribute("aria-expanded"), "false");

    // Search and scope, with an empty result.
    const search = page.getByLabel("Find a matter", { exact: true });
    await search.fill("orbit");
    await page.waitForFunction(() => document.querySelectorAll('[role="table"] [data-demo^="matter-"]').length === 1);
    await search.fill("no such matter");
    await table.filter({ hasText: "No matters match." }).waitFor();
    await search.fill("");
    await page.getByRole("radio", { name: "On hold" }).click();
    await page.waitForFunction(() => document.querySelectorAll('[role="table"] [data-demo^="matter-"]').length === 1);
    assert.deepEqual(await order(), ["mat-201"]);

    // Coming up: overdue first, the list is capped, and a date opens its matter with filters reset.
    assert.match(await txt(agenda), /^Coming up Next 14 days Overdue · 15 Oct Document response Harbour premises review/);
    assert.match(await txt(agenda), /2 more dates after 27 Oct/);
    await agenda.getByRole("button", { name: /Counter-proposal/ }).click();
    await page.getByRole("radio", { name: "All", checked: true }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('[role="table"] [data-demo^="matter-"]').length === 7);
    assert.equal(await page.locator('[data-demo="matter-mat-207"]').getAttribute("aria-expanded"), "true");

    // Repeated ids are ignored so spend is counted once; invalid money and dates stay explicit.
    const m = (id, extra) => `{...{id:'${id}',name:'Matter ${id}',client:'Acme',practice:'Commercial',owner:'Ada Park',status:'active',stage:'Intake',nextStep:'Call.',dates:[]},${extra}}`;
    await mount(`${WIDE}createRoot(document.getElementById('root')).render(<Subject.MatterDashboard referenceDate="2026-02-30" matters={[${m("A", "budgetMinor:100000,spentMinor:50000")},${m("A", "budgetMinor:100000,spentMinor:50000")},${m("B", "budgetMinor:-5,spentMinor:10,dates:[{id:'x',label:'Hearing',date:'2026-13-01'}]")},${m("C", "stage:'Arbitration',budgetMinor:1000,spentMinor:2.5")}]}/>);`);
    const bad = page.getByRole("region", { name: /Matters/ });
    assert.match(await page.getByRole("alert").innerText(), /The reference date 2026-02-30 is invalid, so countdowns use today\./);
    assert.match(await txt(bad.locator("dl").first()), /Open matters 3/);
    assert.match(await txt(bad.locator("dl").first()), /Spend to date £500 of £1,000 budget/);
    assert.match(await txt(rowFor(page, "b")), /No budget agreed/);
    assert.match(await txt(rowFor(page, "b")), /Nothing scheduled/);
    assert.match(await txt(rowFor(page, "c")), /No budget agreed/);
    // An unlisted stage is added to the pipeline after the standard phases.
    await page.locator('[data-demo="phase-arbitration"]').waitFor();
    assert.match(await txt(bad), /3 of 3/);

    // No matters.
    await mount(`${WIDE}createRoot(document.getElementById('root')).render(<Subject.MatterDashboard referenceDate="2026-10-17" matters={[]}/>);`);
    await page.getByText("No matters yet.").waitFor();
    const empty = page.getByRole("region", { name: /Matters/ });
    assert.match(await txt(empty.locator("dl").first()), /No budgets agreed yet/);
    assert.match(await txt(empty.locator("dl").first()), /All within budget/);
    assert.match(await txt(page.getByRole("complementary")), /Nothing due in the next 14 days\./);
  } finally {
    await page.setViewportSize({ width: 390, height: 900 });
  }
}
