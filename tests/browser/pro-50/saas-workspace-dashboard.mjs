export async function check({ page, mount, assert }) {
  const charted = async (label) => {
    await page.locator('[aria-label="Trend"] h3', { hasText: label }).waitFor();
    await page.waitForFunction(
      (label) => document.querySelector('[aria-label="Trend"] h3')?.textContent?.trim() === label,
      label,
    );
  };
  const live = () => page.locator('[data-demo="chart"] ~ p[aria-live]').innerText();
  await mount(
    `window.ranges=[];window.opened=[];createRoot(document.getElementById('root')).render(` +
      `<Subject.WorkspaceDashboard onRangeChange={r=>window.ranges.push(r)} ` +
      `onOpenDashboard={id=>window.opened.push(id)} onManagePlan={()=>window.opened.push('plan')}/>);`,
  );
  const users = page.getByRole("tab", { name: /Active users/ });
  assert.equal(await users.getAttribute("aria-selected"), "true");
  await charted("Active users");

  // The KPI tiles are the chart's tabs: arrows move between them and re-chart.
  await users.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("tab", { name: /Dashboard views/ }).getAttribute("aria-selected"), "true");
  await charted("Dashboard views");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await charted("Median query time");

  // The range is a radio group; every figure follows it.
  await page.getByRole("radio", { name: "90D" }).click();
  assert.deepEqual(await page.evaluate(() => window.ranges), ["90d"]);
  assert.match(await page.locator("section").first().innerText(), /compared with the 90 days before/);
  await page.getByRole("radio", { name: "90D" }).focus();
  await page.keyboard.press("ArrowLeft");
  assert.deepEqual(await page.evaluate(() => window.ranges), ["90d", "30d"]);
  assert.match(await page.locator("section").first().innerText(), /compared with the 30 days before/);

  // The chart reads day by day from the keyboard.
  await page.locator('[data-demo="chart"]').focus();
  await page.keyboard.press("End");
  assert.match(await live(), /17 Oct: 1\.\d\d s/);
  await page.keyboard.press("Home");
  assert.match(await live(), /18 Sept?:/);
  await page.keyboard.press("ArrowRight");
  assert.match(await live(), /19 Sept?:/);
  await page.keyboard.press("Escape");
  assert.equal(await live(), "");

  // Rows and the plan footer call back.
  await page.locator('[data-demo="dashboard-revenue"]').click();
  await page.locator('[data-demo="manage-plan"]').click();
  assert.deepEqual(await page.evaluate(() => window.opened), ["revenue", "plan"]);
  const seats = page.getByRole("meter", { name: "Seats" });
  assert.equal(await seats.getAttribute("aria-valuetext"), "41 of 50");

  // Empty data reads as empty, not broken.
  await mount(
    `createRoot(document.getElementById('root')).render(` +
      `<Subject.WorkspaceDashboard metrics={[]} dashboards={[]} activity={[]}/>);`,
  );
  const empty = await page.locator("section").first().innerText();
  assert.match(empty, /No metrics to chart yet/);
  assert.match(empty, /No dashboard was opened in this range/);
  assert.match(empty, /Quiet so far/);

  // Short history has no comparison; a zero limit does not divide by zero.
  const short = [{ id: "signups", label: "Signups", daily: [12, 9, 14, 11, 16], rollup: "sum" }];
  const plan = { name: "Trial", renewsOn: "2026-11-01", meters: [{ id: "seats", label: "Seats", used: 3, limit: 0 }] };
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.WorkspaceDashboard ` +
      `metrics={${JSON.stringify(short)}} plan={${JSON.stringify(plan)}} defaultRange="7d"/>);`,
  );
  const tab = page.getByRole("tab", { name: /Signups/ });
  assert.match(await tab.innerText(), /No prior period/);
  assert.match(await tab.innerText(), /62/);
  assert.match(await page.locator("section").first().innerText(), /0%/);

  // Loading is announced and skeletons stand in for figures.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.WorkspaceDashboard loading/>);`);
  assert.equal(await page.locator("section").first().getAttribute("aria-busy"), "true");
  assert.equal(await page.locator('[role="meter"]').count(), 0);
}
