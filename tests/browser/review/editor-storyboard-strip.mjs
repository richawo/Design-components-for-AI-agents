// Regression coverage for finished edits, playback, invalid timing and callback isolation.
export async function check({ page, mount, assert, capture = async () => {} }) {
  await page.setViewportSize({ width: 1440, height: 1200 });
  const scenes = [
    {
      id: "intro",
      title: "Opening",
      notes: "A wide opening shot.",
      duration: 2,
      shot: "wide",
      tone: ["#59616a", "#292f36"],
    },
    {
      id: "middle",
      title: "Middle",
      notes: "A closer view.",
      duration: 3,
      shot: "detail",
      tone: ["#777777", "#333333"],
    },
    {
      id: "close",
      title: "Closing",
      notes: "End on the title.",
      duration: 1,
      shot: "title",
      tone: ["#555555", "#222222"],
    },
  ];
  const fixture = `window.cuts=[];createRoot(document.getElementById('root')).render(<Subject.EditorStoryboardStrip scenes={${JSON.stringify(scenes)}} targetDuration={8} onScenesChange={next=>window.cuts.push(structuredClone(next))}/>);`;
  const scene = (id) => page.locator('[data-demo="scene-' + id + '"]');
  const duration = () =>
    page.getByRole("textbox", { name: "Shot length in seconds", exact: true });
  await mount(fixture);
  await scene("middle").press("Enter");
  assert.equal(await duration().inputValue(), "3.0", "The inspector switches with the selected shot");
  assert.equal(await scene("middle").getAttribute("aria-current"), "true");
  assert.equal(
    await page.evaluate(() => window.cuts.length),
    0,
    "Inspection does not report a cut edit",
  );
  await scene("middle").press("Alt+ArrowLeft");
  assert.deepEqual(
    (await page.evaluate(() => window.cuts.at(-1))).map((s) => s.id),
    ["middle", "intro", "close"],
  );
  await scene("middle").press("Alt+ArrowRight");
  assert.deepEqual(
    (await page.evaluate(() => window.cuts.at(-1))).map((s) => s.id),
    ["intro", "middle", "close"],
  );
  assert.equal(
    await scene("middle").evaluate((node) => node === document.activeElement),
    true,
  );
  await scene("intro").press("Enter");
  assert.equal(await duration().inputValue(), "2.0");
  await duration().press("ArrowUp");
  assert.equal(await duration().inputValue(), "2.5");
  await duration().press("Shift+ArrowDown");
  assert.equal(await duration().inputValue(), "0.5");
  await duration().fill("1.2");
  await duration().press("Enter");
  assert.equal(await duration().inputValue(), "1.0");
  const beforeSameDuration = await page.evaluate(() => window.cuts.length);
  await duration().fill("1.2");
  await duration().press("Enter");
  assert.equal(await duration().inputValue(), "1.0");
  assert.equal(await page.evaluate(() => window.cuts.length), beforeSameDuration, "An unchanged normalized duration does not report a new edit");
  assert.equal((await page.evaluate(() => window.cuts.at(-1)))[0].duration, 1);
  await capture("keyboard-cut", { audit: true });
  await mount(fixture);
  const trim = page.locator('[data-demo="trim-intro"]');
  await trim.scrollIntoViewIfNeeded();
  const box = await trim.boundingBox();
  assert.ok(box);
  const shotBox = await scene("intro").boundingBox();
  assert.ok(shotBox);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + shotBox.width * 0.5, box.y + box.height / 2, {
    steps: 10,
  });
  assert.equal(
    await page.evaluate(() => window.cuts.length),
    0,
    "Trimming reports when the pointer releases",
  );
  await page.mouse.up();
  await page.waitForFunction(() => window.cuts.length === 1);
  const trimmed = await page.evaluate(() => window.cuts[0]);
  assert.ok(
    trimmed[0].duration > 2 &&
      trimmed[0].duration <= 20 &&
      (trimmed[0].duration * 2) % 1 === 0,
  );
  assert.deepEqual(trimmed.slice(1), scenes.slice(1));
  await capture("trimmed-shot", { audit: true });
  await mount(fixture);
  const first = await scene("intro").boundingBox(),
    last = await scene("close").boundingBox();
  assert.ok(first && last);
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    first.x + first.width * 0.15,
    last.y + last.height / 2,
    { steps: 14 },
  );
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => window.cuts.length),
    0,
    "Reordering reports only the dropped order",
  );
  await page.mouse.up();
  await page.waitForFunction(() => window.cuts.length === 1);
  assert.deepEqual(
    (await page.evaluate(() => window.cuts[0])).map((s) => s.id),
    ["close", "intro", "middle"],
  );
  await capture("reordered-cut", { audit: true });
  await mount(
    `window.incoming=${JSON.stringify(scenes)};createRoot(document.getElementById('root')).render(<Subject.EditorStoryboardStrip scenes={window.incoming} onScenesChange={next=>{next[0].title='Host mutation';next[0].tone[0]='#ff0000'}}/>);`,
  );
  await page.locator('[data-demo="longer"]').click();
  assert.deepEqual(
    await page.evaluate(() => window.incoming[0].tone),
    scenes[0].tone,
    "Callback mutation cannot recolour the retained frame",
  );
  assert.equal(await scene("intro").getAttribute("aria-current"), "true");
  await mount(
    `window.cuts=[];createRoot(document.getElementById('root')).render(<Subject.EditorStoryboardStrip scenes={${JSON.stringify(
      [
        { ...scenes[0], duration: 0.5 },
        { ...scenes[2], duration: 0.5 },
      ],
    )}} targetDuration={1} onScenesChange={next=>window.cuts.push(next)}/>);`,
  );
  await page
    .getByRole("button", { name: "Play the board", exact: true })
    .click();
  await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Play the board", exact: true })
    .waitFor();
  assert.equal(
    await scene("close").getAttribute("aria-current"),
    "true",
    "Playback settles on its last shot",
  );
  assert.equal(await page.evaluate(() => window.cuts.length), 0);
  await capture("playback-ended", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorStoryboardStrip scenes={[]}/>);`,
  );
  await page.getByText("No shots on the board", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Play the board", exact: true })
      .count(),
    0,
  );
  await capture("empty", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorStoryboardStrip scenes={[{id:'bad',title:'Invalid shot',notes:'Invalid timing.',duration:NaN,shot:'wide'}]}/>);`,
  );
  assert.doesNotMatch(
    await page.locator("section").innerText(),
    /NaN|Infinity/,
  );
  await page.getByRole("alert").waitFor();
  await capture("invalid", { audit: true });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.default accent="#777777"/>);`);
  await capture('mid-grey-accent', { audit: true });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.default accent="not-a-color"/>);`);
  assert.notEqual(await page.getByRole('button',{name:'Play the board',exact:true}).evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)');
  await capture('invalid-accent-fallback', { audit: true });

  await page.setViewportSize({width:1024,height:900});
  await mount(`window.edits=[];createRoot(document.getElementById('root')).render(<Subject.EditorStoryboardStrip scenes={[{id:'opening',title:'Opening',notes:'Hold on the lake.',duration:2,shot:'wide'}]} onScenesChange={next=>window.edits.push(structuredClone(next))}/>);`);
  const longer = page.locator('[data-demo="longer"]');
  await longer.dispatchEvent('pointerdown',{button:0,pointerId:7,isPrimary:true});
  await page.locator('body').dispatchEvent('pointerup',{button:0,pointerId:7,isPrimary:true});
  await page.waitForTimeout(750);
  assert.equal(await duration().inputValue(),'2.5','A release outside the button ends the held edit');
  assert.equal(await page.evaluate(()=>window.edits.length),1);
  await longer.dispatchEvent('pointerdown',{button:0,pointerId:8,isPrimary:true});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(750);
  assert.equal(await duration().inputValue(),'3.0','Losing window focus ends the held edit');
  assert.equal(await page.evaluate(()=>window.edits.length),2);
  await capture('released-hold',{audit:true});

}
