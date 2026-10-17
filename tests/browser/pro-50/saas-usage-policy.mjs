const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");
// Counted figures render twice (an animated aria-hidden copy and the spoken value); read the spoken text.
const spoken = (locator) =>
  locator.evaluate((el) => {
    const copy = el.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll("*").forEach((n) => n.append(" "));
    return copy.textContent.replace(/\s+/g, " ").trim();
  });
// Ten days at 100 a day: 1,000 used, projected 3,000 by day 30. The chart scale is 0–4,000 in steps of 20.
const TOKENS = "{id:'tokens',name:'Tokens',unit:'tokens',daily:[100,200,300,400,500,600,700,800,900,1000],warnAt:1500,limit:2000,enforcement:'notify',notifyAdmins:false}";
const SEATS = "{id:'seats',name:'Seats',unit:'seats',daily:[10,10,11,11,12,12,12,13,13,14],warnAt:18,limit:20,enforcement:'block',notifyAdmins:true,consequences:{block:'New invites are refused until a seat frees up.'}}";
const mountWith = (metrics, extra = "") =>
  `createRoot(document.getElementById('root')).render(<Subject.UsagePolicy periodStart="2026-10-01" periodDays={30} metrics={[${metrics}]} ${extra}/>);`;

export async function check({ page, mount, assert }) {
  await mount(`window.saves=[];window.fail=true;${mountWith(`${TOKENS},${SEATS}`, "onSave={async d=>{window.saves.push(d);if(window.fail)throw Error('')}}")}`);
  const root = page.locator(".up-root");
  const tab = (id) => page.locator(`[data-demo="metric-${id}"]`);
  const limit = page.getByRole("slider", { name: "Limit for Tokens" });
  const warn = page.getByRole("slider", { name: "Warn at for Tokens" });
  const footer = root.locator("footer");
  const save = page.locator('[data-demo="save"]');

  // Projection from the last seven days' pace, with where it crosses each threshold.
  assert.equal(await tab("tokens").getAttribute("aria-selected"), "true");
  assert.match(await spoken(tab("tokens")), /Tokens Limit ~Oct 20 1,000 \/ 2K/);
  assert.equal(await page.getByRole("img", { name: /^Tokens:/ }).getAttribute("aria-label"), "Tokens: 1,000 used, 3,000 projected");
  assert.match(await txt(root), /Day 10 of 30/);
  assert.match(await txt(root), /Warning ~Oct 15/);
  assert.match(await txt(root), /Limit ~Oct 20/);
  assert.equal(await limit.getAttribute("aria-valuetext"), "2,000 tokens");
  assert.equal(await limit.getAttribute("aria-orientation"), "vertical");
  assert.match(await txt(footer), /No unsaved changes/);
  assert.equal(await save.isDisabled(), true);

  // Signature: move the limit handle by keyboard (step 20, Page and Shift ×10, End, Home).
  await limit.focus();
  await page.keyboard.press("ArrowUp");
  assert.equal(await limit.getAttribute("aria-valuetext"), "2,020 tokens");
  await page.keyboard.press("PageUp");
  assert.equal(await limit.getAttribute("aria-valuetext"), "2,220 tokens");
  await page.keyboard.press("Shift+ArrowDown");
  assert.equal(await limit.getAttribute("aria-valuetext"), "2,020 tokens");
  await page.keyboard.press("End");
  assert.equal(await limit.getAttribute("aria-valuetext"), "4,000 tokens");
  assert.match(await spoken(tab("tokens")), /Tokens Warns ~Oct 15/);
  // The limit can't drop to or below the warning.
  await page.keyboard.press("Home");
  assert.equal(await limit.getAttribute("aria-valuetext"), "1,520 tokens");
  assert.match(await spoken(tab("tokens")), /Limit ~Oct 16/);
  assert.match(await txt(footer), /1 change on 1 meter: Tokens limit 2,000 → 1,520/);
  // …and the warning can't rise past the limit.
  await warn.focus();
  await page.keyboard.press("End");
  assert.equal(await warn.getAttribute("aria-valuetext"), "1,500 tokens");
  await page.keyboard.press("PageDown");
  assert.equal(await warn.getAttribute("aria-valuetext"), "1,300 tokens");

  // The policy panel: stepper typing, enforcement radios with arrows, the admin switch.
  const panel = page.getByRole("complementary", { name: "Tokens policy" });
  const warnInput = panel.getByRole("textbox", { name: "Warn at" });
  assert.equal(await warnInput.inputValue(), "1,300");
  await warnInput.fill("1,200");
  await page.keyboard.press("Enter");
  assert.equal(await warn.getAttribute("aria-valuetext"), "1,200 tokens");
  await panel.getByRole("button", { name: "Raise limit" }).press("Enter");
  assert.equal(await limit.getAttribute("aria-valuetext"), "1,540 tokens");
  await page.locator('[data-demo="enforce-notify"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("radio", { name: "Throttle", checked: true }).waitFor();
  await panel.filter({ hasText: "Past 1,540 tokens, usage is rate-limited until Oct 31." }).waitFor();
  await panel.getByRole("switch").check();
  await footer.filter({ hasText: /4 changes on 1 meter/ }).waitFor();

  // Simulated demand redraws the projection only.
  await page.locator('[data-demo="simulate"]').fill("100");
  assert.equal(await page.getByRole("img", { name: /^Tokens:/ }).getAttribute("aria-label"), "Tokens: 1,000 used, 5,000 projected");
  await footer.filter({ hasText: /4 changes on 1 meter/ }).waitFor();

  // Tabs move with the arrow keys; drafts stay per meter.
  await tab("tokens").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await tab("seats").getAttribute("aria-selected"), "true");
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.demo), "metric-seats");
  await page.getByRole("complementary", { name: "Seats policy" }).filter({ hasText: "New invites are refused until a seat frees up." }).waitFor();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await limit.getAttribute("aria-valuetext"), "1,540 tokens");

  // Save fails first; the draft is kept.
  await save.click();
  await page.getByRole("alert").filter({ hasText: "The policy couldn’t be saved. Your changes are kept." }).waitFor();
  assert.equal(await limit.getAttribute("aria-valuetext"), "1,540 tokens");
  assert.equal(await save.isDisabled(), false);
  await page.evaluate(() => (window.fail = false));
  await save.click();
  await footer.filter({ hasText: "Policy saved · applies to new usage now" }).waitFor();
  assert.equal(await page.evaluate(() => window.saves.length), 2);
  assert.deepEqual(await page.evaluate(() => window.saves[1]), {
    policies: [
      { metricId: "tokens", warnAt: 1200, limit: 1540, enforcement: "throttle", notifyAdmins: true },
      { metricId: "seats", warnAt: 18, limit: 20, enforcement: "block", notifyAdmins: true },
    ],
  });
  await footer.filter({ hasText: "No unsaved changes" }).waitFor({ timeout: 5000 });
  assert.equal(await save.isDisabled(), true);

  // Discard returns to the saved policy.
  await limit.focus();
  await page.keyboard.press("ArrowUp");
  await footer.filter({ hasText: /1 change on 1 meter: Tokens limit 1,540 → 1,560/ }).waitFor();
  await footer.getByRole("button", { name: "Discard" }).click();
  assert.equal(await limit.getAttribute("aria-valuetext"), "1,540 tokens");
  await footer.filter({ hasText: "No unsaved changes" }).waitFor();

  // Compact handles retain their displayed threshold, including six-character abbreviations.
  await mount(mountWith("{id:'t',name:'Tokens',unit:'tokens',daily:[100],warnAt:123456,limit:987654,enforcement:'notify',notifyAdmins:false}"));
  assert.equal(await page.getByRole("slider", {name:"Limit for Tokens"}).locator("span span").last().evaluate(
    el => el.scrollWidth <= el.clientWidth
  ), true, "Compact threshold is truncated");

  // No meters.
  await mount(mountWith(""));
  await page.getByText("No metered resources").waitFor();

  // A warning the host set above the limit must not be presented as a valid policy.
  await mount(mountWith("{id:'t',name:'Tokens',unit:'tokens',daily:[100,200],warnAt:3000,limit:2000,enforcement:'notify',notifyAdmins:false}"));
  const inverted = page.getByRole("slider", { name: "Warn at for Tokens" });
  const warnNow = Number(await inverted.getAttribute("aria-valuenow"));
  const limitNow = Number(await page.getByRole("slider", { name: "Limit for Tokens" }).getAttribute("aria-valuenow"));
  assert.ok(warnNow < limitNow || (await page.getByRole("alert").count()) > 0, `Warn at ${warnNow} sits above the limit ${limitNow} without a warning`);

  assert.match(await page.getByRole("alert").innerText(), /Invalid warning thresholds: Tokens/);
  assert.equal(await page.locator('[data-demo="save"]').isDisabled(), true);
  await inverted.focus();
  await page.keyboard.press("Home");
  assert.equal(await inverted.getAttribute("aria-valuenow"), "0");
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.equal(await page.locator('[data-demo="save"]').isDisabled(), false);

  // A meter with no usage yet still draws valid geometry.
  await mount(mountWith("{id:'t',name:'Tokens',unit:'tokens',daily:[],warnAt:1500,limit:2000,enforcement:'notify',notifyAdmins:false}"));
  await page.getByRole("img", { name: /^Tokens:/ }).waitFor();
  assert.equal(await page.locator('path[d]:not([d^="M"]):not([d=""])').count(), 0, "Chart path without a moveto");
  await page.getByText("No usage recorded yet").waitFor();
  assert.equal(await page.getByRole("img", {name: "Tokens: no usage recorded"}).count(), 1);
}
