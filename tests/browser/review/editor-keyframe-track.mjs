// Exercise exact key boundaries, keyboard activation and committed drag snapshots.
export async function check({ page, mount, assert, capture = async () => {} }) {
  await page.setViewportSize({ width: 1440, height: 1200 });
  const tracks = [
    {
      id: "x",
      label: "Offset",
      unit: "px",
      min: 0,
      max: 100,
      step: 1,
      keys: [
        { id: "a", frame: 0, value: 0, ease: "linear" },
        { id: "b", frame: 10, value: 100, ease: "hold" },
        { id: "c", frame: 20, value: 0, ease: "linear" },
      ],
    },
  ];
  const fixture = `window.changes=[];window.valueAt=Subject.valueAt;window.initialTracks=${JSON.stringify(tracks)};createRoot(document.getElementById('root')).render(<Subject.EditorKeyframeTrack tracks={window.initialTracks} durationFrames={20} fps={20} loop={false} onionSkin={false} renderPreview={values=><output data-preview-value style={{color:'#f4f4f5'}}>{Math.round(values.x)}</output>} onChange={next=>{window.changes.push(structuredClone(next));next[0].keys[0].value=999}}/>);`;
  await mount(fixture);
  assert.deepEqual(
    await page.evaluate(() =>
      [-1, 0, 5, 10, 15, 20, 21].map((frame) =>
        window.valueAt(window.initialTracks[0], frame),
      ),
    ),
    [0, 0, 50, 100, 100, 0, 0],
    "Hold ends at the next key’s exact frame",
  );
  const playhead = () =>
    page.getByRole("slider", { name: "Playhead", exact: true });
  await playhead().press("End");
  assert.equal(await playhead().getAttribute("aria-valuenow"), "20");
  await playhead().press("Home");
  await playhead().press("Shift+ArrowRight");
  assert.equal(await playhead().getAttribute("aria-valuenow"), "10");
  await playhead().press("ArrowLeft");
  assert.equal(await playhead().getAttribute("aria-valuenow"), "9");
  assert.equal(
    await page.evaluate(() => window.changes.length),
    0,
    "Scrubbing does not publish a key edit",
  );
  const key = (index) => page.locator('[data-demo="key-x-' + index + '"]');
  await key(0).press("Enter");
  assert.equal(
    await key(0).getAttribute("aria-pressed"),
    "true",
    "Keyboard activation selects the key and its inspector",
  );
  await key(0).press("ArrowRight");
  await key(0).press("ArrowUp");
  let snapshot = await page.evaluate(() => window.changes.at(-1));
  assert.deepEqual(snapshot[0].keys[0], {
    id: "a",
    frame: 1,
    value: 1,
    ease: "linear",
  });
  for (let index = 0; index < 4; index++)
    await key(0).press("Shift+ArrowRight");
  assert.equal(
    (await page.evaluate(() => window.changes.at(-1)))[0].keys[0].frame,
    9,
    "Keys cannot cross or share the next frame",
  );
  await capture("keyboard-key", { audit: true });
  await mount(fixture);
  await key(1).scrollIntoViewIfNeeded();
  const box = await key(1).boundingBox(),
    neighbour = await key(2).boundingBox(),
    before = await page.evaluate(() => window.changes.length);
  const dragX = (neighbour.x - box.x) * 0.3;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + dragX,
    box.y + box.height / 2 + 24,
    { steps: 6 },
  );
  assert.equal(
    await page.evaluate(() => window.changes.length),
    before,
    "A drag reports after release",
  );
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.changes.length), before + 1);
  snapshot = await page.evaluate(() => window.changes.at(-1));
  assert.ok(snapshot[0].keys[1].frame > 10 && snapshot[0].keys[1].frame < 20);
  assert.ok(snapshot[0].keys[1].value < 100 && snapshot[0].keys[1].value >= 0);
  assert.equal(await key(1).getAttribute("aria-pressed"), "true", "Dragging retains the selected key");
  await capture("dragged-key", { audit: true });
  await mount(fixture);
  await playhead().press("Home");
  for (let index = 0; index < 7; index++) await playhead().press("ArrowRight");
  await page.locator('[data-demo="add-key"]').click();
  snapshot = await page.evaluate(() => window.changes.at(-1));
  assert.deepEqual(
    snapshot[0].keys.map((key) => key.frame),
    [0, 7, 10, 20],
  );
  await page.getByRole("button", { name: "Delete key", exact: true }).click();
  assert.deepEqual(
    (await page.evaluate(() => window.changes.at(-1)))[0].keys.map(
      (key) => key.frame,
    ),
    [0, 10, 20],
  );
  await mount(fixture);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
  await page.getByRole("button", { name: "Play", exact: true }).waitFor();
  assert.equal(await playhead().getAttribute("aria-valuenow"), "20");
  assert.equal(await page.locator("[data-preview-value]").innerText(), "0");
  await capture("playback-ended", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorKeyframeTrack tracks={[]}/>);`,
  );
  await page.getByText("No tracks yet", { exact: true }).waitFor();
  assert.equal(await page.getByRole("slider").count(), 0);
  await capture("empty", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorKeyframeTrack tracks={${JSON.stringify(tracks)}} fps={0} durationFrames={NaN}/>);`,
  );
  await page.getByRole("alert").waitFor();
  assert.doesNotMatch(
    await page.locator("section").innerText(),
    /NaN|Infinity/,
  );
  await capture("invalid-clock", { audit: true });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await mount(`createRoot(document.getElementById('root')).render(<Subject.EditorKeyframeTrack/>);`);
    const timeline = page.getByRole("region", { name: "Keyframe timeline", exact: true });
    assert.ok(await timeline.evaluate(node => node.scrollWidth > node.clientWidth), "Phone timeline preserves room for distinct keys");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await capture("phone-" + width + "-start", { audit: true });
    await timeline.focus();
    await timeline.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector('[aria-label="Keyframe timeline"]').scrollLeft > 0);
    await timeline.press("ArrowLeft");
    await page.waitForFunction(() => document.querySelector('[aria-label="Keyframe timeline"]').scrollLeft === 0);
    await timeline.press("End");
    await page.waitForFunction(() => document.querySelector('[aria-label="Keyframe timeline"]').scrollLeft > 0);
    await capture("phone-" + width + "-end", { audit: true });
    await timeline.press("Home");
    await page.waitForFunction(() => document.querySelector('[aria-label="Keyframe timeline"]').scrollLeft === 0);
  }
}
