import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const browser = await launchChromium();
for (const scenario of ["success", "new-draft", "stop", "stale-rejection"]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mountFixture(
    page,
    "ai-composer-minimal",
    "free",
    `window.events=[];window.requests=[];function Fixture(){return <Subject.AiComposerMinimal defaultValue="Original" onStateChange={state=>window.events.push(state)} onSubmit={()=>new Promise((resolve,reject)=>window.requests.push({resolve,reject}))}/>};createRoot(document.getElementById('root')).render(<Fixture/>);`,
  );
  const field = page.getByRole("textbox", { name: "Message" });
  await page.getByRole("button", { name: "Send message" }).click();
  assert.equal(await field.inputValue(), "Original");
  if (scenario === "new-draft") await field.fill("Next draft");
  if (scenario === "stop" || scenario === "stale-rejection")
    await page.getByRole("button", { name: "Stop generating" }).click();
  if (scenario === "stale-rejection") {
    await field.fill("Second request");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.evaluate(() => window.requests[0].reject(new Error("Too late")));
    await page.waitForTimeout(120);
    assert.equal(await page.getByRole("alert").count(), 0);
    assert.equal(
      await page.getByRole("button", { name: "Stop generating" }).count(),
      1,
    );
    await page.evaluate(() => window.requests[1].resolve());
  } else await page.evaluate(() => window.requests[0].resolve());
  await page.waitForTimeout(250);
  assert.equal(
    await field.inputValue(),
    scenario === "new-draft"
      ? "Next draft"
      : scenario === "stop"
        ? "Original"
        : "",
  );
  assert.equal(errors.length, 0);
  console.log(`${scenario}: passed`);
  await page.close();
}
await browser.close();
