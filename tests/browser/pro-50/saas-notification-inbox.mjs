export async function check({ page, mount, assert }) {
  // The preview cross-fades, so wait for the one that should be showing to be the only one left.
  const showing = async (text) => {
    await page.locator("article", { hasText: text }).waitFor();
    await page.waitForFunction(() => document.querySelectorAll("article").length === 1);
  };
  const unread = () => page.locator("header .sr-only").first().innerText();
  const calls = () => page.evaluate(() => window.calls.map((c) => `${c.type}:${c.id}`));
  await mount(
    `window.calls=[];window.failOn=new Set(['archive','snooze']);` +
      `createRoot(document.getElementById('root')).render(<Subject.NotificationInbox onAction={async a=>{` +
      `window.calls.push(a);if(window.failOn.has(a.type))throw Error('Server offline.')}}/>);`,
  );
  assert.match(await unread(), /^7 unread/);
  await showing("Priya mentioned you");

  // Opening a notification reads it; J moves on and reads the next.
  await page.locator('[data-demo="row-n1"]').click();
  await page.keyboard.press("j");
  await showing("Alex replied");
  assert.deepEqual(await calls(), ["read:n1", "read:n3"]);
  assert.match(await unread(), /^5 unread/);

  // A rejected archive puts the row back and says why; a second try succeeds and Z undoes it.
  await page.keyboard.press("e");
  await page.getByRole("alert").filter({ hasText: "Server offline." }).waitFor();
  await page.locator('[data-demo="row-n3"]').waitFor();
  await showing("Alex replied");
  await page.evaluate(() => window.failOn.delete("archive"));
  await page.keyboard.press("e");
  await page.getByRole("status").filter({ hasText: "Archived" }).waitFor();
  await page.locator('[data-demo="row-n3"]').waitFor({ state: "detached" });
  await page.keyboard.press("z");
  await page.locator('[data-demo="row-n3"]').waitFor();
  assert.deepEqual((await calls()).slice(-3), ["archive:n3", "archive:n3", "unarchive:n3"]);

  // Snooze waits for the host: a failure keeps the dialog and the chosen time.
  await page.locator('[data-demo="row-n2"]').click();
  await page.keyboard.press("s");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await page.locator('[data-demo="preset-monday"]').click();
  const confirm = page.locator('[data-demo="snooze-confirm"]');
  assert.match(await confirm.innerText(), /Mon 09:00/);
  await confirm.click();
  await dialog.getByRole("alert").filter({ hasText: "Your time is kept" }).waitFor();
  assert.match(await confirm.innerText(), /Mon 09:00/);
  // The scrubber moves half an hour per arrow key.
  await page.locator('[data-demo="snooze-track"]').focus();
  await page.keyboard.press("ArrowRight");
  assert.match(await confirm.innerText(), /Mon 09:30/);
  await page.evaluate(() => window.failOn.delete("snooze"));
  await confirm.click();
  await dialog.waitFor({ state: "detached" });
  await page.getByRole("status").filter({ hasText: "Snoozed to Mon 09:30" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.calls.at(-1)), {
    type: "snooze",
    id: "n2",
    until: "2026-10-19T08:30:00.000Z",
  });
  await page.locator('[data-demo="view-snoozed"]').click();
  await page.locator('[data-demo="row-n2"]').waitFor();
  await page.locator('[data-demo="row-n11"]').waitFor();

  // Escape closes the dialog and hands focus back to the row.
  await page.locator('[data-demo="view-inbox"]').click();
  await page.locator('[data-demo="row-n1"]').click();
  await page.keyboard.press("s");
  await dialog.waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "row-n1");

  // Empty and invalid data.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.NotificationInbox notifications={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /You’re all caught up/);
  const item = { source: "alert", title: "Disk almost full", context: "Usage", at: "2026-10-17T09:00:00Z" };
  const bad = [
    { ...item, id: "a" },
    { ...item, id: "a", title: "Second copy" },
    { ...item, id: "b", at: "yesterday-ish" },
  ];
  await mount(
    `createRoot(document.getElementById('root')).render(` +
      `<Subject.NotificationInbox notifications={${JSON.stringify(bad)}}/>);`,
  );
  assert.match(
    await page.getByRole("alert").innerText(),
    /2 notifications were left out: duplicate id “a”; unreadable time on “b”/,
  );
  await page.locator('[data-demo="row-a"]').waitFor();
  assert.equal(await page.locator('[data-demo^="row-"]').count(), 1);
}
