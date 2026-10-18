export async function check({ page, mount, assert }) {
  const days = [
    { date: "2025-01-01", value: 3 },
    { date: "2026-01-01", value: 0 },
    { date: "2026-01-02", value: null },
    { date: "2026-01-08", value: 8 },
  ];
  await mount(
    `window.selected=[];window.years=[];const root=createRoot(document.getElementById('root'));window.renderStatus=status=>root.render(<Subject.ChartCalendarHeatmap days={${JSON.stringify(days)}} defaultYear={2026} status={status} onRetry={()=>window.renderStatus('ready')} onYearChange={y=>window.years.push(y)} onSelectDate={(date,day)=>window.selected.push({date,day})}/>);window.renderStatus('ready');`,
  );
  assert.ok((await page.getByText("1 day", { exact: true }).count()) > 0, "A one-day streak uses the singular label");
  const grid = page.locator('[data-demo="heatmap-grid"]');
  await grid.press("Home");
  await grid.press("Enter");
  assert.deepEqual(await page.evaluate(() => window.selected.at(-1)), {
    date: "2026-01-01",
    day: { date: "2026-01-01", value: 0 },
  });
  await grid.press("ArrowDown");
  await grid.press("Space");
  assert.deepEqual(await page.evaluate(() => window.selected.at(-1)), {
    date: "2026-01-02",
    day: { date: "2026-01-02", value: null },
  });
  await grid.press("Escape");
  assert.deepEqual(await page.evaluate(() => window.selected.at(-1)), { date: null, day: null });
  await page.locator('[data-demo="day-2026-01-08"]').click();
  assert.deepEqual(await page.evaluate(() => window.selected.at(-1)), {
    date: "2026-01-08",
    day: { date: "2026-01-08", value: 8 },
  });
  await page.getByText("Thu 8 Jan 2026", { exact: true }).waitFor();
  await page.locator('[data-demo="day-2026-01-08"]').hover();
  await page.waitForFunction(() => document.querySelector("[aria-live]").textContent.includes("Thu 8 Jan 2026"));
  await page.locator('rect[stroke-dasharray="2 2"]').first().hover();
  await page.waitForFunction(() => !document.querySelector("[aria-live]").textContent.includes("Thu 8 Jan 2026"));
  assert.deepEqual(
    await page.evaluate(() => window.selected.at(-1)),
    { date: "2026-01-08", day: { date: "2026-01-08", value: 8 } },
    "Hovering a future cell leaves the selected record intact",
  );

  const legend = page.getByRole("button", { name: "Highlight level 1 of 4", exact: true });
  await legend.focus();
  assert.equal(await legend.getAttribute("aria-pressed"), "true");
  await legend.press("Space");
  assert.equal(await legend.getAttribute("aria-pressed"), "false");
  await legend.press("Space");
  assert.equal(await legend.getAttribute("aria-pressed"), "true");
  await grid.focus();
  assert.equal(await legend.getAttribute("aria-pressed"), "false");
  await page.getByRole("button", { name: "Highlight level 3 of 4", exact: true }).hover();
  assert.equal(
    await page.getByRole("button", { name: "Highlight level 3 of 4", exact: true }).getAttribute("aria-pressed"),
    "true",
  );
  await page.mouse.move(0, 0);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-demo^="legend-"]')].every(
      (node) => node.getAttribute("aria-pressed") === "false",
    ),
  );
  await page.locator('[data-demo="year-2026"]').press("ArrowLeft");
  assert.equal(await page.locator('[data-demo="year-2025"]').getAttribute("aria-checked"), "true");
  assert.deepEqual(await page.evaluate(() => window.years), [2025]);
  await grid.press("End");
  await grid.press("Enter");
  assert.deepEqual(await page.evaluate(() => window.selected.at(-1)), {
    date: "2025-12-31",
    day: { date: "2025-12-31", value: null },
  });
  await grid.press("Home");
  await grid.press("Enter");
  assert.deepEqual(await page.evaluate(() => window.selected.at(-1)), {
    date: "2025-01-01",
    day: { date: "2025-01-01", value: 3 },
  });
  await page.evaluate(() => window.renderStatus("unavailable"));
  await page.getByRole("button", { name: "Retry", exact: true }).press("Enter");
  await page.getByText("Wed 1 Jan 2025", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-demo="year-2025"]').getAttribute("aria-checked"), "true");
  await mount(
    `window.retried=0;const root=createRoot(document.getElementById('root'));window.renderStatus=status=>root.render(<Subject.ChartCalendarHeatmap days={${JSON.stringify(days)}} status={status} onRetry={()=>{window.retried++;window.renderStatus('ready')}}/>);window.renderStatus('unavailable');`,
  );
  await page.getByText("Couldn’t load daily totals", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry", exact: true }).press("Enter");
  await grid.waitFor();
  assert.equal(await page.evaluate(() => window.retried), 1);
  for (const days of [[], [{ date: "bad-date", value: 1 }], [{ date: "2026-02-30", value: 1 }]]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.ChartCalendarHeatmap days={${JSON.stringify(days)}}/>);`,
    );
    await page.getByText("No deploys recorded yet", { exact: true }).waitFor();
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|Invalid Date/);
  }
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartCalendarHeatmap days={[{date:'2024-02-29',value:1},{date:'2024-03-01',value:0}]} defaultYear={2024}/>);`,
  );
  await page.locator('[data-demo="day-2024-02-29"]').click();
  await page.getByText("Thu 29 Feb 2024", { exact: true }).waitFor();
  await page.getByText("deploy in 2024", { exact: true }).waitFor();
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartCalendarHeatmap days={[{date:'0099-01-01',value:1},{date:'0099-01-02',value:0}]} year={99} selectedDate="0099-01-01"/>);`,
  );
  await page.getByText("Thu 1 Jan 99", { exact: true }).waitFor();
  assert.equal(await page.locator('[data-demo="day-0099-01-01"]').count(), 1);
  for (const [props, message] of [
    ["year={NaN}", "Check the calendar year"],
    ["year={Infinity}", "Check the calendar year"],
    ["year={2026.5}", "Check the calendar year"],
    ["weekStart={2}", "Check the first weekday"],
    ['locale="invalid_locale"', "Check number formatting"],
  ]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.ChartCalendarHeatmap days={${JSON.stringify(days)}} ${props}/>);`,
    );
    await page.getByRole("alert").getByText(message, { exact: true }).waitFor();
    assert.equal(await grid.count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|Invalid Date/);
  }
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartCalendarHeatmap days={[{date:'2026-01-01',value:null},{date:'2026-01-02',value:null}]}/>);`,
  );
  assert.equal(await page.locator("header").getByText("Not measured", { exact: true }).count(), 1);
  assert.equal(await page.locator("dl").getByText("Not measured", { exact: true }).count(), 1);
  await page.getByText("No measured days in 2026", { exact: true }).waitFor();
  assert.doesNotMatch(await page.locator("#root").innerText(), /0\.0|Jan · 0 deploys/);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartCalendarHeatmap days={[{date:'2026-01-01',value:1e308},{date:'2026-01-02',value:1e308}]}/>);`,
  );
  await page.getByRole("alert").getByText("Totals are too large", { exact: true }).waitFor();
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartCalendarHeatmap days={[{date:'2026-01-01',value:1e308}]}/>);`,
  );
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  assert.ok(
    (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1,
    "Large finite totals fit the calendar",
  );
  await mount(
    `window.years=[];const root=createRoot(document.getElementById('root'));window.setYear=year=>root.render(<Subject.ChartCalendarHeatmap days={${JSON.stringify(days)}} year={year} onYearChange={y=>window.years.push(y)}/>);window.setYear(2024);`,
  );
  assert.equal(await page.locator('[data-demo="year-2024"]').getAttribute("aria-checked"), "true");
  await page.locator('[data-demo="year-2025"]').press("Enter");
  assert.deepEqual(await page.evaluate(() => window.years), [2025]);
  assert.equal(
    await page.locator('[data-demo="year-2024"]').getAttribute("aria-checked"),
    "true",
    "Controlled years await their host",
  );
  await page.evaluate(() => window.setYear(2025));
  await page.waitForFunction(
    () => document.querySelector('[data-demo="year-2025"]').getAttribute("aria-checked") === "true",
  );
  assert.equal(await page.locator('[data-demo="year-2025"]').getAttribute("aria-checked"), "true");
  await mount(
    `window.pins=[];const root=createRoot(document.getElementById('root'));window.pin=date=>root.render(<Subject.ChartCalendarHeatmap days={${JSON.stringify(days)}} defaultYear={2026} selectedDate={date} onSelectDate={(date,day)=>window.pins.push({date,day})}/>);window.pin('2026-02-30');`,
  );
  assert.equal(
    await page.locator("footer").getByText("Selected", { exact: true }).count(),
    0,
    "An impossible controlled date cannot pin a normalized day",
  );
  await grid.press("Home");
  await grid.press("Enter");
  assert.deepEqual(await page.evaluate(() => window.pins.at(-1)), {
    date: "2026-01-01",
    day: { date: "2026-01-01", value: 0 },
  });
  await page.evaluate(() => window.pin("2026-01-01"));
  await page.locator("footer").getByText("Selected", { exact: true }).waitFor();
  await page.getByText("Thu 1 Jan 2026", { exact: true }).waitFor();
}
