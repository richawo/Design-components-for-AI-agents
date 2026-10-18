export async function check({ page, mount, assert }) {
  const from = {
    name: "London St Pancras",
    code: "STP",
    city: "London",
    timeZone: "Europe/London",
    lat: 51.53,
    lon: -0.13,
  };
  const to = {
    name: "Paris Gare du Nord",
    code: "PNO",
    city: "Paris",
    timeZone: "Europe/Paris",
    lat: 48.88,
    lon: 2.36,
  };
  const leg = {
    id: "train",
    mode: "train",
    carrier: "Eurostar 9014",
    from,
    to,
    departs: "2026-10-24T07:00:00Z",
    arrives: "2026-10-24T09:00:00Z",
    revised: { departs: "2026-10-24T07:30:00Z", arrives: "2026-10-24T09:30:00Z" },
    status: "delayed",
    details: [{ label: "Seat", value: "42A" }],
    action: "Ticket",
  };
  const props = `title="Weekend in France" dates="Sat 24 Oct" locale="en-GB" legs={${JSON.stringify([leg])}} now="2026-10-24T06:00:00Z"`;
  await mount(
    `window.opens=[];window.tripBacks=0;window.fail=true;createRoot(document.getElementById('root')).render(<Subject.MobileTripItinerary ${props} onBack={()=>window.tripBacks++} onOpenLeg={async(leg,signal)=>{window.opens.push({leg,signal});if(window.fail)throw Error('Ticket unavailable');await new Promise(r=>window.finish=r)}}/>);`,
  );
  assert.equal(
    await page.getByRole("button", { name: "Back to trips", exact: true }).count(),
    1,
    "The hidden compact header is absent from keyboard navigation",
  );
  assert.equal(await page.locator('[data-demo="trip-back-compact"]').isDisabled(), true);
  await page.getByRole("button", { name: "Back to trips", exact: true }).press("Enter");
  assert.equal(await page.evaluate(() => window.tripBacks), 1);
  await page.getByRole("tab", { name: "Itinerary", exact: true }).press("ArrowRight");
  assert.equal(await page.getByRole("tab", { name: "Changes, 1", exact: true }).getAttribute("aria-selected"), "true");
  await page.getByRole("button", { name: "Show Eurostar 9014 in the itinerary", exact: true }).press("Enter");
  await page.getByText("42A", { exact: true }).waitFor();
  assert.equal(await page.getByRole("tab", { name: "Itinerary", exact: true }).getAttribute("aria-selected"), "true");
  const shownLeg = page.locator('[data-demo="trip-leg-train"]');
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "trip-leg-train");
  await page.waitForFunction(() => {
    const y = document.querySelector('[data-demo="trip-leg-train"]').getBoundingClientRect().y;
    return y > 100 && y < 320;
  });
  assert.equal(await shownLeg.evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .getByRole("button", { name: "Open Ticket", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Space");
  await page.getByText("Couldn’t open. Try again", { exact: true }).waitFor();
  assert.equal(await page.getByText("42A", { exact: true }).isVisible(), true);
  assert.match(await page.locator('[data-demo="trip-leg-train"]').innerText(), /08:30/);
  assert.match(await page.locator('[data-demo="trip-leg-train"]').innerText(), /11:30/);

  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "Couldn’t open. Try again: Ticket", exact: true }).press("Enter");
  assert.equal(await page.getByRole("button", { name: "Opening Ticket", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Cancel", exact: true }).press("Enter");
  assert.equal(await page.evaluate(() => window.opens[1].signal.aborted), true);
  await page.evaluate(() => window.finish());
  assert.equal(await page.getByText("Ticket opened", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Open Ticket", exact: true }).press("Enter");
  await page.evaluate(() => window.finish());
  await page.getByText("Ticket opened", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Ticket opened. Open again", exact: true }).isEnabled(), true);
  assert.deepEqual(
    await page.evaluate(() =>
      window.opens.map(({ leg }) => ({
        id: leg.id,
        from: leg.from,
        to: leg.to,
        departs: leg.departs,
        arrives: leg.arrives,
        revised: leg.revised,
      })),
    ),
    Array(3).fill({ id: leg.id, from, to, departs: leg.departs, arrives: leg.arrives, revised: leg.revised }),
  );
  assert.equal(await page.evaluate(() => window.opens.every((v) => v.signal instanceof AbortSignal)), true);
  const transfer = {
    id: "transfer",
    mode: "car",
    carrier: "Local transfer",
    from: to,
    to: { ...to, name: "Lyon Part-Dieu", city: "Lyon", code: "LPD", lat: 45.76, lon: 4.83 },
    departs: "2026-10-24T11:00:00Z",
    arrives: "2026-10-24T13:00:00Z",
    status: "scheduled",
    action: "Booking",
  };
  await mount(
    `window.jobs=[];window.finishLeg={};createRoot(document.getElementById('root')).render(<Subject.MobileTripItinerary title="Weekend in France" dates="Sat 24 Oct" locale="en-GB" legs={${JSON.stringify([leg, transfer])}} now="2026-10-24T06:00:00Z" onOpenLeg={(leg,signal)=>new Promise(resolve=>{window.jobs.push({id:leg.id,signal});window.finishLeg[leg.id]=resolve})}/>);`,
  );
  await page.locator('[data-demo="trip-leg-train"]').press("Enter");
  await page.getByRole("button", { name: "Open Ticket", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Opening Ticket", exact: true }).waitFor();
  await page.locator('[data-demo="trip-leg-transfer"]').press("Enter");
  await page.getByText("No additional booking details.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Open Booking", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.jobs.map(({ id, signal }) => ({ id, aborted: signal.aborted }))), [
    { id: "train", aborted: true },
    { id: "transfer", aborted: false },
  ]);
  await page.locator('[data-demo="trip-leg-train"]').press("Enter");
  assert.equal(
    await page.getByRole("button", { name: "Open Ticket", exact: true }).isEnabled(),
    true,
    "The superseded leg returns to an available action",
  );
  await page.evaluate(() => window.finishLeg.train());
  assert.equal(await page.getByText("Ticket opened", { exact: true }).count(), 0);
  await page.evaluate(() => window.finishLeg.transfer());
  await page.locator('[data-demo="trip-leg-transfer"]').press("Enter");
  await page.getByText("Booking opened", { exact: true }).waitFor();
  await mount(
    `window.revisionJobs=[];function Host(){const [revision,setRevision]=useState(1);window.replaceTrip=()=>setRevision(2);return <Subject.MobileTripItinerary key={revision} ${props} onOpenLeg={(leg,signal)=>new Promise(resolve=>{window.revisionJobs.push({leg,signal});window.finishOldTrip=resolve})}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.locator('[data-demo="trip-leg-train"]').press("Enter");
  await page.getByRole("button", { name: "Open Ticket", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Opening Ticket", exact: true }).waitFor();
  await page.evaluate(() => window.replaceTrip());
  await page.waitForFunction(() => window.revisionJobs[0].signal.aborted);
  await page.locator('[data-demo="trip-leg-train"]').press("Enter");
  await page.getByRole("button", { name: "Open Ticket", exact: true }).waitFor();
  await page.evaluate(() => window.finishOldTrip());
  assert.equal(
    await page.getByText("Ticket opened", { exact: true }).count(),
    0,
    "An old trip cannot acknowledge the replacement",
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileTripItinerary title="Weekend in France" dates="Sat 24 Oct" locale="en-GB" legs={[]} now="2026-10-24T06:00:00Z"/>);`,
  );
  await page.getByText("Nothing booked yet", { exact: true }).waitFor();
  await mount(`createRoot(document.getElementById('root')).render(<Subject.MobileTripItinerary ${props}/>);`);
  await page.locator('[data-demo="trip-leg-train"]').press("Enter");
  await page.getByText("42A", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Open Ticket", exact: true }).count(), 0);
  assert.equal(await page.locator('[data-demo="trip-back-main"]').isDisabled(), true);
  for (const bad of [
    { ...leg, departs: "2026-02-30T07:00:00Z" },
    { ...leg, departs: "not-a-date" },
    { ...leg, from: { ...from, timeZone: "Invalid/Zone" } },
    { ...leg, from: { ...from, timeZone: undefined } },
    { ...leg, from: { ...from, lat: 95 } },
    { ...leg, departs: "2026-10-24T11:00:00Z" },
    { ...leg, revised: { departs: "2026-10-24T07:30:00Z", arrives: "2026-10-24T07:30:00Z" } },
  ]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.MobileTripItinerary title="Weekend in France" dates="Sat 24 Oct" locale="en-GB" legs={${JSON.stringify([bad])}} now="2026-10-24T06:00:00Z"/>);`,
    );
    await page.getByRole("alert").waitFor();
    await page.getByText("No itinerary available", { exact: true }).waitFor();
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|Invalid Date/);
    assert.equal(await page.getByRole("button", { name: "Open Ticket", exact: true }).count(), 0);
  }
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileTripItinerary title="Weekend in France" dates="Sat 24 Oct" legs={${JSON.stringify([leg, leg])}} now="2026-10-24T06:00:00Z"/>);`,
  );
  await page.getByRole("alert").waitFor();
  assert.equal(await page.locator('[data-demo="trip-leg-train"]').count(), 1);
  const fs = await import("node:fs");
  const meta = JSON.parse(fs.readFileSync("registry/pro/mobile-trip-itinerary/meta.json", "utf8"));
  await mount(
    `import {DemoPlayer} from './lib/demo/player';import {parseSteps} from './lib/demo/schema.mjs';createRoot(document.getElementById('root')).render(<Subject.default/>);window.playTrip=steps=>new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},new AbortController().signal).play(parseSteps(steps));`,
  );
  await page.evaluate((steps) => window.playTrip(steps), meta.demo.steps);
  await page.getByRole("button", { name: "Boarding pass opened. Open again", exact: true }).waitFor();
}
