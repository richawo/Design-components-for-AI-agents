import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const browser = await launchChromium();
const results = [];
for (const controlled of [false, true])
  for (const mode of ["throw", "reject"]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mountFixture(
      page,
      "ai-composer-minimal",
      "free",
      `
    window.events=[];
    function Fixture(){const [state,setState]=useState('idle');return <Subject.AiComposerMinimal defaultValue="Keep my draft" ${controlled ? "state={state}" : ""} onStateChange={next=>{window.events.push(next);setState(next)}} onSubmit={()=>{${mode === "throw" ? 'throw new Error("Offline")' : 'return Promise.reject(new Error("Offline"))'}}}/>};
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `,
    );
    await page.getByRole("button", { name: "Send message" }).click();
    await page.waitForTimeout(300);
    const result = {
      controlled,
      mode,
      errors,
      value: await page.getByRole("textbox", { name: "Message" }).inputValue(),
      send: await page.getByRole("button", { name: "Send message" }).count(),
      alert: await page.getByRole("alert").allTextContents(),
      states: await page.evaluate(() => window.events),
    };
    results.push(result);
    await page.close();
  }
await browser.close();
console.log(JSON.stringify(results, null, 2));
for (const r of results) {
  assert.equal(r.errors.length, 0);
  assert.equal(r.value, "Keep my draft");
  assert.equal(r.send, 1);
  assert.ok(r.alert.join("").includes("send"));
  assert.deepEqual(r.states, ["generating", "idle"]);
}
