async function checkCore({ page, mount, assert }) {
  const tokens = [
    { id: "canvas", name: "Canvas", value: "#101010", role: "Background" },
    { id: "ink", name: "Ink", value: "#f5f5f5", role: "Body text" },
    { id: "muted", name: "Muted", value: "#686868", role: "Secondary text" },
  ];
  const pair = {
    id: "body",
    label: "Body",
    foregroundId: "muted",
    backgroundId: "canvas",
    fontSize: 14,
    fontWeight: 400,
  };
  const props = `pairs={[${JSON.stringify(pair)}]} defaultSelectedId="muted" specimen={<p data-token="ink" style={{padding:24,color:'var(--ink)',background:'var(--canvas)'}}>Invoice ready for review</p>}`;
  await page.setViewportSize({ width: 390, height: 2000 });
  await mount(
    `window.saved=[];window.fail=true;function Host(){const [tokens,setTokens]=useState(${JSON.stringify(tokens)});return <Subject.EditorColorTokenStudio value={tokens} ${props} onValueChange={async next=>{window.saved.push(next);if(window.fail)throw Error('Palette service unavailable');await new Promise(resolve=>window.finish=resolve);setTokens(next)}}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  const hex = () => page.locator('[data-demo="hex"]');
  const apply = () => page.locator('[data-demo="apply"]');
  const reading = () => page.locator('[data-demo="pair-body"]');
  assert.match(await reading().getAttribute("aria-label"), /fails$/);
  await page.locator('[data-demo="token-muted"]').press("Home");
  assert.equal(await page.locator('[data-demo="token-canvas"]').getAttribute("aria-checked"), "true");
  await page.locator('[data-demo="token-canvas"]').press("End");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "token-muted");
  const lightness = page.getByRole("slider", { name: "Lightness", exact: true });
  await lightness.press("End");
  assert.match(await reading().getAttribute("aria-label"), /AAA$/);
  await lightness.press("Home");
  assert.match(await reading().getAttribute("aria-label"), /fails$/);
  await page.locator('[data-demo="fix"]').press("Enter");
  assert.match(await reading().getAttribute("aria-label"), /AA(?:A)?$/);
  await lightness.press("Home");
  await lightness.scrollIntoViewIfNeeded();
  const box = await lightness.boundingBox();
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  assert.match(await reading().getAttribute("aria-label"), /(?:AA|AAA)$/);
  await hex().fill("#909090");
  await page.getByRole("button", { name: "Show CSS", exact: true }).press("Enter");
  const css = () => page.getByRole("region", { name: "Applied tokens as CSS", exact: true });
  assert.match(await css().innerText(), /--muted: #686868;/);
  await page.getByRole("button", { name: "Close CSS", exact: true }).press("Enter");
  await apply().press("Enter");
  await page.getByRole("status").filter({ hasText: "Palette service unavailable" }).waitFor();
  assert.equal(await hex().inputValue(), "#909090");
  const expected = tokens.map((t) => (t.id === "muted" ? { ...t, value: "#909090" } : t));
  assert.deepEqual(await page.evaluate(() => window.saved[0]), expected);
  await page.evaluate(() => (window.fail = false));
  await apply().press("Enter");
  await page.waitForFunction(() => typeof window.finish === "function");
  assert.equal(await hex().isDisabled(), true);
  assert.equal(await apply().getAttribute("aria-disabled"), "true");
  await apply().press("Enter");
  assert.equal(await page.evaluate(() => window.saved.length), 2, "Pending Apply cannot publish twice");
  await page.evaluate(() => window.finish());
  await page.getByRole("status").filter({ hasText: "1 token updated" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.saved[1]), expected);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.copied = text;
          throw Error("Clipboard denied");
        },
      },
    }),
  );
  await page.locator('[data-demo="copy"]').press("Enter");
  await css().filter({ hasText: "clipboard isn’t available" }).waitFor();
  assert.match(await css().innerText(), /--muted: #909090;/);
  await page.getByRole("button", { name: "Close CSS", exact: true }).press("Enter");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.copied = text;
        },
      },
    }),
  );
  await page.locator('[data-demo="copy"]').press("Enter");
  assert.match(await page.evaluate(() => window.copied), /--muted: #909090;/);
  await hex().fill("wrong");
  assert.equal(await hex().getAttribute("aria-invalid"), "true");
  assert.equal(await apply().isDisabled(), true);
  await page.locator('[data-demo="discard"]').press("Enter");
  assert.equal(await hex().inputValue(), "#909090");
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorColorTokenStudio defaultValue={${JSON.stringify(tokens)}} ${props} disabled/>);`,
  );
  assert.equal(await hex().isDisabled(), true);
  assert.equal(await apply().isDisabled(), true);
  await page.locator('[data-demo="token-ink"]').press("Enter");
  assert.equal(await page.getByRole("textbox", { name: "Ink hex value", exact: true }).isDisabled(), true);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorColorTokenStudio defaultValue={[]} pairs={[]}/>);`,
  );
  await page.getByText("Evening has no tokens yet", { exact: true }).waitFor();
  assert.equal(await page.getByRole("radio").count(), 0);
  assert.equal(await page.locator('[data-demo="copy"]').isDisabled(), true);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorColorTokenStudio defaultValue={[{id:'ink',name:'Ink',value:'invalid'}]} pairs={[${JSON.stringify(pair)}]}/>);`,
  );
  assert.equal(await hex().getAttribute("aria-invalid"), "true");
  assert.match(await reading().getAttribute("aria-label"), /a token is missing/);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
}

