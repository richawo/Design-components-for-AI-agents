// Exercise type edits, apply receipts and independent host snapshots.
export async function check({ page, mount, assert, capture = async () => {} }) {
  await mount(
    `window.changes=[];window.applied=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.EditorFontPairing onChange={pairing=>window.changes.push({...pairing})} onApply={async result=>{window.applied.push(structuredClone(result));if(window.applied.length===1)document.querySelector('[data-demo=apply]').click();if(window.fail)throw Error('The token store is offline.');await new Promise(resolve=>window.finishPairing=resolve)}}/>);`,
  );
  const preset = (id) => page.locator('[data-demo="preset-' + id + '"]'),
    apply = () => page.locator('[data-demo="apply"]');
  await preset("editorial").press("ArrowRight");
  assert.equal(await preset("modern").getAttribute("aria-checked"), "true");
  await preset("technical").press("Enter");
  await page.locator('[data-demo="ratio-1"]').press("ArrowRight");
  assert.equal(
    await page.locator('[data-demo="ratio-2"]').getAttribute("aria-checked"),
    "true",
  );
  const base = page.getByRole("slider", { name: "Body size", exact: true }),
    leading = page.getByRole("slider", { name: "Leading", exact: true });
  await base.press("End");
  assert.equal(await base.inputValue(), "20");
  await base.press("Home");
  await base.press("ArrowRight");
  assert.equal(await base.inputValue(), "15");
  await leading.press("Home");
  await leading.press("ArrowRight");
  assert.equal(await leading.inputValue(), "1.35");
  await page.locator('[data-demo="step-h2"]').press("Enter");
  assert.equal(
    await page.locator('[data-demo="step-h2"]').getAttribute("aria-pressed"),
    "true",
  );
  await capture("reviewed-draft", { audit: true });
  await apply().press("Enter");
  await page
    .getByRole("status")
    .filter({ hasText: "The token store is offline." })
    .waitFor();
  assert.equal(await base.inputValue(), "15");
  assert.equal(await leading.inputValue(), "1.35");
  await capture("failed", { audit: true });
  assert.equal(
    await page.evaluate(() => window.applied.length),
    1,
    "Reentrant apply cannot start another save",
  );
  const first = await page.evaluate(() => window.applied[0]);
  assert.deepEqual(
    Object.fromEntries(
      [
        "headingId",
        "headingWeight",
        "bodyId",
        "bodyWeight",
        "base",
        "ratio",
        "leading",
      ].map((key) => [key, first[key]]),
    ),
    {
      headingId: "geist-mono",
      headingWeight: 500,
      bodyId: "geist",
      bodyWeight: 400,
      base: 15,
      ratio: 1.25,
      leading: 1.35,
    },
  );
  assert.deepEqual(first.scale, {
    caption: 12,
    body: 15,
    lead: 18.8,
    h3: 23.4,
    h2: 29.3,
    h1: 36.6,
  });
  assert.match(first.css, /--text-h1: 36\.6px;/);
  assert.match(first.css, /--font-heading-weight: 500;/);
  await page.evaluate(() => (window.fail = false));
  await apply().press("Enter");
  await page.waitForFunction(() => typeof window.finishPairing === "function");
  await apply().evaluate((node) => node.click());
  assert.equal(await page.evaluate(() => window.applied.length), 2);
  assert.deepEqual(await page.evaluate(() => window.applied[1]), first);
  await capture("pending", { audit: true });
  await page.evaluate(() => window.finishPairing());
  await page.getByRole("button", { name: "Applied", exact: true }).waitFor();
  await capture("applied", { audit: true });
  await base.press("ArrowRight");
  await page.getByRole("button", { name: "Revert", exact: true }).click();
  assert.equal(await base.inputValue(), "15");
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorFontPairing onApply={()=>new Promise(resolve=>window.finishEarlier=resolve)}/>);`,
  );
  await preset("technical").click();
  const earlierBase = Number(await base.inputValue());
  await apply().click();
  await page.waitForFunction(() => typeof window.finishEarlier === "function");
  await base.press("ArrowRight");
  assert.equal(await base.inputValue(), String(earlierBase + 1));
  await page.evaluate(() => window.finishEarlier());
  await page.waitForFunction(
    () =>
      document
        .querySelector("[data-demo=apply]")
        .getAttribute("aria-disabled") === "false",
  );
  assert.equal(
    await apply().isEnabled(),
    true,
    "A saved older snapshot cannot acknowledge newer type edits",
  );
  await capture("newer-draft", { audit: true });
  await page.getByRole("button", { name: "Revert", exact: true }).click();
  assert.equal(await base.inputValue(), String(earlierBase));
  await mount(
    `window.sentPairings=[];createRoot(document.getElementById('root')).render(<Subject.EditorFontPairing onChange={next=>{window.sentPairings.push({...next});next.base=999}}/>);`,
  );
  const beforeMutation = Number(await base.inputValue());
  await base.press("ArrowRight");
  assert.equal(
    await base.inputValue(),
    String(beforeMutation + 1),
    "Host callback mutation cannot change the retained pairing",
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorFontPairing/>);`,
  );
  await preset("technical").click();
  assert.equal(
    await apply().isDisabled(),
    true,
    "A missing host writer cannot acknowledge persistence",
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorFontPairing fonts={[]} presets={[]}/>);`,
  );
  for (const name of ["Pairings", "Heading", "Body"])
    assert.equal(await page.getByRole("radiogroup", { name, exact: true }).getByRole("radio").count(), 0);
  await page.getByText("Applying is unavailable.", { exact: true }).waitFor();
  assert.equal(await apply().isDisabled(), true);
  assert.doesNotMatch(
    await page.locator("section").innerText(),
    /NaN|Infinity/,
  );
  await capture("empty", { audit: true });
  await page.setViewportSize({ width: 1440, height: 1200 });
  await mount(`document.getElementById('root').style.maxWidth='none';createRoot(document.getElementById('root')).render(<Subject.EditorFontPairing/>);`);
  const pane = page.getByRole("region", { name: "Type specimen", exact: true });
  assert.ok(await pane.evaluate(node => node.scrollHeight > node.clientHeight));
  await pane.focus();
  assert.equal(await pane.evaluate(node => node === document.activeElement), true);
  const pageY = await page.evaluate(() => scrollY);
  await pane.press("End");
  await page.waitForFunction(() => document.querySelector('[data-fp-scroll]').scrollTop > 0);
  assert.equal(await page.evaluate(() => scrollY), pageY, "Specimen keys scroll inside its own canvas");
  await capture("keyboard-scroll", { audit: true });
}
