export async function check({ page, mount, assert, capture = async () => {} }) {
  const revenue = () => page.locator("dl").first().innerText();
  const history = () => page.getByRole("slider", { name: /revenue history/ });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.CommerceOperationsDashboard/>);`);
  assert.match(await revenue(), /£117,702.00/);
  assert.equal(await history().getAttribute("aria-valuemax"), "7");
  await history().focus();
  await history().press("Home");
  assert.equal(await history().getAttribute("aria-valuetext"), "9 Oct: £13,500.00");
  await history().press("ArrowRight");
  assert.equal(await history().getAttribute("aria-valuetext"), "10 Oct: £16,000.00");
  await capture("inspected", { audit: true });
  await history().press("End");
  assert.equal(await history().getAttribute("aria-valuetext"), "15 Oct: £19,702.00");
  await history().click({ position: { x: 1, y: 80 } });
  assert.equal(await history().getAttribute("aria-valuenow"), "1");
  await page.getByRole("button", { name: "Retail", exact: true }).press("Enter");
  assert.match(await revenue(), /£49,274.00/);
  await capture("retail", { audit: true });
  assert.match(await page.getByRole("status").innerText(), /1 channel · Retail/);
  assert.equal(await history().getAttribute("aria-valuetext"), "15 Oct: £7,674.00");
  assert.match(await page.getByRole("table").innerText(), /Retail[\s\S]+2,680[\s\S]+620[\s\S]+598[\s\S]+£49,274.00/);
  await page.getByRole("button", { name: "Last month", exact: true }).press("Enter");
  assert.match(await revenue(), /£289,560.00/);
  await capture("september", { audit: true });
  assert.equal(await history().getAttribute("aria-valuemax"), "30");
  await history().press("Home");
  assert.equal(await history().getAttribute("aria-valuetext"), "1 Sep: £8,000.00");
  assert.match(await page.locator("section").innerText(), /1–30 Sep 2026/);
  await page.getByRole("button", { name: "Last 7 days", exact: true }).click();
  assert.match(await revenue(), /£117,702.00/);

  const emptyChannel = `{id:'empty',name:'Online store',visits:0,checkouts:0,orders:0,revenueMinor:0,dailyRevenueMinor:[],exceptions:[]}`;
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CommerceOperationsDashboard periods={[{id:'zero',label:'Today',channels:[${emptyChannel}]}]}/>);`,
  );
  assert.match(await page.locator("section").innerText(), /Visit conversion unavailable/);
  assert.match(await page.locator("section").innerText(), /Checkout completion unavailable/);
  assert.match(await page.locator("section").innerText(), /No comparable revenue history/);
  assert.equal(await history().count(), 0);
  assert.doesNotMatch(await page.locator("section").innerText(), /NaN|Infinity/);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CommerceOperationsDashboard periods={[]}/>);`,
  );
  assert.match(await page.getByRole("status").innerText(), /No reporting periods/);
  assert.match(await revenue(), /Unavailable/);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CommerceOperationsDashboard periods={[{id:'empty',label:'Today',channels:[]}]}/>);`,
  );
  assert.match(await page.getByRole("status").innerText(), /No channel data/);

  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CommerceOperationsDashboard periods={[{id:'bad',label:'Today',channels:[{...${emptyChannel},revenueMinor:Infinity}]}]}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /invalid metrics/);
  assert.doesNotMatch(await page.locator("section").innerText(), /NaN|Infinity/);
  const exact = `{...${emptyChannel},id:'one',name:'Online store',revenueMinor:9007199254740991,dailyRevenueMinor:[9007199254740991]}`;
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CommerceOperationsDashboard periods={[{id:'exact',label:'Today',channels:[${exact},{...${exact},id:'two',name:'Retail'}]}]}/>);`,
  );
  assert.match(await revenue(), /£180,143,985,094,819.82/);
  await capture("exact-boundary", { audit: true });
  assert.equal(await history().getAttribute("aria-valuetext"), "Interval 1: £180,143,985,094,819.82");

  // A partial history is not presented as an all-channel total; the individual history remains available.
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CommerceOperationsDashboard periods={[{id:'mixed',label:'Last month',channels:[{...${emptyChannel},id:'one',name:'Online store',revenueMinor:1000,dailyRevenueMinor:[1000]},{...${emptyChannel},id:'two',name:'Retail',revenueMinor:2000,dailyRevenueMinor:[]}]}]}/>);`,
  );
  assert.equal(await history().count(), 0);
  await page.getByRole("button", { name: "Online store", exact: true }).click();
  assert.equal(await history().getAttribute("aria-valuemax"), "1");
  assert.equal(await history().getAttribute("aria-valuetext"), "Interval 1: £10.00");
  await history().press("End");
  assert.equal(await history().getAttribute("aria-valuenow"), "1");

  // The ordinary host id "all" remains selectable without colliding with the aggregate view.
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CommerceOperationsDashboard periods={[{id:'ids',label:'Today',channels:[{...${emptyChannel},id:'all',name:'Flagship',revenueMinor:1000},{...${emptyChannel},id:'constructor',name:'Wholesale',revenueMinor:2000}]}]}/>);`,
  );
  assert.match(await revenue(), /£30.00/);
  await page.getByRole("button", { name: "Flagship", exact: true }).click();
  assert.match(await revenue(), /£10.00/);
  await page.getByRole("button", { name: "All channels", exact: true }).click();
  assert.match(await revenue(), /£30.00/);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CommerceOperationsDashboard currency="JPY" periods={[{id:'yen',label:'Today',channels:[{...${emptyChannel},revenueMinor:123,dailyRevenueMinor:[123]}]}]}/>);`,
  );
  assert.match(await revenue(), /JP¥123/);
}
