import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const b = await launchChromium();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
async function segmentAligned() {
  await p.waitForFunction(
    () => {
      const button = document.querySelector("[role=radio][aria-checked=true]");
      const pill = button.parentElement.firstElementChild;
      const a = button.getBoundingClientRect(),
        c = pill.getBoundingClientRect();
      return (
        Math.max(Math.abs(a.left - c.left), Math.abs(a.right - c.right)) < 0.25
      );
    },
    undefined,
    { timeout: 3000 },
  );
}
try {
  await mountFixture(
    p,
    "segmented-control",
    "free",
    `createRoot(document.getElementById('root')).render(<div style={{width:543.25,transform:'scale(.83)',transformOrigin:'top left',background:'#fff',padding:16}}><Subject.SegmentedControl theme="light" width="equal" options={[{value:'all',label:'Everywhere'},{value:'team',label:'Teams',count:12},{value:'long',label:'A longer destination'}]}/></div>);`,
  );
  await segmentAligned();
  await p.getByRole("radio").first().focus();
  await p.keyboard.press("End");
  await segmentAligned();
  await p.setViewportSize({ width: 390, height: 900 });
  await segmentAligned();
  await p.setViewportSize({ width: 1440, height: 900 });
  await mountFixture(
    p,
    "header-hairline",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.HeaderHairline links={[{label:'A fractional destination',href:'#a'},{label:'Another destination',href:'#b'}]}/>);`,
  );
  await p.locator("#root").evaluate((e) => {
    e.style.maxWidth = "none";
    e.style.padding = "0";
    e.style.transform = "scale(.87)";
    e.style.transformOrigin = "top left";
  });
  await p.waitForTimeout(800);
  const nav = p.getByRole("navigation", { name: "Main", exact: true });
  for (const name of ["A fractional destination", "Another destination"]) {
    await nav.getByRole("link", { name, exact: true }).hover();
    await p.waitForFunction(
      (label) => {
        const link = [...document.querySelectorAll("[aria-label=Main] a")].find(
          (e) => e.textContent === label,
        );
        const item = link.parentElement;
        const pill = item.parentElement.firstElementChild;
        const a = item.getBoundingClientRect(),
          c = pill.getBoundingClientRect();
        return (
          Math.max(Math.abs(a.left - c.left), Math.abs(a.right - c.right)) <
          0.25
        );
      },
      name,
      { timeout: 3000 },
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Segmented selection and header hover surfaces stay aligned under fractional widths, ancestor scaling, keyboard changes and resizing.",
  );
} finally {
  await b.close();
}
