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
  "devtools-code-block",
  "free",
  `window.setFiles=()=>{};function Fixture(){const [files,setFiles]=useState([{id:'one',name:'one.ts',lines:['one']},{id:'two',name:'two.ts',lines:['two']}]);window.setFiles=setFiles;return <Subject.CodeBlock files={files}/>};createRoot(document.getElementById('root')).render(<Fixture/>);`,
);
await p.evaluate(() =>
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => Promise.reject(new Error("denied")) },
  }),
);
await p.getByRole("button", { name: "Copy code", exact: true }).click();
await p.getByRole("alert").waitFor();
assert.equal(
  await p.getByRole("button", { name: "Copied", exact: true }).count(),
  0,
);
await p.evaluate(() =>
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text) => {
        window.copied = text;
        return Promise.resolve();
      },
    },
  }),
);
await p.getByRole("button", { name: "Copy code", exact: true }).click();
await p.getByRole("button", { name: "Copied", exact: true }).waitFor();
assert.equal(await p.evaluate(() => window.copied), "one");
await p.getByRole("tab", { name: "one.ts" }).focus();
await p.keyboard.press("ArrowRight");
assert.equal(
  await p.getByRole("tab", { name: "two.ts" }).getAttribute("aria-selected"),
  "true",
);
await p.keyboard.press("Tab");
assert.equal(
  await p
    .getByRole("button", { name: "Diff" })
    .evaluate((e) => e === document.activeElement),
  true,
);
await p.evaluate(() =>
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  }),
);
await p.getByRole("button", { name: "Copy code", exact: true }).click();
await p.getByRole("alert").waitFor();
await p.evaluate(() => window.setFiles([]));
await p.getByRole("status").filter({ hasText: "No files to show." }).waitFor();
assert.deepEqual(errors, []);
console.log(
  "Custom files, clipboard rejection/success/unavailable, arrow focus, empty-file recovery passed.",
);
await b.close();
