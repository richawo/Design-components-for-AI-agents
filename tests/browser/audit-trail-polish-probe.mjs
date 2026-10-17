import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: 1200, height: 1000 },
  reducedMotion: "no-preference",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await mountFixture(
    page,
    "saas-audit-trail",
    "pro",
    `createRoot(document.getElementById('root')).render(<Subject.default/>);`,
  );
  await page.locator("#root").evaluate((el) => (el.style.maxWidth = "1060px"));
  const outcome = page.getByRole("combobox", { name: "Outcome", exact: true });
  await outcome.click();
  await page.locator('[data-demo="outcome-denied"]').click();
  await page
    .getByRole("heading", { name: "Updated billing contact" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("list", { name: "Audit events" })
      .getByRole("button")
      .count(),
    2,
  );
  await page.waitForTimeout(350);
  await page.locator('[data-demo="changed-only"]').uncheck();
  const diff = page.getByRole("group", { name: "Record before and after" });
  await diff.getByText('"poNumber": "PO-88213"').waitFor();
  await outcome.click();
  await page.locator('[data-demo="outcome-all"]').click();
  const histogram = page.locator('[data-demo="histogram"]');
  await histogram.scrollIntoViewIfNeeded();
  // Each non-empty SVG group scales from the bottom of its own bounds.
  const origins = await histogram.locator('svg > g[style*="transform-origin"]').evaluateAll(groups => groups.flatMap(group => {
    const box = group.getBBox();
    if (!box.height) return [];
    return [{ height: box.height, origin: parseFloat(getComputedStyle(group).transformOrigin.split(" ")[1]), transformBox: getComputedStyle(group).transformBox }];
  }));
  assert.ok(origins.length > 0);
  assert.ok(origins.every(({ height, origin, transformBox }) => transformBox === "fill-box" && Math.abs(height - origin) < 1), JSON.stringify(origins));
  const chart = await histogram.boundingBox();
  await page.mouse.click(chart.x + chart.width - 2, chart.y + 30);
  const start = page.getByRole("slider", { name: "Range start" });
  await start.waitFor();
  const widths = await start.evaluate(edge => new Promise(resolve => {
    const samples = [];
    const began = performance.now();
    edge.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
    const sample = () => {
      samples.push(edge.parentElement.getBoundingClientRect().width);
      if (performance.now() - began < 900) requestAnimationFrame(sample);
      else resolve(samples);
    };
    requestAnimationFrame(sample);
  }));
  const end = await start.evaluate(edge => edge.parentElement.getBoundingClientRect().width);
  assert.equal(await start.getAttribute("aria-valuenow"), "0");
  assert.ok(widths.some(width => width > 0 && width < end - 1), `Brush expansion should interpolate: ${widths.join(", ")} -> ${end}`);
  await page.getByRole("button", { name: "Clear time range", exact: true }).click();
  await start.waitFor({ state: "detached" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mountFixture(
    page,
    "saas-audit-trail",
    "pro",
    `const events=[{id:'offset',at:'2026-10-19T11:00:00+02:00',actor:'A',action:'Earlier instant',target:'A',outcome:'success',requestId:'a',before:{},after:{}},{id:'utc',at:'2026-10-19T10:00:00Z',actor:'B',action:'Later instant',target:'B',outcome:'denied',requestId:'b',before:{x:null},after:{x:''}}];createRoot(document.getElementById('root')).render(<Subject.AuditTrail events={events}/>);`,
  );
  assert.match(
    await page
      .getByRole("list", { name: "Audit events" })
      .getByRole("button")
      .first()
      .innerText(),
    /later instant/,
  );
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const combo = page.getByRole("combobox", { name: "Actor", exact: true });
    await combo.click();
    const menu = page.getByRole("listbox", {
      name: "Actor options",
      exact: true,
    });
    const rect = await menu.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1);
    await combo.press("Escape");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS Audit Trail custom filtering, baseline histogram growth, animated brushing, timestamp ordering and phone popup placement.",
  );
} finally {
  await browser.close();
}
