const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");
// Counted figures render twice (an animated aria-hidden copy and the spoken value); read the spoken text.
const spoken = (locator) =>
  locator.evaluate((el) => {
    const copy = el.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll("*").forEach((n) => n.append(" "));
    return copy.textContent.replace(/\s+/g, " ").trim();
  });
const ACCOUNT = (id, extra = "") =>
  `{...{id:'${id}',name:'Acct ${id}',domain:'${id}.io',plan:'Growth',arr:1000,owner:'Ada Park',renewsOn:'2026-11-01',trend:[60,62],signals:{adoption:{score:80,detail:'8 of 10 seats'}}},${extra}}`;

export async function check({ page, mount, assert }) {
  await mount(`window.logs=[];window.undos=[];window.selected=[];window.fail=true;window.failUndo=false;createRoot(document.getElementById('root')).render(<Subject.CustomerHealth onSelect={id=>window.selected.push(id)} onLogPlay={async l=>{window.logs.push(l);if(window.fail)throw Error('')}} onUndoPlay={async l=>{window.undos.push(l);if(window.failUndo)throw Error('offline')}}/>);`);
  const table = page.locator("table");
  const order = () => table.locator('tbody [data-demo^="account-"]').evaluateAll((els) => els.map((e) => e.dataset.demo.slice(8)));
  const row = (id) => page.locator(`[data-demo="account-${id}"]`);
  const inspector = (name) => page.getByRole("complementary", { name: `${name} health` });
  const header = (name) => table.locator("th").filter({ hasText: name });

  // Composite health from weighted drivers, lowest first; the first account is inspected.
  assert.equal(await row("harbour").getAttribute("aria-label"), "Harbour Works, health 44, At risk");
  assert.equal(await row("oakline").getAttribute("aria-label"), "Oakline Logistics, health 79, Healthy");
  assert.deepEqual(await order(), ["quarry", "harbour", "lumen", "aster", "fieldnote", "pinecrest", "corvid", "oakline", "brightwell", "northline"]);
  assert.equal(await header("Health").getAttribute("aria-sort"), "ascending");
  assert.equal(await row("harbour").getAttribute("aria-pressed"), "true");
  await inspector("Harbour Works").waitFor();
  assert.match(await txt(page.getByRole("radiogroup", { name: "Filter by health" })), /All 10 At risk 2 Watch 4 Healthy 4/);
  assert.match(await table.locator("caption").textContent(), /10 accounts\. Select one to inspect its health drivers\./);
  const runway = page.getByRole("region", { name: "Renewals in the next 90 days" });
  assert.match(await txt(runway), /6 renewals · \$252\.4K ARR · 2 at risk/);
  assert.match(await spoken(page.locator("section").first()), /Renewing in 30 days 2 \$75\.6K ARR renewing/);
  assert.equal(await page.locator('[data-demo="renewal-harbour"]').getAttribute("aria-label"), "Harbour Works renews in 23 days, Nov 6, At risk");

  // Drivers are disclosures; each carries its share of the score.
  const billing = page.locator('[data-demo="driver-billing"]');
  assert.match(await spoken(billing), /Billing 80 8\.0 of 10/);
  await billing.focus();
  await page.keyboard.press("Enter");
  assert.equal(await billing.getAttribute("aria-expanded"), "true");
  await inspector("Harbour Works").filter({ hasText: "One invoice 12 days overdue" }).waitFor();
  assert.match(await txt(inspector("Harbour Works")), /down 10 pts in 4 weeks/);
  assert.match(await txt(inspector("Harbour Works")), /Invoice punctuality and failed payments this term\./);
  await page.keyboard.press("Enter");
  assert.equal(await billing.getAttribute("aria-expanded"), "false");
  assert.match(await page.getByRole("img", { name: /^Health moved from \d+ to 44 over 12 weeks$/ }).getAttribute("aria-label"), /to 44/);

  // Keyboard: Up/Down move the selection through the table.
  await row("quarry").click();
  assert.deepEqual(await page.evaluate(() => window.selected), ["quarry"]);
  await inspector("Quarry Labs").waitFor();
  await page.keyboard.press("ArrowDown");
  await inspector("Harbour Works").waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.demo), "account-harbour");
  assert.equal(await row("harbour").getAttribute("aria-pressed"), "true");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await inspector("Quarry Labs").waitFor();
  assert.deepEqual(await page.evaluate(() => window.selected), ["quarry", "harbour", "quarry", "quarry"]);
  await row("harbour").click();

  // Filters are a radiogroup with arrow keys.
  await page.locator('[data-demo="filter-all"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("radio", { name: /^At risk/, checked: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('tbody [data-demo^="account-"]').length === 2);
  await page.keyboard.press("ArrowRight");
  await page.getByRole("radio", { name: /^Watch/, checked: true }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.demo), "filter-watch");
  await page.waitForFunction(() => document.querySelectorAll('tbody [data-demo^="account-"]').length === 4);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("radio", { name: /^All/, checked: true }).waitFor();

  // Sorting flips direction and says so.
  await header("Health").getByRole("button").click();
  assert.equal(await header("Health").getAttribute("aria-sort"), "descending");
  assert.match(await txt(page.locator("section").first()), /Sorted by health, highest first/);
  assert.equal((await order())[0], "northline");
  await header("ARR").getByRole("button").click();
  assert.equal(await header("ARR").getAttribute("aria-sort"), "descending");
  assert.equal(await header("Health").getAttribute("aria-sort"), "none");
  assert.deepEqual((await order()).slice(0, 3), ["aster", "northline", "corvid"]);

  // Signature workflow: log a play. The host fails first and the draft stays.
  const composer = page.getByRole("form", { name: "Next play for Harbour Works" });
  const logButton = page.locator('[data-demo="log-play"]');
  assert.equal(await logButton.isDisabled(), true);
  assert.match(await txt(composer), /Pick the play that moves this account\./);
  const exec = page.locator('[data-demo="play-exec"]');
  await exec.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("radio", { name: "Adoption workshop", checked: true }).waitFor();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("radio", { name: "Exec check-in", checked: true }).waitFor();
  await composer.filter({ hasText: "Book 30 minutes with the economic buyer" }).waitFor();
  const note = page.getByLabel("Note for Alex", { exact: true });
  await note.fill("  Walk through the P1 timeline and the seat plan.  ");
  await page.getByRole("radio", { name: /^In 2 weeks/ }).click();
  assert.match(await txt(composer), /Exec check-in for Alex Morgan · Wed, Oct 28/);
  await logButton.click();
  await page.getByRole("alert").filter({ hasText: "The play couldn’t be saved. Your note is kept; try again." }).waitFor();
  assert.equal(await note.inputValue(), "  Walk through the P1 timeline and the seat plan.  ");
  assert.equal(await page.getByRole("radio", { name: "Exec check-in" }).getAttribute("aria-checked"), "true");
  assert.equal(await page.getByRole("radio", { name: /^In 2 weeks/ }).getAttribute("aria-checked"), "true");
  // Editing the draft clears the error.
  await note.fill("Walk through the P1 timeline and the seat plan.");
  await page.waitForFunction(() => !document.querySelector('[role="alert"]'));

  await page.evaluate(() => (window.fail = false));
  await logButton.click();
  const receipt = page.getByRole("status").filter({ hasText: "Exec check-in logged" });
  await receipt.waitFor();
  assert.match(await txt(receipt), /Alex Morgan · due Wed, Oct 28/);
  assert.match(await txt(receipt), /“Walk through the P1 timeline and the seat plan\.”/);
  assert.equal(await page.evaluate(() => window.logs.length), 2);
  const log = { accountId: "harbour", playId: "exec", note: "Walk through the P1 timeline and the seat plan.", dueOn: "2026-10-28", owner: "Alex Morgan" };
  assert.deepEqual(await page.evaluate(() => window.logs[1]), log);
  await row("harbour").locator("xpath=ancestor::tr").filter({ hasText: "Oct 28" }).waitFor();

  // Undo the host rejects keeps the receipt; a working undo restores the draft.
  await page.evaluate(() => (window.failUndo = true));
  await receipt.getByRole("button", { name: "Undo" }).click();
  await receipt.waitFor();
  await page.evaluate(() => (window.failUndo = false));
  await receipt.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("form", { name: "Next play for Harbour Works" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.undos), [log, log]);
  assert.equal(await page.getByLabel("Note for Alex", { exact: true }).inputValue(), "Walk through the P1 timeline and the seat plan.");
  assert.equal(await page.getByRole("radio", { name: "Exec check-in" }).getAttribute("aria-checked"), "true");

  // The runway selects too.
  await page.locator('[data-demo="renewal-lumen"]').click();
  await inspector("Lumen Retail").waitFor();
  assert.equal(await page.locator('[data-demo="renewal-lumen"]').getAttribute("aria-pressed"), "true");

  // A missing driver signal is shown as no data and left out of the score.
  await row("oakline").click();
  const oak = inspector("Oakline Logistics");
  await oak.waitFor();
  assert.match(await spoken(page.locator('[data-demo="driver-sentiment"]')), /Sentiment No data/);
  await page.locator('[data-demo="driver-sentiment"]').click();
  await oak.filter({ hasText: "No signal reported. This driver is left out of the score." }).waitFor();

  // Duplicate ids are flagged; an empty band and an empty book say so.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CustomerHealth today="2026-10-14" accounts={[${ACCOUNT("a")},${ACCOUNT("a", "name:'Acct copy'")},${ACCOUNT("b")}]}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /Duplicate account IDs: a\. Each account needs a unique ID\./);
  await page.locator('[data-demo="filter-risk"]').click();
  await page.getByText("No at risk accounts right now").waitFor();
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CustomerHealth accounts={[]}/>);`);
  await page.getByText("No accounts yet").waitFor();
  assert.equal(await page.getByRole("form").count(), 0);

  // An invalid renewal date stays explicit instead of crashing the page.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CustomerHealth today="2026-10-14" accounts={[${ACCOUNT("x", "renewsOn:'not-a-date'")}]}/>);`);
  await page.getByRole("complementary", { name: "Acct x health" }).waitFor({ timeout: 5000 });

  // An account without trend history must not draw a broken chart.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CustomerHealth today="2026-10-14" accounts={[${ACCOUNT("n", "trend:[]")}]}/>);`);
  await page.getByRole("complementary", { name: "Acct n health" }).waitFor();
  assert.equal(await page.locator('path[d*="NaN"], circle[cy="NaN"]').count(), 0, "Empty trend draws NaN geometry");
  assert.doesNotMatch(await txt(page.getByRole("complementary")), /last 0 weeks/);
}
