export async function check({ page, mount, assert }) {
  const region = page.getByRole("region", { name: "Selected event" });
  // The detail swaps outgoing-first, so wait for the incoming event before reading it.
  const detail = async (re) => {
    if (re) await region.getByText(re).first().waitFor();
    return region.innerText();
  };
  const feed = () => page.getByRole("list", { name: "Events, newest first" }).innerText();
  const scrubber = page.getByRole("slider", { name: "Timeline position" });
  await mount(`window.notes=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.CustomerTimeline onAddNote={async d=>{window.notes.push(d);if(window.fail)throw Error('offline')}}/>);`);
  // Opens on the latest event, with lifetime value to date.
  assert.match(await detail(/Where’s my order #4788\?/), /Where’s my order #4788\?/);
  assert.match(await page.locator("section").first().innerText(), /£934\.50/);
  // Picking an order moves the scrubber and recomputes the ledger as of that date.
  await page.locator('[data-demo="marker-o-1903"]').click();
  assert.match(await detail(/Order #1903/), /Order #1903/);
  assert.match(await detail(/FIELD20/), /FIELD20/);
  assert.match(await scrubber.getAttribute("aria-valuetext"), /29 Nov 2024, lifetime value £404\.00/);
  // Arrow keys step event by event; Home and End jump to the ends.
  await scrubber.focus();
  await page.keyboard.press("ArrowRight");
  assert.match(await detail(/Weekender stuck at the depot/), /Weekender stuck at the depot/);
  await page.keyboard.press("Home");
  assert.match(await scrubber.getAttribute("aria-valuetext"), /lifetime value £0\.00/);
  await page.keyboard.press("End");
  assert.match(await scrubber.getAttribute("aria-valuetext"), /lifetime value £934\.50/);
  // Filters narrow the feed.
  await page.locator('[data-demo="filter-return"]').click();
  await page.locator('[data-demo="event-o-1042"]').waitFor({ state: "detached" });
  assert.match(await feed(), /Return RMA-391/);
  assert.doesNotMatch(await feed(), /Order #1042/);
  await page.keyboard.press("ArrowLeft");
  await page.locator('[data-demo="event-o-1042"]').waitFor();
  assert.match(await feed(), /Order #1042/);
  // A conversation links to its order.
  await page.locator('[data-demo="filter-all"]').click();
  await page.locator('[data-demo="event-s-wismo"]').click();
  await page.locator('[data-demo="linked-order"]').click();
  assert.match(await detail(/Order #4788/), /Order #4788/);
  assert.match(await detail(/Unfulfilled/), /Unfulfilled/);
  // A failed note keeps the draft; the retry lands on the timeline.
  const note = page.getByRole("textbox", { name: "Note about Maya Okonkwo" });
  await note.fill("Called about #4788; stock lands Monday.");
  await page.locator('[data-demo="add-note"]').click();
  await page.getByRole("alert").filter({ hasText: "offline" }).waitFor();
  assert.match(await page.getByRole("alert").innerText(), /Your note is kept/);
  assert.equal(await note.inputValue(), "Called about #4788; stock lands Monday.");
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="add-note"]').click();
  await page.getByText(/Note added to Maya’s timeline/).waitFor();
  assert.equal(await note.inputValue(), "");
  assert.deepEqual(await page.evaluate(() => window.notes[1]), { customerId: "cus_8841", body: "Called about #4788; stock lands Monday." });
  assert.match(await detail(/Note from Sam Okafor/), /Note from Sam Okafor/);
  assert.match(await feed(), /Called about #4788/);

  // Duplicate IDs are flagged; an empty history is designed.
  const dup = [
    { id: "x", kind: "note", at: "2026-01-02", author: "Noor Ali", body: "First" },
    { id: "x", kind: "note", at: "2026-02-02", author: "Noor Ali", body: "Second" },
  ];
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CustomerTimeline events={${JSON.stringify(dup)}}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /Duplicate event IDs: x/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CustomerTimeline events={[]}/>);`);
  assert.match(await page.locator("section").first().innerText(), /No history yet/);
  assert.match(await page.locator("section").first().innerText(), /No activity yet/);
}
