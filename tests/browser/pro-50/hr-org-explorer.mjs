export async function check({ page, mount, assert }) {
  const panel = () => page.getByRole("complementary", { name: "Selected colleague" }).innerText();
  await mount(`createRoot(document.getElementById('root')).render(<Subject.OrgExplorer/>);`);
  assert.match(await panel(), /Morgan Lee/);
  assert.match(await panel(), /Top of the organisation/i);
  await page.locator('[data-demo="node-jordan"]').click();
  assert.match(await panel(), /Jordan Blake/);
  assert.match(await panel(), /Direct reports · 2/i);
  await page.locator('[data-demo="report-0"]').click();
  assert.match(await panel(), /Sam Rivera/);
  // Arrow Up walks to the manager from the focused node.
  await page.locator('[data-demo="node-sam"]').focus();
  await page.evaluate(() => {
    const raf = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    const held = new Map(); let id = 1_000_000;
    window.requestAnimationFrame = callback => { held.set(++id, callback); return id; };
    window.cancelAnimationFrame = key => { if (!held.delete(key)) cancel(key); };
    window.releaseOrgFrames = () => {
      window.requestAnimationFrame = raf; window.cancelAnimationFrame = cancel;
      for (const callback of held.values()) callback(performance.now());
      held.clear();
    };
  });
  await page.keyboard.press("ArrowUp");
  assert.match(await panel(), /Jordan Blake/);
  // Search jumps to a person.
  const search = page.getByRole("combobox", { name: "Find a colleague" });
  await search.fill("Platform");
  await page.evaluate(() => window.releaseOrgFrames());
  assert.equal(await search.evaluate(node => node === document.activeElement), true,
    "A delayed tree frame cannot retake focus from search");
  assert.equal(await search.getAttribute("aria-expanded"), "true");
  await page.getByRole("option", { name: /Casey Jones/ }).click();
  assert.match(await panel(), /Casey Jones/);
  // The chain of command links back up.
  await page.locator('[data-demo="crumb-0"]').click();
  assert.match(await panel(), /Morgan Lee/);

  const base = { role: "Lead", team: "Team", location: "London" };
  await mount(`createRoot(document.getElementById('root')).render(<Subject.OrgExplorer people={${JSON.stringify([{ ...base, id: "a", name: "Ada Park", managerId: "b" }, { ...base, id: "b", name: "Ben Ito", managerId: "a" }])}}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /cycle/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.OrgExplorer people={${JSON.stringify([{ ...base, id: "a", name: "Ada Park", managerId: "missing" }])}}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /manager record is missing/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.OrgExplorer people={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /No one on the chart yet/);
}
