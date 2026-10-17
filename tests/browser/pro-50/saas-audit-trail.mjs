export async function check({ page, mount, assert, choose }) {
  const d = (name) => page.locator(`[data-demo="${name}"]`);
  const log = () => page.getByRole("list", { name: "Audit events" });
  const detail = () => page.getByRole("complementary", { name: "Event detail" });
  await mount(
    `window.calls=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.AuditTrail selectMode="native" onExport={async p=>{window.calls.push(p);if(window.fail)throw Error('offline')}}/>);`,
  );
  // Filtering by outcome narrows the log and opens the newest match.
  await choose(page.getByLabel("Outcome", { exact: true }), "denied");
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Audit events"] button').length === 2);
  await detail().getByRole("heading", { name: "Updated billing contact" }).waitFor();
  assert.match(await detail().innerText(), /"billingContact": "ap@astergroup\.com"/);
  assert.doesNotMatch(await detail().innerText(), /poNumber/);
  await d("changed-only").uncheck();
  await detail().getByText('"poNumber": "PO-88213"').waitFor();
  // A failed export keeps the filters; the retry sends exactly the events in view.
  await d("export").click();
  await page.getByRole("alert").filter({ hasText: "offline" }).waitFor();
  assert.match(await page.locator("footer").innerText(), /Your filters are kept/);
  await page.evaluate(() => (window.fail = false));
  await d("export").click();
  await page.getByText("audit-2026-10-17.csv").waitFor();
  const sent = await page.evaluate(() => window.calls[1]);
  assert.deepEqual(sent.eventIds, ["evt_8f2015", "evt_8f18e1"]);
  assert.equal(sent.format, "csv");
  assert.equal(sent.filters.outcome, "denied");
  // Keyboard: rows move with arrows, the selection follows.
  await d("event-evt-8f2015").focus();
  await page.keyboard.press("ArrowDown");
  await detail().getByRole("heading", { name: "Failed sign-in" }).waitFor();
  // Clicking an hour in the histogram keeps that hour; its edges are sliders.
  await choose(page.getByLabel("Outcome", { exact: true }), "all");
  await d("histogram").scrollIntoViewIfNeeded();
  const chart = await d("histogram").boundingBox();
  await page.mouse.click(chart.x + chart.width - 2, chart.y + 30);
  const start = page.getByRole("slider", { name: "Range start" });
  await start.waitFor();
  assert.equal(await start.getAttribute("aria-valuenow"), "71");
  const inHour = await log().getByRole("button").count();
  await start.focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await start.getAttribute("aria-valuenow"), "70");
  await page.waitForFunction(
    (n) => document.querySelectorAll('[aria-label="Audit events"] button').length > n,
    inHour,
  );
  await page.getByRole("button", { name: "Clear time range", exact: true }).click();
  await start.waitFor({ state: "detached" });
  // No match, then recovery.
  await d("search").fill("nothing-like-this");
  await page.getByText("No events match").waitFor();
  assert.equal(await d("export").isDisabled(), true);
  await page.getByRole("status").getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Audit events"] button').length > 100);

  // The custom listbox drives the same filter.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.AuditTrail/>);`);
  await choose(page.getByRole("combobox", { name: "Actor", exact: true }), "Sam Okafor");
  const actors = await log().locator("button").evaluateAll((rows) => rows.map((r) => r.textContent ?? ""));
  assert.ok(actors.length > 0 && actors.every((t) => t.includes("Sam Okafor")));

  // Empty and invalid data.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.AuditTrail events={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /Nothing recorded yet/);
  await mount(
    `const e={id:'a',at:'2026-10-17T09:00:00+02:00',actor:'Ada',action:'Earlier instant',target:'T',outcome:'success',requestId:'r1',before:{},after:{}};createRoot(document.getElementById('root')).render(<Subject.AuditTrail events={[e,{...e,id:'b',at:'2026-10-17T08:00:00Z',action:'Later instant',outcome:'denied'},{...e,id:'c',at:'not a date'},{...e,action:'Copy'}]}/>);`,
  );
  const alert = await page.getByRole("alert").innerText();
  assert.match(alert, /unreadable timestamp/);
  assert.match(alert, /repeats an id/);
  assert.match(await log().getByRole("button").first().innerText(), /later instant/);
  assert.equal(await log().getByRole("button").count(), 2);
}
