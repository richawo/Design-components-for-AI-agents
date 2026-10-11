import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const b = await launchChromium();
const p = await b.newPage({
  viewport: { width: 320, height: 844 },
  reducedMotion: "reduce",
});
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await mountFixture(
  p,
  "chart-cohort-retention",
  "pro",
  `createRoot(document.getElementById('root')).render(<Subject.ChartCohortRetention segments={[{key:'empty',label:'Empty',cohorts:[]},{key:'full',label:'With data',cohorts:[{label:'Week 1',size:10,retention:[1,.5]}]}]} />);`,
);
await p.getByRole("status").filter({ hasText: "No retention data" }).waitFor();
assert.equal(await p.getByRole("img").count(), 0);
const radio = p.getByRole("radio", { name: "Empty", exact: true });
await radio.focus();
await p.keyboard.press("ArrowRight");
assert.equal(
  await p
    .getByRole("radio", { name: "With data", exact: true })
    .getAttribute("aria-checked"),
  "true",
);
await p.getByRole("img").waitFor();
assert.match(await p.getByRole("img").getAttribute("aria-label"), /50.0%/);
await mountFixture(
  p,
  "chart-radar-compare",
  "pro",
  `createRoot(document.getElementById('root')).render(<Subject.ChartRadarCompare profiles={[{key:'a',label:'A',scores:[]}]} />);`,
);
await p
  .getByRole("status")
  .filter({ hasText: "at least three axes" })
  .waitFor();
assert.deepEqual(errors, []);
console.log(
  "Empty nested cohorts, populated recovery, segment arrow navigation and insufficient radar axes passed.",
);
await b.close();
