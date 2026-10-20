export async function check({ page, mount, assert, capture=async()=>{} }) {
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.SaasDashboard/>);`,
  );
  await page.locator('[data-demo="card-signups"]').click();
  await page.locator('[data-demo="range-7d"]').click();
  await page.getByRole("heading", { name: "Trial signups per day", exact:true }).waitFor();
  await capture("trial-seven-days",{audit:true});
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export metric CSV" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "signups-7d.csv");
  await capture("csv-export",{audit:true});
  await page.getByRole("tab",{name:"Workspaces",exact:true}).click();
  await page.getByRole("searchbox").fill("Harbour");
  const expectedRows = 1 + Number(await page.getByRole("columnheader").count() > 0);
  await page.waitForFunction(
    count => [...document.querySelectorAll('[role="row"],table tr')].filter(row=>row.getClientRects().length&&!row.closest('[inert]')).length === count,
    expectedRows,
  );
  assert.equal(await page.getByRole("row").count(), expectedRows);
  assert.equal(await page.getByRole("row").filter({ hasText: "Harbour Works" }).count(), 1);
  await capture("workspace-search",{audit:true});
  await page.getByRole("searchbox").fill("No match");
  assert.ok(
    await page.getByText("No workspace matches this search.").isVisible(),
  );
  await capture("empty-search",{audit:true});
  await mount(
    `window.calls=[];window.attempt=0;createRoot(document.getElementById('root')).render(<Subject.SaasDashboard onExport={async report=>{window.calls.push(report);if(!window.attempt++)throw Error('fixture');}}/>);`,
  );
  await page.locator('[data-demo="card-upgrades"]').click();
  await page.getByRole("button", { name: "Export metric CSV" }).click();
  await page.getByRole("status").filter({ hasText: "export failed" }).waitFor();
  await capture("host-export-rejected",{audit:true});
  await page.getByRole("button", { name: "Export metric CSV" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Exported paid upgrades" })
    .waitFor();
  const calls = await page.evaluate(() => window.calls);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].metric, "upgrades");
  assert.equal(calls[1].points.length, 30);
  await capture("host-export-accepted",{audit:true});
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.SaasDashboard metrics={[]} records={[]}/>);`,
  );
  assert.ok(await page.getByRole("tabpanel",{name:"Overview",exact:true}).getByText("No metrics available.",{exact:true}).isVisible());
  assert.ok(
    await page.getByRole("button", { name: "Export metric CSV" }).isDisabled(),
  );
  await capture("short-history",{audit:true});
  await page.getByRole("tab",{name:"Workspaces",exact:true}).click();
  assert.ok(await page.getByRole("tabpanel",{name:"Workspaces",exact:true}).getByText("No workspaces yet.",{exact:true}).isVisible());
  await capture("empty-workspaces",{audit:true});
}
