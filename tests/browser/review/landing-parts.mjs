async function media(page, reducedMotion) {
  await page.emulateMedia({ reducedMotion });
  // Let the media-query event and React commit reach a frame before the next input.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function assertClear(locator, assert) {
  const data = await locator.evaluate(node => {
    let opacity = 1;
    const filters = [];
    for (let parent = node; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      opacity *= Number(style.opacity);
      filters.push(style.filter);
    }
    return { opacity, filters };
  });
  assert.ok(data.opacity > 0.999 && data.filters.every(filter => filter === "none" || filter === "blur(0px)"), "Useful content stays clear through its ancestors after live reduction");
}

export async function checkHeaderLive({ page, mount, assert }) {
  await media(page, "no-preference");
  await page.setViewportSize({ width: 390, height: 1050 });
  await mount(`createRoot(document.getElementById('root')).render(<Subject.HeaderHairline showSearch={false}/>);`);
  await media(page, "reduce");
  await page.getByRole("button", { name: "Open menu", exact: true }).press("Enter");
  await page.waitForTimeout(80);
  const entries = await page.getByRole("dialog", { name: "Site menu", exact: true }).locator("li").evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node);
    return { y: new DOMMatrix(style.transform).m42, filter: style.filter };
  }));
  assert.ok(entries.length && entries.every(entry => Math.abs(entry.y) < 0.1 && (entry.filter === "none" || entry.filter === "blur(0px)")), "A mounted header follows live reduction before opening its menu");
  await page.keyboard.press("Escape");
}

const feature = `const steps=[{tab:'Draft',title:'Prepare the scope.',body:'Client and project records.',detail:'Draft details'},{tab:'Review',title:'Review the invoice.',body:'Check the agreed work.',detail:'Review details'},{tab:'Record',title:'Record the payment.',body:'Keep the payment in context.',detail:'Payment details'},{tab:'Allocate',title:'Allocate the payment.',body:'Set aside project funds.',detail:'Allocation details'}];`;
const featureRender = `<Subject.FeatureStickyScroll brand="Northline" steps={steps} currency="£" items={[{label:'Design',qty:'1',amount:2500},{label:'Handoff',qty:'1',amount:500}]} pots={[{label:'Reserve',share:.15},{label:'Project',share:.1}]}/>`;

export async function checkFeature({ page, mount, assert }) {
  await media(page, "reduce");
  await page.setViewportSize({ width: 1440, height: 1050 });
  await mount(feature + `createRoot(document.getElementById('root')).render(${featureRender});`);
  await page.getByRole("button", { name: "Go to step 2: Review", exact: true }).press("Enter");
  await page.getByRole("img", { name: "Northline app: Review", exact: true }).waitFor();
  await page.getByRole("button", { name: "Next step", exact: true }).press("Space");
  await page.getByRole("img", { name: "Northline app: Record", exact: true }).waitFor();
  await page.getByRole("button", { name: "Previous step", exact: true }).press("Enter");
  await page.getByRole("img", { name: "Northline app: Review", exact: true }).waitFor();
  await page.getByRole("button", { name: "Go to step 4: Allocate", exact: true }).press("Enter");
  await page.getByRole("img", { name: "Northline app: Allocate", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Next step", exact: true }).isDisabled(), true);
  await media(page, "no-preference");
  await mount(feature + `createRoot(document.getElementById('root')).render(${featureRender});`);
  await media(page, "reduce");
  await page.evaluate(() => {
    window.__featureScrolls = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (options) { window.__featureScrolls.push(options); return original.call(this, options); };
  });
  await page.getByRole("button", { name: "Go to step 2: Review", exact: true }).press("Enter");
  const panel = page.getByRole("img", { name: "Northline app: Review", exact: true });
  await panel.waitFor();
  await page.waitForTimeout(600);
  const scrolls = await page.evaluate(() => window.__featureScrolls);
  assert.ok(scrolls.some(options => options?.behavior === "auto") && !scrolls.some(options => options?.behavior === "smooth"), JSON.stringify({ scrolls, media: await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches) }));
  await assertClear(panel, assert);
}

export async function checkFooterLive({ page, mount, assert }) {
  await media(page, "no-preference");
  await page.setViewportSize({ width: 1440, height: 1050 });
  await mount(`window.footerLiveWrites=[];createRoot(document.getElementById('root')).render(<Subject.FooterNewsletter onSubscribe={email=>{window.footerLiveWrites.push(email);return new Promise(resolve=>window.finishFooterLive=resolve)}}/>);`);
  await media(page, "reduce");
  const input = page.getByRole("textbox", { name: /Email/i });
  await input.scrollIntoViewIfNeeded();
  await input.fill("broken-address");
  await page.evaluate(() => {
    const shell = document.querySelector("footer form > div"), start = performance.now();
    window.__footerLiveShake = { samples: [], done: false };
    const tick = () => {
      window.__footerLiveShake.samples.push(new DOMMatrix(getComputedStyle(shell).transform).m41);
      if (performance.now() - start < 550) requestAnimationFrame(tick); else window.__footerLiveShake.done = true;
    };
    requestAnimationFrame(tick);
  });
  await input.press("Enter");
  await page.waitForFunction(() => window.__footerLiveShake.done);
  assert.ok((await page.evaluate(() => window.__footerLiveShake.samples)).every(x => Math.abs(x) < 0.1), "Live reduction prevents validation shakes");
  await assertClear(input, assert);
  assert.deepEqual(await page.evaluate(() => window.footerLiveWrites), []);
  await media(page, "no-preference");
  await input.fill("person@studio.example");
  await input.press("Enter");
  await page.waitForFunction(() => typeof window.finishFooterLive === "function");
  await page.waitForFunction(() => document.querySelector("footer form").getAnimations({ subtree: true }).some(animation => animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity));
  await media(page, "reduce");
  await page.waitForFunction(() => !document.querySelector("footer form").getAnimations({ subtree: true }).some(animation => animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity));
  await page.evaluate(() => window.finishFooterLive());
  await page.getByRole("button", { name: "Use a different email", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.footerLiveWrites), ["person@studio.example"]);
}

export async function checkCoarseTargets({ page, mount, assert }, render, widths = [1440]) {
  assert.equal(await page.evaluate(() => matchMedia("(pointer:coarse)").matches), true);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1050 });
    await mount(`createRoot(document.getElementById('root')).render(${render});`);
    const email = page.getByRole("textbox", { name: /Email/i });
    if (await email.count()) await email.fill("person@studio.example");
    const targets = await page.locator("button:enabled,a[href]").evaluateAll(nodes => nodes.filter(node => node.getClientRects().length && !node.closest("[inert]") && getComputedStyle(node).visibility !== "hidden").map(node => {
      const box = node.getBoundingClientRect();
      return { label: node.getAttribute("aria-label") ?? node.textContent.trim(), width: box.width, height: box.height };
    }));
    assert.ok(targets.length);
    assert.deepEqual(targets.filter(target => target.width < 43.9 || target.height < 43.9), [], "Available coarse-pointer controls retain 44px targets");
  }
}
