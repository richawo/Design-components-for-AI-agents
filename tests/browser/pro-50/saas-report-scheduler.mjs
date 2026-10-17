const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");
const SCHEDULE = {
  name: "Weekly revenue review",
  cadence: "weekly",
  weekday: 1,
  monthDay: 1,
  weekdaysOnly: true,
  time: "09:00",
  timeZone: "Europe/London",
  recipients: ["maya.chen@kestrel.app", "finance@kestrel.app", "board@northwind.vc"],
  sectionIds: ["revenue", "pipeline", "accounts"],
  format: "pdf",
};

export async function check({ page, mount, assert }) {
  await mount(`window.saves=[];window.tests=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.ReportScheduler now="2026-10-17T10:00:00Z" onSave={async s=>{window.saves.push(s);if(window.fail)throw Error('')}} onSendTest={s=>{window.tests.push(s)}}/>);`);
  const root = page.locator(".rs-root");
  const appBar = root.locator("header").first();
  const form = page.getByRole("form", { name: "Schedule" });
  const deliveries = page.getByRole("region", { name: "Upcoming deliveries" });
  const readout = deliveries.locator('[aria-live="polite"]');
  const footer = root.locator("footer");
  const save = page.locator('[data-demo="save"]');
  const has = (re) => root.filter({ hasText: re }).waitFor();

  // The report itself: subject, covered period, attachment and page count follow the schedule.
  assert.match(await txt(appBar), /Kestrel \/ Weekly revenue review Scheduled/);
  await has(/Subject\s*Weekly revenue review — 19 Oct/);
  await has(/12 Oct – 18 Oct 2026/);
  await has(/weekly-revenue-review\.pdf · 2 pages/);
  assert.match(await txt(root), /To maya\.chen@kestrel\.app, finance@kestrel\.app and 1 more/);
  assert.match(await txt(form), /Recipients 3 people · 1 external/);
  assert.equal(await save.isDisabled(), true);

  // Next deliveries in the schedule's zone with the UTC equivalent, across the clock change.
  await readout.filter({ hasText: "Mon, 19 Oct, 09:00 BST · 08:00 UTC" }).waitFor();
  assert.match(await txt(deliveries), /Mon, 19 Oct in 2 days Mon, 26 Oct 09:00 Mon, 2 Nov 09:00/);
  await deliveries.getByRole("button").nth(1).focus();
  await readout.filter({ hasText: /^Mon, 26 Oct, 09:00 GMT · 09:00 UTC$/ }).waitFor();
  assert.equal(await deliveries.getByRole("button").count(), 6);

  // Ticking a section adds it to the page, in the host's order.
  await page.locator('[data-demo="section-usage"]').click();
  await has(/Weekly active users, 8 weeks · 4,410 now/);
  assert.match(await txt(appBar), /Unsaved changes/);
  assert.equal(await save.isDisabled(), false);
  await page.locator('[data-demo="section-pipeline"]').click();
  await page.waitForFunction(() => !document.querySelector(".rs-root")?.textContent?.includes("$1.21M"));

  // Keyboard: weekday and cadence radiogroups follow the arrows; the dots and period move.
  await page.locator('[data-demo="weekday-1"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("radio", { name: "Tue", checked: true }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.demo), "weekday-2");
  await has(/Weekly revenue review — 20 Oct/);
  await has(/13 Oct – 19 Oct 2026/);
  await page.locator('[data-demo="cadence-weekly"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("radio", { name: "Monthly", checked: true }).waitFor();
  const monthDay = page.getByLabel("Day of the month", { exact: true });
  await monthDay.selectOption("1");
  await has(/1 Oct – 31 Oct 2026/);
  await readout.filter({ hasText: /^Sun, 1 Nov, 09:00 GMT · 09:00 UTC$/ }).waitFor();
  // Daily skips weekends unless told otherwise.
  await page.locator('[data-demo="cadence-daily"]').click();
  await readout.filter({ hasText: /^Mon, 19 Oct, 09:00 BST · 08:00 UTC$/ }).waitFor();
  await has(/^[\s\S]*18 Oct 2026/);
  await page.getByRole("switch", { name: "Skip weekends" }).uncheck();
  await readout.filter({ hasText: /^Sun, 18 Oct, 09:00 BST · 08:00 UTC$/ }).waitFor();
  await page.getByRole("switch", { name: "Skip weekends" }).check();
  await page.locator('[data-demo="cadence-weekly"]').click();
  // The zone moves the instant, not the wall clock.
  await page.getByLabel("Time zone", { exact: true }).selectOption("America/New_York");
  await readout.filter({ hasText: /^Tue, 20 Oct, 09:00 GMT-4 · 13:00 UTC$/ }).waitFor();

  // CSV turns the page into the rows the attachment will contain.
  await page.locator('[data-demo="format-pdf"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("radio", { name: "CSV", checked: true }).waitFor();
  await has(/weekly-revenue-review\.csv · 3 sections/);
  await has(/section\s*metric\s*value[\s\S]*revenue\s*mrr\s*\$412\.8k/);

  // Recipients: Enter, comma and paste add; invalid and duplicate addresses are refused in an alert.
  const add = page.getByLabel("Add recipient", { exact: true });
  await add.fill("Ops@Kestrel.app");
  await page.keyboard.press(",");
  await form.getByRole("button", { name: "Remove ops@kestrel.app" }).waitFor();
  await add.fill("nope");
  await page.keyboard.press("Enter");
  const alert = page.getByRole("alert").filter({ hasText: "“nope” isn’t an email address." });
  await alert.waitFor();
  assert.equal(await add.getAttribute("aria-invalid"), "true");
  assert.equal(await add.getAttribute("aria-describedby"), await alert.getAttribute("id"));
  assert.equal(await add.inputValue(), "nope");
  await add.fill("finance@kestrel.app");
  await page.keyboard.press("Enter");
  await page.getByRole("alert").filter({ hasText: "Already on the list." }).waitFor();
  await add.fill("cfo@kestrel.app; partner@northwind.vc");
  await page.keyboard.press("Tab");
  await form.getByRole("button", { name: "Remove partner@northwind.vc" }).waitFor();
  assert.match(await txt(form), /Recipients 6 people · 2 external/);
  // Backspace in the empty field removes the last chip.
  await add.focus();
  await page.keyboard.press("Backspace");
  await page.waitForFunction(() => !document.querySelector('[aria-label="Remove partner@northwind.vc"]'));
  await form.getByRole("button", { name: "Remove board@northwind.vc" }).click();
  assert.match(await txt(form), /Recipients 4 people/);

  // Problems block sending and saving.
  const name = page.getByLabel("Report name", { exact: true });
  await name.fill("");
  await footer.filter({ hasText: "Name the report" }).waitFor();
  assert.equal(await save.isDisabled(), true);
  assert.equal(await page.locator('[data-demo="send-test"]').isDisabled(), true);
  await has(/Untitled report/);
  await name.fill("Board pack");
  await has(/board-pack\.csv/);

  const expected = {
    ...SCHEDULE,
    name: "Board pack",
    weekday: 2,
    timeZone: "America/New_York",
    recipients: ["maya.chen@kestrel.app", "finance@kestrel.app", "ops@kestrel.app", "cfo@kestrel.app"],
    sectionIds: ["revenue", "accounts", "usage"],
    format: "csv",
  };
  // Send a test copy.
  await page.locator('[data-demo="send-test"]').click();
  await footer.filter({ hasText: "Test sent to you · check your inbox" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.tests[0]), expected);
  assert.match(await txt(appBar), /Unsaved changes/);

  // Save fails first and keeps the draft, then saves.
  await save.click();
  await page.getByRole("alert").filter({ hasText: "The schedule couldn’t be saved. Your changes are kept." }).waitFor();
  assert.match(await txt(appBar), /Unsaved changes/);
  assert.equal(await name.inputValue(), "Board pack");
  await page.evaluate(() => (window.fail = false));
  await save.click();
  await footer.filter({ hasText: "Saved · first delivery Tue, 20 Oct, 09:00" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.saves[1]), expected);
  assert.match(await txt(appBar), /Board pack Scheduled/);
  assert.equal(await save.isDisabled(), true);

  // No sections to choose from, and a zone the browser doesn't know.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ReportScheduler now="2026-10-17T10:00:00Z" sections={[]} defaultSchedule={${JSON.stringify({ ...SCHEDULE, sectionIds: [], timeZone: "Mars/Olympus" })}}/>);`);
  const bad = page.locator(".rs-root");
  await bad.filter({ hasText: "Choose at least one section to build the report." }).waitFor();
  await bad.locator("footer").filter({ hasText: "Choose a section · Pick a valid time zone" }).waitFor();
  await page.getByRole("region", { name: "Upcoming deliveries" }).filter({ hasText: "Nothing scheduled" }).waitFor();
  assert.match(await txt(bad), /No upcoming delivery/);
  assert.equal(await page.locator('[data-demo="send-test"]').isDisabled(), true);

  // No recipients yet.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ReportScheduler now="2026-10-17T10:00:00Z" defaultSchedule={${JSON.stringify({ ...SCHEDULE, recipients: [] })}}/>);`);
  await page.locator(".rs-root").filter({ hasText: "No recipients yet" }).waitFor();
  await page.locator(".rs-root footer").filter({ hasText: "Add a recipient" }).waitFor();
}
