import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const b = await launchChromium();
const p = await b.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await mountFixture(
  p,
  "chart-waffle",
  "free",
  `window.patch=()=>{};function Fixture(){const [props,setProps]=useState({});window.patch=setProps;return <Subject.ChartWaffle {...props}/>};createRoot(document.getElementById('root')).render(<Fixture/>);`,
);
for (const props of [
  { groups: [] },
  { periods: [] },
  { groups: [], periods: [] },
  { periods: [{ key: "zero", label: "Zero", counts: [0, 0, 0, 0] }] },
]) {
  await p.evaluate((props) => window.patch(props), props);
  await p.waitForTimeout(150);
  assert.equal(
    await p.getByRole("status").innerText(),
    "No data for this period.",
  );
  assert.equal(await p.getByRole("img").count(), 0);
}
await p.evaluate(() =>
  window.patch({
    periods: [
      { key: "zero", label: "Zero", counts: [0, 0, 0, 0] },
      { key: "data", label: "Data", counts: [2, 3, 5, 0] },
    ],
    defaultPeriod: "zero",
  }),
);
await p.waitForTimeout(150);
await p.getByRole("button", { name: "Data", exact: true }).click();
await p.waitForTimeout(200);
assert.match(
  await p.getByRole("img").getAttribute("aria-label"),
  /20 of 100.*30 of 100.*50 of 100/,
);
assert.equal(await p.getByRole("img").locator(":scope > div").count(), 100);
await p.evaluate(() =>
  window.patch({
    groups: [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
    ],
    periods: [{ key: "data", label: "Data", counts: [1e308, 1e308] }],
  }),
);
await p.waitForTimeout(200);
assert.match(
  await p.getByRole("img").getAttribute("aria-label"),
  /A 50 of 100, B 50 of 100/,
);
assert.equal(await p.getByRole("img").locator(":scope > div").count(), 100);
await p.evaluate(() =>
  window.patch({
    groups: [
      { key: "a", label: "A" },
      { key: "b", label: "B" },
    ],
    periods: [{ key: "data", label: "Data", counts: [NaN, -1] }],
  }),
);
await p.waitForTimeout(200);
assert.equal(await p.getByRole("img").count(), 0);
assert.deepEqual(errors, []);
console.log(
  "Empty arrays, zero periods, zero-to-data recovery, shrinking groups, extreme finite and invalid counts passed.",
);
await b.close();
