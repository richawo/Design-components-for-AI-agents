export async function check({ page, mount, assert }) {
  const recording = {
    id: "memo",
    title: "Field notes",
    recordedAt: "24 October, 09:00",
    duration: 30,
    peaks: Array.from({ length: 90 }, (_, i) => 0.2 + (i % 7) / 10),
    markers: [{ id: "budget", at: 10, label: "Budget" }],
    transcript: [
      { id: "intro", start: 0, end: 9, text: "Our first outline" },
      { id: "next", start: 12, end: 22, text: "Next steps for the team" },
    ],
  };
  await mount(
    `window.backs=0;window.seeks=[];window.playing=[];window.rates=[];window.markers=[];window.shared=[];createRoot(document.getElementById('root')).render(<Subject.MobileVoiceMemo recording={${JSON.stringify(recording)}} initialPosition={0} onBack={()=>window.backs++} onSeek={p=>window.seeks.push(p)} onPlayingChange={(playing,position)=>window.playing.push({playing,position})} onRateChange={r=>window.rates.push(r)} onMarkerAdd={m=>window.markers.push(m)} onShare={r=>window.shared.push(r)}/>);`,
  );
  const wave = page.getByRole("slider", { name: "Playback position", exact: true });
  await page.getByRole("button", { name: "Back to recordings", exact: true }).press("Enter");
  assert.equal(await page.evaluate(() => window.backs), 1);
  const box = await wave.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2, { steps: 16 });
  await page.mouse.up();
  await page.waitForFunction(() => window.seeks.length > 0);
  assert.ok(await page.evaluate(() => window.seeks.at(-1) > 0), "Dragging the waveform advances the playhead");
  await wave.press("Home");
  await page.waitForFunction(
    () => document.querySelector('[data-demo="memo-wave"]').getAttribute("aria-valuenow") === "0",
  );
  await wave.press("ArrowLeft");
  assert.equal(await page.evaluate(() => window.seeks.at(-1)), 0);
  await wave.press("ArrowRight");
  await page.waitForFunction(() => window.seeks.at(-1) === 5);
  await page.waitForFunction(
    () => document.querySelector('[data-demo="memo-wave"]').getAttribute("aria-valuenow") === "5",
  );
  assert.equal(await wave.getAttribute("aria-valuenow"), "5");
  await wave.press("End");
  await page.waitForFunction(() => window.seeks.at(-1) === 30);
  await page.getByRole("button", { name: "Play again from the start", exact: true }).press("Space");
  await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.playing[0]), { playing: true, position: 0 });
  await page.getByRole("button", { name: "Pause", exact: true }).press("Enter");
  assert.equal(await page.evaluate(() => window.playing.at(-1).playing), false);
  await page.getByRole("button", { name: "Marker Budget at 0:10. Play from here", exact: true }).press("Enter");
  await page.waitForFunction(() => window.seeks.at(-1) === 10);
  await page.getByRole("button", { name: "0:12. Next steps for the team. Play from here", exact: true }).press("Enter");
  await page.waitForFunction(() => window.seeks.at(-1) === 12);
  await page.waitForFunction(
    () => document.querySelector('[data-demo="memo-wave"]').getAttribute("aria-valuenow") === "12",
  );
  assert.equal(
    await page
      .getByRole("button", { name: "0:12. Next steps for the team. Play from here", exact: true })
      .getAttribute("aria-current"),
    "true",
  );
  await page.getByRole("button", { name: "Add a marker at the playhead", exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.markers.map(({ at, label }) => ({ at, label }))), [
    { at: 12, label: "Marker 2" },
  ]);
  await page.getByRole("button", { name: "Playback speed 1×. Change speed", exact: true }).press("Enter");
  for (const rate of [1.5, 2, 0.75])
    await page.getByRole("button", { name: `Playback speed ${rate}×. Change speed`, exact: true }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.rates), [1.5, 2, 0.75, 1]);
  await page.getByRole("button", { name: /Share/ }).press("Enter");
  assert.deepEqual(await page.evaluate(() => window.shared), [recording]);
  await wave.press("End");
  await page.getByRole("button", { name: "Back 10 seconds", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Forward 10 seconds", exact: true }).press("Enter");
  await page.waitForFunction(() => window.seeks.at(-1) === 30);
  assert.equal(await page.evaluate(() => window.seeks.every((p) => Number.isFinite(p) && p >= 0 && p <= 30)), true);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileVoiceMemo recording={${JSON.stringify({ ...recording, peaks: [], markers: [], transcript: [] })}} initialPosition={0}/>);`,
  );
  await page.getByText("No transcript yet", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Share recording", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Back to recordings", exact: true }).isDisabled(), true);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  for (const duration of ["NaN", "Infinity", "0", "-1", "1e308"]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.MobileVoiceMemo recording={{...${JSON.stringify(recording)},duration:${duration}}}/>);`,
    );
    await page.getByText("Recording unavailable", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Play", exact: true }).count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  }
  await mount(
    `window.autoEvents=[];createRoot(document.getElementById('root')).render(<Subject.MobileVoiceMemo recording={{...${JSON.stringify(recording)},duration:2,markers:[],transcript:[]}} autoPlay initialPosition={0} onPlayingChange={(playing,position)=>window.autoEvents.push({playing,position})}/>);`,
  );
  await page.waitForFunction(() => window.autoEvents.some((event) => !event.playing));
  assert.deepEqual(await page.evaluate(() => window.autoEvents), [
    { playing: true, position: 0 },
    { playing: false, position: 2 },
  ]);
  await mount(
    `window.shortEvents=[];createRoot(document.getElementById('root')).render(<Subject.MobileVoiceMemo recording={{...${JSON.stringify(recording)},duration:0.25,markers:[],transcript:[]}} initialPosition={NaN} initialRate={NaN} onPlayingChange={(playing,position)=>window.shortEvents.push({playing,position})}/>);`,
  );
  assert.equal(await wave.getAttribute("aria-valuemax"), "0.25");
  assert.equal(await wave.getAttribute("aria-valuenow"), "0");
  await page.getByRole("button", { name: "Play", exact: true }).press("Space");
  await page.getByRole("button", { name: "Play again from the start", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.shortEvents), [
    { playing: true, position: 0 },
    { playing: false, position: 0.25 },
  ]);
  assert.equal(await wave.getAttribute("aria-valuenow"), "0.25");
  assert.equal(await wave.getAttribute("aria-valuetext"), "0.25 of 0.25 seconds");
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileVoiceMemo recording={{...${JSON.stringify(recording)},duration:3600,peaks:[],markers:[],transcript:[]}} initialPosition={1800}/>);`,
  );
  assert.equal(await wave.getAttribute("aria-valuenow"), "1800");
  assert.equal(await page.locator('[data-demo="memo-ruler"] path').count(), 1);
  assert.match(await page.locator('[data-demo="memo-ruler"]').innerText(), /30:00/);
  assert.ok(
    await page
      .locator('[data-demo="memo-ruler"] path')
      .evaluateAll((paths) => paths.every((path) => (path.getAttribute("d").match(/M/g) || []).length < 100)),
    "Long recordings retain local ruler detail with bounded ticks",
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.MobileVoiceMemo recording={{...${JSON.stringify(recording)},peaks:[NaN,Infinity,-1,0.7,2],markers:[null,{id:'bad',at:Infinity,label:'Invalid marker'},{id:'past',at:-1,label:'Before start'},{id:'late',at:31,label:'Past end'},...${JSON.stringify(recording.markers)},...${JSON.stringify(recording.markers)}],transcript:[null,{id:'zero',start:0,end:0,text:'Invalid segment'},{id:'nan',start:NaN,end:10,text:'Invalid time'},...${JSON.stringify(recording.transcript)},...${JSON.stringify(recording.transcript)}]}} initialPosition={0}/>);`,
  );
  assert.equal(await page.getByRole("button", { name: /Marker Invalid marker/ }).count(), 0);
  assert.equal(
    await page.getByRole("button", { name: /Invalid segment|Invalid time|Before start|Past end/ }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "0:12. Next steps for the team. Play from here", exact: true }).count(),
    1,
  );
  assert.equal(
    await page.getByRole("button", { name: "Marker Budget at 0:10. Play from here", exact: true }).count(),
    1,
  );
  assert.equal(
    await page
      .locator("svg path")
      .evaluateAll((paths) => paths.every((path) => !/(?:NaN|Infinity)/.test(path.getAttribute("d") || ""))),
    true,
  );
  await mount(
    `window.replaceMemo=null;function Host(){const [memo,setMemo]=useState(${JSON.stringify(recording)});window.replaceMemo=()=>setMemo({...memo,id:'next-memo',title:'Next recording',duration:10});return <Subject.MobileVoiceMemo recording={memo} initialPosition={0}/>};createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await page.getByRole("button", { name: "Add a marker at the playhead", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Marker Marker 2 at 0:00. Play from here", exact: true }).waitFor();
  await page.getByRole("button", { name: "Play", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
  await page.evaluate(() => window.replaceMemo());
  await page.getByRole("heading", { name: "Next recording", exact: true }).waitFor();
  await page.getByRole("button", { name: "Play", exact: true }).waitFor();
  assert.equal(await wave.getAttribute("aria-valuenow"), "0");
  assert.equal(
    await page.getByRole("button", { name: /Marker Marker 2/ }).count(),
    0,
    "Added markers do not leak into another recording",
  );
  const fs = await import("node:fs");
  const meta = JSON.parse(fs.readFileSync("registry/pro/mobile-voice-memo/meta.json", "utf8"));
  await mount(
    `import {DemoPlayer} from './lib/demo/player';import {parseSteps} from './lib/demo/schema.mjs';createRoot(document.getElementById('root')).render(<Subject.default/>);window.playMemo=steps=>new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},new AbortController().signal).play(parseSteps(steps));`,
  );
  await page.getByText("0:17.2", { exact: true }).waitFor();
  await page.evaluate((steps) => window.playMemo(steps), meta.demo.steps);
  await page.getByRole("button", { name: "Play", exact: true }).waitFor();
  await page.getByRole("button", { name: "Playback speed 1.5×. Change speed", exact: true }).waitFor();
}
