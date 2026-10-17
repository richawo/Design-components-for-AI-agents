const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");
// Animated figures render an aria-hidden copy next to the spoken value; read what a screen reader hears.
const spoken = (locator) =>
  locator.evaluate((el) => {
    const copy = el.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll("*").forEach((n) => n.append(" "));
    return copy.textContent.replace(/\s+/g, " ").trim();
  });
const CUSTOMER = { name: "Northstar Studio", contact: "Maya Okafor", email: "maya@northstar.studio", address: ["3rd Floor, 22 Hatton Wall", "London EC1N 8JH"] };
const MESSAGE = "Hi Maya, here’s the invoice for the launch work. Thanks again, it was a joy to build.";
const WIDE = "document.getElementById('root').style.maxWidth='1320px';";

export async function check({ page, mount, assert }) {
  await mount(`window.sent=[];window.saved=[];window.fail=true;window.failSave=true;createRoot(document.getElementById('root')).render(<Subject.InvoiceComposer onSaveDraft={async d=>{window.saved.push(d);if(window.failSave)throw Error('')}} onSend={async d=>{window.sent.push(d);if(window.fail)throw Error('');return {paymentUrl:'https://pay.example.com/i/0048'}}}/>);`);
  const root = page.locator("section").first();
  const toolbar = root.locator("header").first();
  const invoice = page.getByRole("article", { name: "Invoice INV-0048" });
  const rail = page.getByRole("complementary", { name: "Delivery" });
  const send = page.locator('[data-demo="send"]');
  const field = (name) => page.getByLabel(name, { exact: true });

  // The page is the editor: totals in integer minor units, formatted for GBP.
  assert.match(await txt(toolbar), /INV-0048 · Northstar Studio Draft/);
  let paper = await spoken(invoice);
  assert.match(paper, /Subtotal £12,750\.00/);
  assert.match(paper, /−£637\.50/);
  assert.match(paper, /VAT % £2,422\.50/);
  assert.match(paper, /Total due GBP £14,535\.00/);
  assert.match(paper, /Due 15 Nov 2026/);
  assert.match(await spoken(rail), /Amount due 15 Nov £14,535\.00 Maya Okafor gets a PDF and a link to pay\./);

  // Typing a quantity retotals the page.
  await page.locator('[data-demo="qty-1"]').fill("8");
  await invoice.filter({ hasText: "£6,800.00" }).waitFor();
  paper = await spoken(invoice);
  assert.match(paper, /Subtotal £14,450\.00/);
  assert.match(paper, /Total due GBP £16,473\.00/);
  // Rates tidy on blur.
  await field("Line 3 rate").fill("1250");
  await field("Line 3 rate").blur();
  assert.equal(await field("Line 3 rate").inputValue(), "1,250.00");

  // Invalid quantity, rate, percentage and address each block sending with the reason.
  await field("Line 2 quantity").fill("0");
  assert.equal(await field("Line 2 quantity").getAttribute("aria-invalid"), "true");
  await rail.filter({ hasText: "Line 2 needs a description, a quantity and a rate." }).waitFor();
  assert.equal(await send.isDisabled(), true);
  await field("Line 2 quantity").fill("8");
  await field("Line 1 rate").fill("6400.555");
  assert.equal(await field("Line 1 rate").getAttribute("aria-invalid"), "true");
  await rail.filter({ hasText: "Line 1 needs a description, a quantity and a rate." }).waitFor();
  await field("Line 1 rate").fill("6,400.00");
  await field("Line 1 description").fill("   ");
  assert.equal(await field("Line 1 description").getAttribute("aria-invalid"), "true");
  await field("Line 1 description").fill("Brand system refresh: logo, type and colour");
  await field("Discount percentage").fill("abc");
  await rail.filter({ hasText: "The discount should be a percentage." }).waitFor();
  await field("Discount percentage").fill("10");
  await field("VAT percentage").fill("150");
  await rail.filter({ hasText: "VAT should be a percentage." }).waitFor();
  await field("VAT percentage").fill("20");
  const email = rail.getByRole("textbox", { name: "Send to" });
  await email.fill("maya@");
  assert.equal(await email.getAttribute("aria-invalid"), "true");
  await rail.filter({ hasText: "Add the address the invoice goes to." }).waitFor();
  assert.equal(await send.isDisabled(), true);
  await email.fill("maya@northstar.studio");
  await rail.filter({ hasText: "Maya Okafor gets a PDF and a link to pay." }).waitFor();
  paper = await spoken(invoice);
  assert.match(paper, /−£1,445\.00/);
  assert.match(paper, /VAT % £2,601\.00/);
  assert.match(paper, /Total due GBP £15,606\.00/);

  // Keyboard: payment terms are a radiogroup; the due date moves on the page.
  await page.locator('[data-demo="terms-30"]').focus();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("radio", { name: "Net 15", checked: true }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.demo), "terms-15");
  await invoice.filter({ hasText: "31 Oct 2026" }).waitFor();
  assert.match(await spoken(rail), /Amount due 31 Oct £15,606\.00/);
  // Card payments off: the pay-online line leaves the page.
  await rail.getByRole("switch").uncheck();
  await page.waitForFunction(() => !document.body.textContent.includes("Or pay by card online"));

  // Save draft fails, then saves.
  await page.locator('[data-demo="save"]').click();
  await rail.filter({ hasText: "Couldn’t save just now. Your changes are still here." }).waitFor();
  await page.evaluate(() => (window.failSave = false));
  await page.locator('[data-demo="save"]').click();
  await toolbar.filter({ hasText: "Draft saved" }).waitFor();

  const expected = {
    number: "INV-0048",
    issueDate: "2026-10-16",
    dueDate: "2026-10-31",
    termsDays: 15,
    currency: "GBP",
    customer: CUSTOMER,
    recipientEmail: "maya@northstar.studio",
    message: MESSAGE,
    reference: "PO-7731 · Launch",
    lines: [
      { id: "l1", description: "Brand system refresh: logo, type and colour", quantity: 1, unitMinor: 640000 },
      { id: "l2", description: "Launch site design and build (sprint days)", quantity: 8, unitMinor: 85000 },
      { id: "l3", description: "Motion study for the homepage hero", quantity: 1, unitMinor: 125000 },
    ],
    discountBasisPoints: 1000,
    taxBasisPoints: 2000,
    acceptCard: false,
    notes: "Thank you for working with us.",
    subtotalMinor: 1445000,
    discountMinor: 144500,
    taxMinor: 260100,
    totalMinor: 1560600,
  };
  assert.deepEqual(await page.evaluate(() => window.saved.at(-1)), expected);

  // Sending fails first: the draft is kept and editable.
  await send.click();
  await rail.filter({ hasText: "The email couldn’t be delivered. Your draft is kept." }).waitFor();
  assert.match(await txt(toolbar), /Not sent/);
  assert.match(await txt(send), /Try again/);
  assert.equal(await page.locator('[data-demo="qty-1"]').inputValue(), "8");
  assert.equal(await page.locator('[data-demo="qty-1"]').isDisabled(), false);

  await page.evaluate(() => (window.fail = false));
  await send.click();
  await rail.filter({ hasText: "Invoice sent" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.sent.at(-1)), expected);
  assert.equal(await page.evaluate(() => window.sent.length), 2);
  assert.match(await txt(toolbar), /Sent · due 31 Oct/);
  assert.match(await txt(toolbar), /Emailed to maya@northstar\.studio/);
  const receipt = await txt(rail);
  assert.match(receipt, /To maya@northstar\.studio/);
  assert.match(receipt, /Sent 16 Oct, \d\d:\d\d/);
  assert.match(receipt, /Amount due £15,606\.00/);
  assert.match(receipt, /pay\.example\.com\/i\/0048/);
  // The page locks once it's out.
  assert.equal(await page.locator('[data-demo="qty-1"]').isDisabled(), true);
  assert.equal(await page.locator('[data-demo="add-line"]').count(), 0);

  // Adding and removing lines in the wide layout, where buttons sit in the paper gutter.
  await page.setViewportSize({width:1440,height:1000});
  await mount(`${WIDE}window.last=null;createRoot(document.getElementById('root')).render(<Subject.InvoiceComposer onSend={d=>{window.last=d}}/>);`);
  const wide = page.getByRole("article", { name: "Invoice INV-0048" });
  await page.locator('[data-demo="add-line"]').click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Line 4 description");
  await page.getByRole("complementary", { name: "Delivery" }).filter({ hasText: "Line 4 needs a description, a quantity and a rate." }).waitFor();
  await page.keyboard.type("Rush fee");
  await page.getByLabel("Line 4 rate", { exact: true }).fill("300");
  assert.match(await spoken(wide), /Subtotal £13,050\.00/);
  await page.getByLabel("Line 1 description", { exact: true }).focus();
  await page.getByRole("button", { name: "Remove line 1" }).click();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Line 4 description"]'));
  assert.match(await spoken(wide), /Subtotal £6,650\.00/);
  await page.locator('[data-demo="send"]').click();
  await page.waitForFunction(() => window.last);
  assert.deepEqual(await page.evaluate(() => window.last.lines.map((l) => [l.description, l.quantity, l.unitMinor])), [
    ["Launch site design and build (sprint days)", 6, 85000],
    ["Motion study for the homepage hero", 1, 125000],
    ["Rush fee", 1, 30000],
  ]);
  assert.equal(await page.evaluate(() => window.last.totalMinor), 758100);
  await page.getByRole("complementary", {name:"Delivery"}).filter({hasText:"Invoice sent"}).waitFor();
  assert.equal(await page.getByRole("button", {name:"Copy payment link"}).count(), 0,
    "A receipt must not invent a link when the host returns none");

  // A zero-decimal currency: yen has no minor unit.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.InvoiceComposer currency="JPY" locale="en-GB" discountBasisPoints={0} taxBasisPoints={1000} initialLines={[{id:'a',description:'Workshop',quantity:1.5,unitMinor:1000}]}/>);`);
  const yen = page.getByRole("article", { name: "Invoice INV-0048" });
  assert.equal(await page.getByLabel("Line 1 rate", { exact: true }).inputValue(), "1,000");
  const yenTotal = await page.evaluate(() => new Intl.NumberFormat("en-GB", {style:"currency",currency:"JPY"}).format(1650));
  assert.ok((await spoken(yen)).includes(`Total due JPY ${yenTotal}`), "Yen total respects the locale and zero minor units");
  await page.getByLabel("Line 1 rate", { exact: true }).fill("1000.5");
  assert.equal(await page.getByLabel("Line 1 rate", { exact: true }).getAttribute("aria-invalid"), "true");

  // No lines.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.InvoiceComposer initialLines={[]}/>);`);
  await page.getByRole("complementary", { name: "Delivery" }).filter({ hasText: "Add at least one line." }).waitFor();
  assert.equal(await page.locator('[data-demo="send"]').isDisabled(), true);

  // Another sender's invoice must not print or link Fernhill's payment page.
  await mount(`window.done=false;createRoot(document.getElementById('root')).render(<Subject.InvoiceComposer sender={{name:'Acme Design Ltd',address:['1 High St','Leeds LS1 1AA'],bank:['Acme Design Ltd','Sort code 11-22-33']}} onSend={()=>{window.done=true}}/>);`);
  const acme = page.locator("section").first();
  assert.doesNotMatch(await txt(acme), /fernhill/i, "The payment link on the page names the demo company");
  await page.locator('[data-demo="send"]').click();
  await page.getByRole("complementary", { name: "Delivery" }).filter({ hasText: "Invoice sent" }).waitFor();
  assert.doesNotMatch(await txt(acme), /fernhill/i, "The receipt invents a payment link the host never returned");

  // A supplied payment base preserves its host, path, query and encoded invoice identity.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.InvoiceComposer number="AC/48" sender={{name:'Acme Design Ltd',address:['1 High St'],paymentLinkBase:'https://pay.acme.test/invoices/?workspace=main'}} onSend={()=>{}}/>);`);
  await page.getByText("pay.acme.test/invoices/AC%2F48?workspace=main", {exact:true}).waitFor();
  await page.locator('[data-demo="send"]').click();
  const noLink = page.getByRole("complementary", {name:"Delivery"});
  await noLink.filter({hasText:"Invoice sent"}).waitFor();
  assert.doesNotMatch(await txt(noLink), /pay\.acme/);
  assert.equal(await noLink.getByRole("button", {name:"Copy payment link"}).count(), 0);

  // On a phone-width page a line can still be removed.
  await page.setViewportSize({width:390,height:900});
  await mount(`createRoot(document.getElementById('root')).render(<Subject.InvoiceComposer/>);`);
  await page.getByLabel("Line 1 description", { exact: true }).focus();
  assert.equal(await page.getByRole("button", { name: "Remove line 1" }).isVisible(), true, "Remove line is display:none below a 672px container");
  await page.getByRole("button", {name:"Remove line 1"}).click();
  await page.waitForFunction(() => !document.querySelector('[aria-label="Line 3 description"]'));
  const firstRemaining = page.getByRole("textbox", {name:"Line 1 description", exact:true});
  assert.equal(await firstRemaining.count(), 1, "The outgoing row leaves the accessibility tree immediately");
  assert.equal(await firstRemaining.inputValue(), "Launch site design and build (sprint days)");
}
