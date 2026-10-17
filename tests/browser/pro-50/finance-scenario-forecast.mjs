const txt = async (locator) => (await locator.innerText()).replace(/\s+/g, " ");
const spoken = (locator) =>
  locator.evaluate((el) => {
    const copy = el.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll("*").forEach((n) => n.append(" "));
    return copy.textContent.replace(/\s+/g, " ").trim();
  });
// £200K in the bank, £40K out a month and nothing coming in: the base runs out at the end of month 6.
const MODEL = { openingCashMinor: 20_000_000, revenueMinor: 0, payrollMinor: 0, costPerHireMinor: 500_000, startMonth: "2027-01", horizonMonths: 12 };
const BASE = { growthPct: 0, hires: 0, spendMinor: 4_000_000, raiseMinor: 0, raiseMonth: 3 };
const RAISE = { ...BASE, raiseMinor: 26_000_000 };
const SCENARIOS = [
  { id: "base", name: "Base plan", drivers: BASE },
  { id: "raise", name: "Seed round", drivers: RAISE },
];
const props = (extra = "") => `model={${JSON.stringify(MODEL)}} scenarios={${JSON.stringify(SCENARIOS)}} ${extra}`;

export async function check({ page, mount, assert }) {
  await mount(`window.saves=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.ScenarioForecast ${props("onSaveScenario={async s=>{window.saves.push(s);if(window.fail)throw Error('')}}")}/>);`);
  const root = page.locator("section").first();
  const toolbar = root.locator("header").first();
  const tab = (name) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
  const readout = async () => spoken(root.locator(":scope > div").first());
  // Readouts crossfade (popLayout), so wait for the incoming text rather than reading mid-swap.
  const settled = async (re) => {
    for (let i = 0; i < 40; i++) {
      if (re.test(await readout())) return;
      await page.waitForTimeout(100);
    }
    assert.match(await readout(), re);
  };

  // The base plan: runway is the fractional month the balance first goes below zero.
  assert.match(await txt(toolbar), /Runway · Base plan Saved/);
  assert.equal(await tab("Base plan").getAttribute("aria-selected"), "true");
  await settled(/Runway 5\.0 months/);
  await settled(/Cash runs out Jun 2027 With no raise planned/);
  await settled(/Gap to close £280K by Dec 2027/);
  assert.match(await txt(root), /Cash out · Jun 2027/);
  assert.equal(await page.locator('[data-demo="raise-pin"]').count(), 0);

  // The raise scenario lands before the money runs out and is compared with the base.
  await tab("Seed round").click();
  await toolbar.filter({ hasText: "Runway · Seed round" }).waitFor();
  await settled(/Runway 11\.5 months \+6\.5 mo vs base/);
  await settled(/Cash runs out Dec 2027 With £260K landing Apr 2027/);
  const pin = page.getByRole("slider", { name: "Month the raise lands" });
  assert.equal(await pin.getAttribute("aria-valuetext"), "£260K lands in Apr 2027");
  assert.equal(await pin.getAttribute("aria-valuemax"), "11");

  // Signature: move the raise pin by keyboard until it lands too late.
  await pin.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  assert.equal(await pin.getAttribute("aria-valuetext"), "£260K lands in Aug 2027");
  await settled(/Runway 5\.0 months/);
  await settled(/Cash runs out Jun 2027 2 months before the £260K lands/);
  await toolbar.filter({ hasText: /Unsaved changes/ }).waitFor();
  await tab("Seed round").filter({ has: page.getByLabel("edited") }).waitFor();
  await page.keyboard.press("Home");
  assert.equal(await pin.getAttribute("aria-valuetext"), "£260K lands in Jan 2027");
  await page.keyboard.press("End");
  assert.equal(await pin.getAttribute("aria-valuetext"), "£260K lands in Dec 2027");
  await page.keyboard.press("Home");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");

  // Drivers are labelled native ranges.
  const spend = page.getByLabel("Monthly spend", { exact: true });
  assert.equal(await spend.getAttribute("aria-valuetext"), "£40K");
  await spend.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await spend.getAttribute("aria-valuetext"), "£42K");
  await page.getByLabel("New hires", { exact: true }).fill("2");
  assert.equal(await page.getByLabel("New hires", { exact: true }).getAttribute("aria-valuetext"), "2 people");
  assert.match(await txt(root), /Adds £10K \/ mo at full team/);
  // £200K, −£42K a month, hires joining at £5K each from month one, £260K landing in April.
  await settled(/Runway 8\.\d months/);

  // Edits are kept per scenario across tab switches; Reset puts the scenario back.
  await tab("Base plan").click();
  await toolbar.filter({ hasText: "Runway · Base plan" }).waitFor();
  await settled(/Runway 5\.0 months/);
  await tab("Seed round").click();
  await toolbar.filter({ hasText: "Runway · Seed round" }).waitFor();
  assert.equal(await page.getByLabel("New hires", { exact: true }).inputValue(), "2");
  await toolbar.getByRole("button", { name: "Reset" }).click();
  assert.equal(await page.getByLabel("New hires", { exact: true }).inputValue(), "0");
  await toolbar.filter({ hasText: /Seed round\s*Saved\s*Save scenario/ }).waitFor();
  await page.getByLabel("New hires", { exact: true }).fill("1");

  // Saving fails first and keeps the edits; then it saves with the projected months.
  await page.locator('[data-demo="save"]').click();
  await page.getByRole("alert").filter({ hasText: "Couldn’t save the scenario. Your changes are still here." }).waitFor();
  await toolbar.filter({ hasText: /Not saved/ }).waitFor();
  assert.match(await txt(page.locator('[data-demo="save"]')), /Try again/);
  assert.equal(await page.getByLabel("New hires", { exact: true }).inputValue(), "1");
  await page.evaluate(() => (window.fail = false));
  await page.locator('[data-demo="save"]').click();
  await toolbar.filter({ hasText: "Saved · v2" }).waitFor();
  const saved = await page.evaluate(() => window.saves[1]);
  assert.deepEqual(saved.drivers, { ...RAISE, hires: 1 });
  assert.equal(saved.id, "raise");
  assert.equal(saved.name, "Seed round");
  assert.equal(saved.months.length, 12);
  assert.deepEqual(saved.months[0], { month: "2027-01", cashMinor: 15_500_000 });
  assert.deepEqual(saved.months[3], { month: "2027-04", cashMinor: 28_000_000 });
  // £200K − (£45K × 12) + £260K = −£80K at the end; it first dips below zero in Nov 2027.
  assert.deepEqual(saved.months[11], { month: "2027-12", cashMinor: -8_000_000 });
  assert.equal(saved.cashOutMonth, "2027-11");
  assert.equal(saved.runwayMonths, 10.2);

  // A scenario that never runs out inside the horizon.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ScenarioForecast model={${JSON.stringify(MODEL)}} scenarios={${JSON.stringify([{ id: "lean", name: "Lean", drivers: { ...BASE, raiseMinor: 50_000_000 } }])}}/>);`);
  const lean = page.locator("section").first().locator(":scope > div").first();
  assert.match(await spoken(lean), /Runway 12\+ months/);
  assert.match(await spoken(lean), /Cash runs out Not before Dec 2027 With £500K landing Apr 2027/);
  assert.match(await spoken(lean), /Lowest balance £80K Mar 2027/);

  // A business already overdrawn has no runway; it must not read as never running out.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.ScenarioForecast model={${JSON.stringify({ ...MODEL, openingCashMinor: -1_000_000 })}} scenarios={${JSON.stringify([SCENARIOS[0]])}}/>);`);
  const overdrawn = await spoken(page.locator("section").first().locator(":scope > div").first());
  assert.doesNotMatch(overdrawn, /12\+ months|Not before/, `Overdrawn opening balance reads as safe: ${overdrawn.slice(0, 120)}`);
}
