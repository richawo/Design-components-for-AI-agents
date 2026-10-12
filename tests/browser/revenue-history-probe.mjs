import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const browser = await launchChromium();
const page = await browser.newPage({
  reducedMotion: "reduce",
  viewport: { width: 390, height: 844 },
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  for (const [values, expected] of [
    [[12], "No previous period available"],
    [[0, 12], "Previous total: 0"],
    [[10, 12], "20.0%"],
  ]) {
    const data = values.map((value, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      value,
    }));
    await mountFixture(
      page,
      "chart-revenue-trend",
      "pro",
      `createRoot(document.getElementById('root')).render(<Subject.ChartRevenueTrend data={${JSON.stringify(data)}} ranges={[{key:'day',label:'One day',days:1}]}/>);`,
    );
    await page.getByText(expected, { exact: true }).first().waitFor();
    const plot = page.getByRole("img");
    await plot.focus();
    await plot.press("Home");
    assert.doesNotMatch(
      await page.locator("body").innerText(),
      /NaN|undefined|Infinity/,
    );
    assert.equal(
      await page.getByText("Previous", { exact: true }).count(),
      values.length === 1 ? 0 : 1,
    );
  }
  await mountFixture(
    page,
    "chart-allocation",
    "pro",
    `createRoot(document.getElementById('root')).render(<Subject.ChartAllocation palette={[]} views={[{key:'edge',label:'Edge cases',slices:[{id:'valid',name:'Valid allocation',value:100,change:1},{id:'zero',name:'Zero allocation',value:0},{id:'negative',name:'Negative allocation',value:-10}]}]}/>);`,
  );
  await page.getByText(/no comparison/).waitFor();
  assert.doesNotMatch(
    await page.locator("#root").innerText(),
    /NaN|Infinity|Negative allocation|Zero allocation/,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS revenue chart missing history, zero baseline, single-point labels and valid comparison.",
  );
} finally {
  await browser.close();
}