export async function check(ctx) {
  await checkCore(ctx);
  const { page, mount, assert } = ctx;
  const tokens = [
    { id: "canvas", name: "Canvas", value: "#101010" },
    { id: "ink", name: "Ink", value: "#f5f5f5" },
    { id: "muted", name: "Muted", value: "#909090" },
  ];
  const props = `pairs={[]} defaultSelectedId="muted" specimen={<p style={{color:'var(--ink)',background:'var(--canvas)'}}>Theme sample</p>}`;
  const hex = () => page.locator('[data-demo="hex"]');
  const apply = () => page.locator('[data-demo="apply"]');
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorColorTokenStudio defaultValue={[{id:'constructor',name:'Constructor',value:'#f5f5f5'}]} pairs={[]} specimen={<p data-token="constructor">Theme sample</p>}/>);`,
  );
  await hex().fill("#eeeeee");
  await apply().press("Enter");
  await page.getByRole("status").filter({ hasText: "1 token updated" }).waitFor();
  assert.equal(await hex().inputValue(), "#eeeeee", "A valid CSS id cannot resolve an inherited object property");
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorColorTokenStudio defaultValue={[{id:'ink',name:'One',value:'#fff'},{id:'ink',name:'Two',value:'#aaa'},{id:'bad id',name:'Bad',value:'#000'},{id:'constructor',name:'Constructor',value:'#f5f5f5'}]} pairs={[]} specimen={<p>Theme sample</p>}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /unique CSS-safe id/);
  assert.equal(await page.getByRole("radio").count(), 1, "Ambiguous and invalid ids are excluded together");
  await mount(
    `function Host(){const[tokens,setTokens]=useState(${JSON.stringify(tokens)});window.replaceTokens=setTokens;return <Subject.EditorColorTokenStudio value={tokens} ${props} onValueChange={()=>{}}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await hex().fill("invalid");
  await page.evaluate((next) => window.replaceTokens(next), tokens.slice(0, 2));
  await page.locator('[data-demo="token-muted"]').waitFor({ state: "detached" });
  await page.locator('[data-demo="token-ink"]').press("Enter");
  await hex().fill("#dddddd");
  assert.equal(await apply().isDisabled(), false, "A removed invalid draft cannot block the current palette");
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.EditorColorTokenStudio value={${JSON.stringify(tokens)}} ${props}/>);`,
  );
  assert.equal(await hex().isDisabled(), true);
  assert.match(await page.locator("#root").innerText(), /read-only/);
  for (const replacement of [
    [
      { id: "paper", name: "Paper", value: "#ffffff" },
      { id: "ink", name: "Ink", value: "#101010" },
    ],
    tokens.map((token) => (token.id === "muted" ? { ...token, value: "#ffffff" } : token)),
  ]) {
    await mount(
      `function Host(){const[tokens,setTokens]=useState(${JSON.stringify(tokens)});window.replaceTokens=setTokens;return <Subject.EditorColorTokenStudio value={tokens} ${props} onValueChange={()=>new Promise(resolve=>window.finishPalette=resolve)}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
    );
    await hex().fill("#aaaaaa");
    await apply().press("Enter");
    await page.waitForFunction(() => typeof window.finishPalette === "function");
    await page.evaluate((next) => window.replaceTokens(next), replacement);
    await page.waitForFunction(() => {
      const field = document.querySelector('[data-demo="hex"]');
      return field && !field.matches(":disabled");
    });
    await page.evaluate(() => window.finishPalette());
    await page.waitForTimeout(150);
    assert.equal(
      await page.getByRole("status").filter({ hasText: "1 token updated" }).count(),
      0,
      "An old request cannot acknowledge a replacement palette, including the same ids with new values",
    );
    assert.equal(await hex().isDisabled(), false);
  }
}
