const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");
const spoken = (locator) =>
  locator.evaluate((el) => {
    const copy = el.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll("*").forEach((n) => n.append(" "));
    return copy.textContent.replace(/\s+/g, " ").trim();
  });
// Two columns (customers | follow-up) from a 1024px container; give the frame room.
const WIDE = "document.getElementById('root').style.maxWidth='1320px';";

export async function check({ page, mount, assert }) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  try {
    await mount(`${WIDE}window.sent=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.ReceivablesAging onSendFollowUp={async f=>{window.sent.push(f);if(window.fail)throw Error('')}}/>);`);
    const root = page.locator("section").first();
    const toolbar = root.locator("header").first();
    const list = page.getByRole("list", { name: "Customers with open invoices" });
    const panel = page.getByRole("complementary", { name: "Follow-up" });
    const NAMES = /Halcyon Health|Bellwether & Co|Northstar Studio|Fieldwork Labs|Ostara Foods|Marlow Print|Common Ground Coffee|Tidewater Studio/;
    const order = async () => (await list.locator('[data-demo^="customer-"]').allTextContents()).map((t) => t.match(NAMES)?.[0]);
    const bucket = (key) => page.locator(`[data-demo="bucket-${key}"]`);
    const message = panel.getByRole("textbox", { name: "Message" });
    const send = page.locator('[data-demo="send"]');

    // The book aged to 16 Oct, weighted by money.
    assert.match(await txt(toolbar), /Open invoices · 16 Oct 9 overdue 12 open · 8 customers/);
    const summary = await spoken(root);
    assert.match(summary, /Outstanding £58,695\.00 £32,095\.00 overdue · 55% of the book/);
    assert.match(summary, /Weighted age of overdue 64 days/);
    assert.match(await spoken(bucket("current")), /Not yet due £26,600\.00 3 invoices · 45%/);
    assert.match(await spoken(bucket("1-30")), /1–30 days £9,745\.00 4 invoices · 17%/);
    assert.match(await spoken(bucket("61-90")), /61–90 days £5,880\.00 2 invoices · 10%/);
    assert.match(await spoken(bucket("90+")), /Over 90 days £9,120\.00 1 invoice · 16%/);
    assert.deepEqual(await order(), ["Halcyon Health", "Bellwether & Co", "Northstar Studio", "Fieldwork Labs", "Ostara Foods", "Marlow Print", "Common Ground Coffee", "Tidewater Studio"]);
    assert.match(await txt(page.locator('[data-demo="customer-0"]')), /Halcyon Health 2 invoices · Jonah Reed 118 days late Call · 9 Oct £13,220\.00/);
    assert.match(await txt(page.locator('[data-demo="customer-2"]')), /Reminder · 2 Oct/);
    assert.match(await txt(panel), /Pick a customer to chase/);

    // The legend filters by age, and toggles off.
    await bucket("61-90").click();
    assert.equal(await bucket("61-90").getAttribute("aria-checked"), "true");
    await root.filter({ hasText: "61–90 days · 2 customers" }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Customers with open invoices"] > li').length === 2);
    assert.deepEqual(await order(), ["Bellwether & Co", "Northstar Studio"]);
    await bucket("61-90").focus();
    await page.keyboard.press("Enter");
    assert.equal(await bucket("61-90").getAttribute("aria-checked"), "false");
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Customers with open invoices"] > li').length === 8);
    await bucket("90+").click();
    await root.getByRole("button", { name: "Show all" }).click();
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Customers with open invoices"] > li').length === 8);

    // Keyboard: open a customer; the letter is written from their overdue invoices.
    await page.locator('[data-demo="customer-0"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator('[data-demo="customer-0"]').getAttribute("aria-pressed"), "true");
    await panel.filter({ hasText: "Imogen Hart · owner Jonah Reed" }).waitFor();
    assert.equal(await page.getByRole("radio", { name: "Firm" }).getAttribute("aria-checked"), "true");
    assert.match(await txt(panel), /Subject Overdue: 2 invoices · £13,220\.00/);
    assert.equal(
      await message.inputValue(),
      "Hi Imogen,\n\nINV-1987 and INV-2066 are now 118 days overdue, with £13,220.00 outstanding. Please arrange payment by Friday 23 October, or let me know today if anything is holding it up.\n\nThanks,\nJonah",
    );

    // Tone rewrites the letter; hand edits come back once.
    await page.locator('[data-demo="tone-final"]').click();
    await panel.filter({ hasText: "Final reminder: 2 invoices" }).waitFor();
    assert.match(await message.inputValue(), /pass the account to our collections partner\.\n\nRegards,\nJonah$/);
    await message.fill("Hi Imogen,\n\nPlease settle INV-1987 this week.\n\nRegards,\nJonah");
    assert.equal(await message.evaluate(el => document.activeElement === el), true, "Editing must retain textarea focus");
    await page.locator('[data-demo="tone-friendly"]').click();
    await panel.filter({ hasText: "Quick reminder: 2 invoices" }).waitFor();
    assert.match(await message.inputValue(), /A quick nudge on INV-1987 and INV-2066/);
    await panel.getByRole("button", { name: "Bring back your edits" }).click();
    assert.equal(await message.inputValue(), "Hi Imogen,\n\nPlease settle INV-1987 this week.\n\nRegards,\nJonah");
    await page.locator('[data-demo="tone-final"]').click();
    await panel.getByRole("button", { name: "Bring back your edits" }).click();

    // Choose which invoices go in.
    const invoices = panel.getByRole("list", { name: "Invoices to include" });
    await invoices.getByRole("checkbox").nth(1).uncheck();
    await panel.filter({ hasText: "Final reminder: INV-1987" }).waitFor();
    assert.match(await spoken(panel), /£9,120\.00 to chase/);
    await invoices.getByRole("checkbox").nth(0).uncheck();
    await panel.filter({ hasText: "Pick at least one invoice to chase." }).waitFor();
    assert.equal(await send.isDisabled(), true);
    await invoices.getByRole("checkbox").nth(0).check();

    // Sending fails first; the edited letter is kept.
    await send.click();
    await panel.filter({ hasText: "The email couldn’t be sent. Your draft is kept." }).waitFor();
    assert.match(await txt(send), /Try again/);
    assert.equal(await message.inputValue(), "Hi Imogen,\n\nPlease settle INV-1987 this week.\n\nRegards,\nJonah");
    await page.evaluate(() => (window.fail = false));
    await send.click();
    await panel.filter({ hasText: "Reminder sent" }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.sent[1]), {
      customerId: "halcyon",
      invoiceIds: ["INV-1987"],
      outstandingMinor: 912000,
      tone: "final",
      to: "payables@halcyonhealth.co.uk",
      subject: "Final reminder: INV-1987",
      message: "Hi Imogen,\n\nPlease settle INV-1987 this week.\n\nRegards,\nJonah",
    });
    const receipt = await txt(panel);
    assert.match(receipt, /to payables@halcyonhealth\.co\.uk/);
    assert.match(receipt, /Chasing £9,120\.00 · 1 invoice/);
    assert.match(receipt, /Tone Final notice/);
    assert.match(receipt, /Logged to Halcyon Health’s timeline/);
    assert.match(receipt, /Next nudge 23 Oct/);
    await page.locator('[data-demo="customer-0"]').filter({ hasText: "Reminder · just now" }).waitFor();

    // Partly paid invoices age on what's left; a customer with nothing overdue starts with nothing ticked.
    await page.locator('[data-demo="customer-2"]').click();
    await panel.filter({ hasText: "Maya Okafor · owner Alex Morgan" }).waitFor();
    assert.match(await spoken(panel), /£3,600\.00 to chase/);
    assert.match(await txt(invoices), /INV-2041 76 days late £3,600\.00 INV-2094 due 30 Oct £2,600\.00/);
    await invoices.getByRole("checkbox").nth(1).check();
    assert.match(await message.inputValue(), /£6,200\.00 outstanding.*includes invoices that are still within their payment terms/s);
    assert.doesNotMatch(await message.inputValue(), /£6,200\.00.*days (?:past due|overdue)/s);

    // No open invoices.
    await mount(`${WIDE}createRoot(document.getElementById('root')).render(<Subject.ReceivablesAging invoices={[]}/>);`);
    assert.match(await txt(page.locator("section").first().locator("header").first()), /All current/);
    assert.match(await spoken(page.locator("section").first()), /Outstanding £0\.00/);
    assert.equal(await page.locator('[data-demo="customer-0"]').count(), 0);

    // A reminder must not tell a customer that an invoice which isn't due yet is past due.
    await mount(`${WIDE}createRoot(document.getElementById('root')).render(<Subject.ReceivablesAging/>);`);
    await page.locator('[data-demo="customer-7"]').click();
    const tide = page.getByRole("complementary", { name: "Follow-up" });
    await tide.filter({ hasText: "Owen Pike · owner Priya Shah" }).waitFor();
    await tide.filter({ hasText: "Pick at least one invoice to chase." }).waitFor();
    await tide.getByRole("list", { name: "Invoices to include" }).getByRole("checkbox").check();
    const letter = await tide.getByRole("textbox", { name: "Message" }).inputValue();
    assert.match(letter, /Payment is due on Sunday 1 November\./);
    assert.doesNotMatch(letter, /0 days past due/, `A not-yet-due invoice is chased as overdue: ${letter.split("\n")[2]}`);
    for (const tone of ["firm", "final"]) {
      await page.locator(`[data-demo="tone-${tone}"]`).click();
      const currentLetter = await tide.getByRole("textbox", { name: "Message" }).inputValue();
      assert.match(currentLetter, /Payment is due on Sunday 1 November\./);
      assert.doesNotMatch(currentLetter, /overdue|past due|collections partner/);
    }

    // Calendar validation rejects impossible dates as well as malformed strings.
    // Missing customer references must not inflate totals without a visible row.
    await mount(`${WIDE}createRoot(document.getElementById('root')).render(<Subject.ReceivablesAging invoices={[
      {id:'VALID',customerId:'halcyon',dueDate:'2026-10-10',amountMinor:1000},
      {id:'BAD',customerId:'halcyon',dueDate:'not-a-date',amountMinor:1000000},
      {id:'IMPOSSIBLE',customerId:'halcyon',dueDate:'2026-02-30',amountMinor:1000000},
      {id:'ORPHAN',customerId:'missing',dueDate:'2026-10-10',amountMinor:2000000}
    ]}/>);`);
    assert.match(await txt(page.getByRole("alert")), /Invalid due dates: BAD, IMPOSSIBLE.*Unknown customers: ORPHAN \(missing\).*Totals exclude these records until corrected/s);
    assert.match(await txt(page.locator("section").first().locator("header").first()), /Data needs review 1 open · 1 customer/);
    assert.match(await spoken(page.locator("section").first()), /Outstanding £10\.00 £10\.00 overdue/);
    assert.equal(await page.locator('[data-demo^="customer-"]').count(), 1);
    assert.match(await spoken(bucket("90+")), /£0\.00 0 invoices/);
  } finally {
    await page.setViewportSize({ width: 390, height: 900 });
  }
}
