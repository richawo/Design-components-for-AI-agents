const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");

export async function check({ page, mount, assert }) {
  await mount(`window.updates=[];window.undos=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.SupportTriage now="2026-10-17T09:42:00Z" onTriage={async u=>{window.updates.push(u);if(window.fail)throw Error('')}} onUndo={u=>{window.undos.push(u)}}/>);`);
  const root = page.locator("section").first();
  const appBar = root.locator("header").first();
  const inbox = page.getByRole("complementary", { name: "Inbox" });
  const card = (id) => page.locator(`[data-demo="ticket-${id}"]`);
  const order = () => inbox.locator('[data-demo^="ticket-"]').evaluateAll((els) => els.map((e) => e.dataset.demo.slice(7)));
  const reader = (subject) => page.getByRole("article", { name: subject });
  const queue = (name) => page.getByRole("region", { name: `${name} queue` });
  const owner = (name) => page.getByRole("radiogroup", { name: "Owner" }).getByRole("radio", { name: new RegExp(`^\\w+ ${name}`) });

  // Oldest first, each counting down against the 30-minute triage window.
  assert.match(await txt(appBar), /5 waiting · 1 past triage/);
  assert.deepEqual(await order(), ["sup-2485", "sup-2484", "sup-2483", "sup-2482", "sup-2481"]);
  assert.equal(await card("sup-2485").getAttribute("aria-pressed"), "true");
  assert.match(await txt(card("sup-2485")), /−7:\d\d late/);
  assert.match(await txt(card("sup-2481")), /\b2\d:\d\d$/);
  await reader("Typo in the weekly digest subject line").waitFor();
  assert.match(await txt(queue("Urgent")), /Urgent 1 1h reply/);
  assert.match(await txt(queue("High")), /High 1 4h reply/);
  assert.equal(await page.locator('[data-demo="route-urgent"]').getAttribute("aria-keyshortcuts"), "1");
  // The least-loaded available agent is suggested; away agents can't be picked.
  assert.equal(await page.locator('[data-demo="agent-priya"]').getAttribute("aria-checked"), "true");
  assert.equal(await page.locator('[data-demo="agent-sam"]').isDisabled(), true);

  // Keyboard: Up/Down on cards, J/K anywhere.
  await card("sup-2485").focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(await card("sup-2484").getAttribute("aria-pressed"), "true");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.demo), "ticket-sup-2484");
  await page.keyboard.press("j");
  await reader("Can we switch to annual billing mid-term?").waitFor();
  await page.keyboard.press("k");
  await reader("CSV export stops at 10,000 rows").waitFor();

  // Owner radiogroup skips the away agent.
  await page.locator('[data-demo="agent-priya"]').focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator('[data-demo="agent-alex"]').getAttribute("aria-checked"), "true");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator('[data-demo="agent-none"]').getAttribute("aria-checked"), "true");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.demo), "agent-none");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.locator('[data-demo="agent-alex"]').getAttribute("aria-checked"), "true");
  await page.locator('[data-demo="agent-noor"]').click();

  // Signature: press 2 and the ticket leaves for High. The host rejects; it comes back with the owner kept.
  await card("sup-2484").focus();
  await page.keyboard.press("2");
  await page.getByRole("alert").filter({ hasText: "The route didn’t save. SUP-2484 is back in the inbox." }).waitFor();
  await card("sup-2484").waitFor();
  assert.equal(await card("sup-2484").getAttribute("aria-pressed"), "true");
  await reader("CSV export stops at 10,000 rows").waitFor();
  assert.equal(await page.locator('[data-demo="agent-noor"]').getAttribute("aria-checked"), "true");
  assert.match(await txt(queue("High")), /High 1 /);
  assert.deepEqual(await page.evaluate(() => window.updates[0]), { ticketId: "SUP-2484", priority: "high", assigneeId: "noor" });

  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="route-high"]').click();
  const toast = page.getByRole("status").filter({ hasText: "SUP-2484 → High · Noor Ali" });
  await toast.waitFor();
  await queue("High").locator('[data-demo="queued-sup-2484"]').waitFor();
  assert.match(await txt(queue("High")), /High 2 /);
  await card("sup-2484").waitFor({ state: "detached" });
  assert.deepEqual(await page.evaluate(() => window.updates[1]), { ticketId: "SUP-2484", priority: "high", assigneeId: "noor" });
  // The next waiting ticket opens.
  await reader("Typo in the weekly digest subject line").waitFor();
  assert.match(await txt(appBar), /4 waiting/);

  // Undo returns it to the inbox and tells the host.
  await toast.getByRole("button", { name: "Undo" }).click();
  await card("sup-2484").waitFor();
  await reader("CSV export stops at 10,000 rows").waitFor();
  assert.deepEqual(await page.evaluate(() => window.undos), [{ ticketId: "SUP-2484", priority: "high", assigneeId: "noor" }]);
  assert.match(await txt(queue("High")), /High 1 /);

  // Route to Low by button, then re-route from the queue without changing the selection.
  await page.locator('[data-demo="route-low"]').click();
  await queue("Low").locator('[data-demo="queued-sup-2484"]').waitFor();
  await queue("Low").locator('[data-demo="queued-sup-2484"]').click();
  const routed = reader("CSV export stops at 10,000 rows");
  await routed.waitFor();
  assert.match(await txt(routed.getByRole("group", { name: "Triage" })), /In Low · first reply in 2\dh \d\dm/);
  assert.equal(await page.locator('[data-demo="route-low"]').getAttribute("aria-pressed"), "true");
  await page.locator('[data-demo="route-urgent"]').click();
  await queue("Urgent").locator('[data-demo="queued-sup-2484"]').waitFor();
  await reader("CSV export stops at 10,000 rows").waitFor();
  await queue("Low").locator('[data-demo="queued-sup-2484"]').waitFor({ state: "detached" });
  assert.deepEqual(await page.evaluate(() => window.updates.at(-1)), { ticketId: "SUP-2484", priority: "urgent", assigneeId: "noor" });

  // A failed reassignment restores the existing queue and describes that outcome.
  await page.evaluate(() => (window.fail = true));
  await page.locator('[data-demo="route-low"]').click();
  await page.getByRole("alert").filter({ hasText: "SUP-2484 is back in its previous queue." }).waitFor({ timeout: 4000 });
  await queue("Urgent").locator('[data-demo="queued-sup-2484"]').waitFor();
  assert.equal(await card("sup-2484").count(), 0);
  await queue("Low").locator('[data-demo="queued-sup-2484"]').waitFor({ state: "detached" });
  await page.evaluate(() => (window.fail = false));

  // Clear the inbox.
  const subjects = {
    "sup-2485": "Typo in the weekly digest subject line",
    "sup-2483": "Can we switch to annual billing mid-term?",
    "sup-2482": "invoice.paid webhooks returning 410 since 08:50",
    "sup-2481": "SSO login loop after rotating our IdP certificate",
  };
  for (const [id, subject] of Object.entries(subjects)) {
    await card(id).click();
    // Wait for the reader to switch: its route buttons act on the ticket it shows.
    await reader(subject).waitFor();
    await page.waitForFunction(() => document.querySelectorAll("article").length === 1);
    await page.locator('[data-demo="route-normal"]').click();
    await card(id).waitFor({ state: "detached" });
  }
  await inbox.filter({ hasText: "Nothing waiting. Nicely done." }).waitFor();
  assert.match(await txt(appBar), /0 waiting/);
  assert.match(await txt(queue("Normal")), /Normal 5 /);

  // No tickets at all.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SupportTriage now="2026-10-17T09:42:00Z" tickets={[]}/>);`);
  await page.getByText("Inbox zero").waitFor();
  assert.equal(await page.getByRole("region", { name: "Urgent queue" }).getByText("Empty").count(), 1);

  // Undo stays pending in the queue, preserves the route on rejection, and can be retried.
  await mount(`window.undoCount=0;createRoot(document.getElementById('root')).render(<Subject.SupportTriage now="2026-10-17T09:42:00Z" onUndo={()=>new Promise((resolve,reject)=>{window.undoCount++;window.resolveUndo=resolve;window.rejectUndo=()=>reject(Error('offline'))})}/>);`);
  await page.locator('[data-demo="route-low"]').click();
  const queued = page.getByRole("region", {name:"Low queue"}).locator('[data-demo="queued-sup-2485"]');
  await queued.waitFor();
  await page.getByRole("status").getByRole("button", { name: "Undo", exact:true }).click();
  assert.equal(await page.getByRole("button", {name:"Undoing…"}).isDisabled(), true);
  assert.equal(await page.getByRole("button").and(page.locator('[data-demo="ticket-sup-2485"]')).count(), 0);
  await queued.waitFor();
  await page.evaluate(() => {window.rejectUndo();});
  await page.getByRole("alert").filter({hasText:"Undo failed. The ticket stays routed. Try again."}).waitFor();
  await queued.waitFor();
  assert.equal(await page.getByRole("button").and(page.locator('[data-demo="ticket-sup-2485"]')).count(), 0);
  await page.getByRole("status").getByRole("button", {name:"Undo", exact:true}).click();
  assert.equal(await page.evaluate(() => window.undoCount), 2);
  await page.evaluate(() => {window.resolveUndo();});
  await page.locator('[data-demo="ticket-sup-2485"]').waitFor();
  await reader("Typo in the weekly digest subject line").waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);

  // A click during a reader swap cannot route the exiting ticket.
  await mount(`window.raceUpdates=[];createRoot(document.getElementById('root')).render(<Subject.SupportTriage now="2026-10-17T09:42:00Z" onTriage={u=>window.raceUpdates.push(u)}/>);`);
  await page.locator('[data-demo="ticket-sup-2481"]').click();
  await page.locator('[data-demo="route-high"]').click();
  await page.getByRole("region", {name:"High queue"}).locator('[data-demo="queued-sup-2481"]').waitFor();
  assert.deepEqual(await page.evaluate(() => window.raceUpdates.map(u=>u.ticketId)), ["SUP-2481"]);
  await page.locator('[data-demo="ticket-sup-2485"]').waitFor();

  // Unreadable receipt and message timestamps remain explicit without broken clocks or SVGs.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.SupportTriage now="2026-10-17T09:42:00Z" tickets={[{id:'T-1',subject:'Broken clock',customer:'Ada Park',company:'Acme',channel:'email',receivedAt:'yesterday',messages:[{id:'m1',author:'Ada Park',body:'Please check this.',at:'not-a-time',fromCustomer:true}]}]}/>);`);
  await page.getByRole("article", { name: "Broken clock" }).waitFor();
  assert.doesNotMatch(await txt(page.locator("section").first()), /NaN/);
  assert.match(await page.getByRole("alert").innerText(), /Invalid timestamps: T-1/);
  assert.match(await txt(page.locator("section").first()), /Time unavailable/);
  assert.equal(await page.locator('svg [d*="NaN"], svg [stroke-dashoffset="NaN"]').count(), 0);
}
