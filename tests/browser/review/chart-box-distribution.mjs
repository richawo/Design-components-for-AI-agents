/** Compare the rendered solid colours, including alpha and CSS colour-mix backgrounds. */
async function textContrast(locator) {
  const colours = await locator.evaluate((el) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw Error("The contrast probe requires Canvas 2D.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 1, 1);
    const layers = [];
    for (let node = el; node; node = node.parentElement) layers.push(getComputedStyle(node).backgroundColor);
    for (const colour of layers.reverse()) {
      context.fillStyle = colour;
      context.fillRect(0, 0, 1, 1);
    }
    const background = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    context.fillStyle = getComputedStyle(el).color;
    context.fillRect(0, 0, 1, 1);
    return { background, foreground: Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3) };
  });
  const luminance = (rgb) =>
    rgb
      .map((value) => (value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const values = [luminance(colours.background), luminance(colours.foreground)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export async function check({ page, mount, assert }) {
  const groups = [
    { id: "alpha", label: "Alpha", values: [100, 110, 120] },
    { id: "beta", label: "Beta", values: [200, 210, 220] },
    { id: "gamma", label: "Gamma", values: [300, 310, 320] },
  ];
  await mount(
    `window.limits=[];window.sorts=[];const root=createRoot(document.getElementById('root'));window.renderStatus=status=>root.render(<Subject.ChartBoxDistribution groups={${JSON.stringify(groups)}} defaultThreshold={200} onThresholdChange={v=>window.limits.push(v)} onSortChange={s=>window.sorts.push(s)} status={status} onRetry={()=>window.renderStatus('ready')}/>);window.renderStatus('ready');`,
  );
  const limit = page.getByRole("slider", { name: "Latency limit", exact: true });
  await limit.press("Home");
  assert.equal(await limit.getAttribute("aria-valuenow"), "0");
  await limit.press("ArrowRight");
  const small = Number(await limit.getAttribute("aria-valuenow"));
  assert.ok(small > 0);
  await limit.press("Shift+ArrowRight");
  assert.equal(Number(await limit.getAttribute("aria-valuenow")), small * 6);
  await limit.press("End");
  assert.equal(await limit.getAttribute("aria-valuenow"), await limit.getAttribute("aria-valuemax"));
  const max = Number(await limit.getAttribute("aria-valuemax"));
  const handle = await limit.boundingBox();
  const track = await page.locator("[data-limit-track]").boundingBox();
  assert.ok(handle && track);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width / 2, handle.y + handle.height / 2, { steps: 12 });
  await page.mouse.up();
  const dragged = Number(await limit.getAttribute("aria-valuenow"));
  assert.ok(dragged > 0 && dragged < max, "Dragging changes the measured threshold");
  await page.locator('[data-demo="sort-p50"]').press("ArrowRight");
  assert.equal(await page.locator('[data-demo="sort-p95"]').getAttribute("aria-checked"), "true");
  assert.equal(await page.locator('[data-demo^="row-"]').first().getAttribute("data-demo"), "row-gamma");
  await page.locator('[data-demo="row-alpha"]').focus();
  assert.match(await page.locator('[data-demo="row-alpha"]').getAttribute("aria-label"), /median 110/);
  await page.evaluate(() => window.renderStatus("unavailable"));
  await page.getByText("Couldn’t load samples", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Retry", exact: true }).press("Enter");
  await limit.waitFor();
  assert.equal(Number(await limit.getAttribute("aria-valuenow")), dragged);
  assert.equal(await page.locator('[data-demo="sort-p95"]').getAttribute("aria-checked"), "true");
  assert.equal(await page.evaluate(() => window.limits.every(Number.isFinite)), true);
  assert.deepEqual(await page.evaluate(() => window.sorts), ["p95"]);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartBoxDistribution groups={[{id:'bad',label:'Bad samples',values:[NaN,Infinity]}]}/>);`,
  );
  await page.getByText("No samples yet", { exact: true }).waitFor();
  assert.equal(await page.getByRole("slider").count(), 0);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartBoxDistribution groups={${JSON.stringify(groups.slice(0, 1))}}/>);`,
  );
  const firstLimit = Number(await limit.getAttribute("aria-valuenow"));
  const firstAxisMax = await limit.getAttribute("aria-valuemax");
  assert.ok(
    firstLimit <= Number(await limit.getAttribute("aria-valuemax")),
    "The default limit fits a small dataset’s axis",
  );
  await limit.press("ArrowRight");
  assert.ok(Number(await limit.getAttribute("aria-valuenow")) >= firstLimit, "Right cannot decrease the limit");
  await limit.press("Home");
  assert.equal(
    await limit.getAttribute("aria-valuemax"),
    firstAxisMax,
    "Lowering the limit keeps drag geometry stable",
  );
  await mount(
    `const root=createRoot(document.getElementById('root'));window.ready=()=>root.render(<Subject.ChartBoxDistribution groups={${JSON.stringify(groups)}}/>);root.render(<Subject.ChartBoxDistribution groups={${JSON.stringify(groups)}} status="unavailable" onRetry={()=>window.ready()}/>);`,
  );
  await page.getByRole("button", { name: "Retry", exact: true }).press("Enter");
  await limit.waitFor();
  assert.ok(
    (await page.locator("[data-limit-track]").boundingBox()).width > 200,
    "Retry attaches and measures the plot",
  );
  await page.setViewportSize({ width: 768, height: 900 });
  await page.waitForFunction(() => document.querySelector('[data-demo="row-alpha"]').style.gridTemplateColumns !== "");
  assert.ok((await page.locator('[data-demo="row-alpha"]').boundingBox()).width > 390);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('[data-demo="row-alpha"]').style.gridTemplateColumns === "");
  for (const [props, message] of [
    ["defaultThreshold={NaN}", "Check the latency limit"],
    ["threshold={Infinity}", "Check the latency limit"],
    ["defaultThreshold={-1}", "Check the latency limit"],
    ["target={1.1}", "Check the pass target"],
    ["target={NaN}", "Check the pass target"],
    ["decimals={Infinity}", "Check number formatting"],
    ["decimals={-1}", "Check number formatting"],
    ['locale="invalid_locale"', "Check number formatting"],
    ['defaultSort="unknown"', "Check the row order"],
  ]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.ChartBoxDistribution groups={${JSON.stringify(groups)}} ${props}/>);`,
    );
    await page.getByRole("alert").getByText(message, { exact: true }).waitFor();
    assert.equal(await page.getByRole("slider").count(), 0);
    assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity/);
  }
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.ChartBoxDistribution groups={[{id:'huge',label:'Large samples',values:[1e308,1.5e308,1.7e308]}]} defaultThreshold={1.6e308} showMean/>);`,
  );
  await limit.waitFor();
  assert.equal(Number.isFinite(Number(await limit.getAttribute("aria-valuemax"))), true);
  assert.doesNotMatch(await page.locator("#root").innerText(), /NaN|Infinity|∞/);
  assert.equal(
    await page
      .locator("svg path")
      .evaluateAll((paths) => paths.every((path) => !/(?:NaN|Infinity)/.test(path.getAttribute("d") || ""))),
    true,
  );
  assert.ok(
    (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1,
    "Large values stay inside the viewport",
  );
  assert.match(await limit.getAttribute("aria-valuetext"), /E308/);
  for (const name of ["aria-valuemin", "aria-valuemax", "aria-valuenow"])
    assert.match(await limit.getAttribute(name), /^\d+(?:\.\d+)?$/, "Slider bounds use plain decimal ARIA syntax");

  // A viewport resize must not retain wider plot coordinates while observer reports are queued.
  await page.setViewportSize({ width: 390, height: 844 });
  await mount(`
    const NativeObserver = window.ResizeObserver;
    const nativeAdd = window.addEventListener;
    window.__plotReports = [];
    window.__holdPlotReports = false;
    const readPlot = () => ({
      width: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth,
      trackWidth: document.querySelector('[data-limit-track]').getBoundingClientRect().width,
      rows: document.querySelectorAll('[data-demo^="row-"]').length,
    });
    window.ResizeObserver = class extends NativeObserver {
      constructor(callback) {
        const report = { callback, entries: null, observer: null };
        super((entries, observer) => {
          report.entries = entries;
          report.observer = observer;
          if (!window.__holdPlotReports) callback(entries, observer);
        });
        window.__plotReports.push(report);
      }
    };
    window.__capturePlotResize = () => {
      window.__delayedPlotReports = window.__plotReports
        .filter(report => report.entries)
        .map(report => ({ ...report }));
      window.__holdPlotReports = true;
      window.__plotResizeFrame = null;
      nativeAdd.call(window, 'resize', () => {
        requestAnimationFrame(() => { window.__plotResizeFrame = readPlot(); });
      }, { once: true });
    };
    window.__replayPlotReports = () => {
      window.__plotLateFrame = null;
      for (const report of window.__delayedPlotReports) report.callback(report.entries, report.observer);
      requestAnimationFrame(() => {
        window.__plotLateFrame = { ...readPlot(), reports: window.__delayedPlotReports.length };
      });
    };
    window.__restorePlotObserver = () => {
      window.__holdPlotReports = false;
      window.ResizeObserver = NativeObserver;
    };
    document.getElementById('root').style.padding = '0';
    document.getElementById('root').style.maxWidth = 'none';
    createRoot(document.getElementById('root')).render(<Subject.default/>);
  `);
  await page.locator("[data-limit-track]").waitFor();
  assert.equal(await page.locator('[data-demo^="row-"]').count(), 7);
  const before = await page.locator("[data-limit-track]").boundingBox();
  await page.evaluate(() => window.__capturePlotResize());
  try {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.waitForFunction(() => window.__plotResizeFrame !== null);
    const frame = await page.evaluate(() => window.__plotResizeFrame);
    assert.equal(frame.rows, 7, "Rows remain mounted during the resize");
    assert.ok(
      frame.overflow <= 1,
      "The first resize frame stays inside the touch viewport while observer delivery is held",
    );
    assert.ok(
      frame.trackWidth < before.width - 60,
      "The plot follows the new viewport before deferred observer reports",
    );
    await page.evaluate(() => window.__replayPlotReports());
    await page.waitForFunction(() => window.__plotLateFrame !== null);
    const late = await page.evaluate(() => window.__plotLateFrame);
    assert.ok(late.reports >= 2, "Both initial plot measurements are replayed");
    assert.ok(late.overflow <= 1, "Delayed wider reports cannot restore stale geometry");
    assert.equal(late.trackWidth, frame.trackWidth, "Delayed observer delivery retains the current plot");
  } finally {
    await page.evaluate(() => window.__restorePlotObserver());
    await page.setViewportSize({ width: 390, height: 844 });
  }

  // The light demo's blue handle previously rendered white text at only 4.09:1.
  for (const accent of [undefined, "#777", "#0008", "#00000080", "#f4f4f5", "constructor"]) {
    await mount(
      `createRoot(document.getElementById('root')).render(<Subject.default theme="light" ${accent ? `accent=${JSON.stringify(accent)}` : ""}/>);`,
    );
    await limit.waitFor();
    assert.ok((await textContrast(limit)) >= 4.5, `Readable handle for ${accent ?? "the default light accent"}`);
    if (accent === "#f4f4f5" || accent === "constructor") {
      const rendered = await limit.evaluate((el) => ({
        accent: getComputedStyle(el).backgroundColor,
        ink: getComputedStyle(el.closest("section")).color,
      }));
      assert.equal(rendered.accent, rendered.ink, "Neutral and unsupported demo colours follow the theme ink");
    }
  }

  await limit.press("End");
  const verdict = page.getByText("Meets 90% target", { exact: true });
  await verdict.waitFor();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(350);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.ok((await textContrast(verdict)) >= 4.5, "The target-met verdict retains readable text on its tint");
}
