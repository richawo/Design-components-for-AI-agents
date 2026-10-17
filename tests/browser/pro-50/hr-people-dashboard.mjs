export async function check({ page, mount, assert, choose }) {
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PeopleDashboard/>);`);
  const kpis = () => page.locator("dl").first().innerText();
  const section = () => page.locator("section").first().innerText();
  // Every figure comes from start and end dates as of the reference date.
  assert.match(await kpis(), /Headcount\n38\n\+7\nin 12 months/);
  assert.match(await kpis(), /Leavers · 12 months\n5\n/);
  const coming = page.getByRole("region", { name: "Upcoming milestones" });
  assert.match(await coming.innerText(), /Noor Ali\n.*First day/s);
  assert.match(await coming.innerText(), /Kofi Mensah\n.*Probation review/s);
  assert.match(await coming.innerText(), /Alex Morgan\n.*6-year anniversary/s);

  // The trend is a keyboard scrubber over the twelve months.
  const trend = page.getByRole("slider", { name: "Headcount by month" });
  await trend.focus();
  await page.keyboard.press("ArrowLeft");
  assert.match(await trend.getAttribute("aria-valuetext"), /^Sept? 2026: \d+ people, 2 hires, 0 leavers$/);
  await page.keyboard.press("Home");
  assert.match(await trend.getAttribute("aria-valuetext"), /^Nov 2025: 32 people, 1 hire, 0 leavers$/);

  // Look-ahead is a radio group with arrow keys.
  const before = (await coming.locator("li").count());
  await page.getByRole("radio", { name: "30d" }).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("radio", { name: "60d" }).getAttribute("aria-checked"), "true");
  await page.getByRole("button", { name: /more$/ }).click();
  assert.ok((await coming.locator("li").count()) > before);

  // Scoping to a department re-measures everything, from the picker or the department rows.
  await choose(page.locator('[data-demo="department"]'), "Product");
  assert.match(await kpis(), /Headcount\n6\n/);
  assert.match(await page.getByRole("region", { name: "Open roles" }).innerText(), /Open roles · 1\n.*Staff Product Designer/is);
  // Rows for other departments leave with a short exit.
  await coming.filter({ hasNotText: "Kofi Mensah" }).waitFor();
  assert.match(await coming.innerText(), /Theo Okafor/);
  const product = page.getByRole("button", { name: /^Product/ , pressed: true });
  await product.click();
  assert.match(await kpis(), /Headcount\n38\n/);
  await page.locator('[data-demo="dept-0"]').click();
  assert.equal(await page.locator('[data-demo="dept-0"]').getAttribute("aria-pressed"), "true");
  assert.match(await page.getByRole("button", { name: /^Department: Engineering/ }).innerText(), /Engineering/);

  // Small, invalid and empty rosters.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PeopleDashboard subtitle="Commercial" employees={[{id:'noor',name:'Noor Ali',role:'Customer partner',department:'Commercial',location:'London',status:'onboarding',startDate:'2026-10-12',manager:'Alex Morgan'}]} milestones={[{id:'start',employeeId:'noor',date:'2026-10-12',label:'Welcome breakfast'}]} referenceDate="2026-10-11"/>);`);
  assert.match(await kpis(), /Headcount\n0\n/);
  assert.match(await coming.innerText(), /Welcome breakfast/);
  assert.match(await page.getByRole("region", { name: "Open roles" }).innerText(), /No open roles/);
  assert.doesNotMatch(await section(), /NaN|Infinity|undefined/);
  const base = { role: "Engineer", department: "Engineering", location: "London", status: "active", manager: "Jordan Blake" };
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PeopleDashboard employees={${JSON.stringify([
    { ...base, id: "a", name: "Ada Park", startDate: "2024-01-08" },
    { ...base, id: "a", name: "Ada Again", startDate: "2024-01-08" },
    { ...base, id: "b", name: "Ben Ito", startDate: "2024-02-30" },
  ])}}/>);`);
  const alert = await page.getByRole("alert").innerText();
  assert.match(alert, /Ada Again appears twice/);
  assert.match(alert, /1 record has an invalid start or end date/);
  assert.match(await kpis(), /Headcount\n1\n/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PeopleDashboard referenceDate="2026-02-30"/>);`);
  assert.match(await page.getByRole("alert").innerText(), /valid reference date/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PeopleDashboard employees={[]}/>);`);
  assert.match(await section(), /No one on the roster yet/);
}
