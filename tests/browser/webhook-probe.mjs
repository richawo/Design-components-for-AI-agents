import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const b = await launchChromium();
const p = await b.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const row = `{id:'evt_custom',event:'custom.event',time:'now',attempts:[],maxAttempts:5,payload:{hello:'world'}}`;
await mountFixture(
  p,
  "devtools-webhook-inspector",
  "pro",
  `createRoot(document.getElementById('root')).render(<Subject.WebhookInspector deliveries={[${row}]} />);`,
);
assert.ok(await p.getByText("No delivery attempts yet.").isVisible());
assert.ok(await p.locator('[data-demo="retry"]').isDisabled());
await p.locator('[data-demo="tab-request"]').focus();
await p.keyboard.press("ArrowRight");
assert.equal(
  await p.locator('[data-demo="tab-response"]').getAttribute("aria-selected"),
  "true",
);
assert.ok(
  await p.getByText("No response recorded.", { exact: true }).isVisible(),
);
await p.locator('[data-demo="filter-all"]').focus();
await p.keyboard.press("ArrowRight");
assert.ok(await p.getByText("No failed deliveries.").isVisible());
await mountFixture(
  p,
  "devtools-webhook-inspector",
  "pro",
  `window.calls=0;createRoot(document.getElementById('root')).render(<Subject.WebhookInspector deliveries={[{...${row},attempts:[{at:'12:00',status:500,ms:100}]}]} onRetry={()=>{window.calls++;return Promise.reject(Error('offline'))}} />);`,
);
await p.locator('[data-demo="retry"]').click();
await p.waitForTimeout(1600);
assert.equal(
  await p.getByRole("alert").textContent(),
  "Could not retry this delivery. Try again.",
);
assert.equal(
  await p.getByRole("list", { name: "Attempts" }).locator("li").count(),
  1,
);
assert.equal(await p.evaluate(() => window.calls), 1);
assert.ok(await p.locator('[data-demo="retry"]').isEnabled());
await mountFixture(
  p,
  "devtools-webhook-inspector",
  "pro",
  `createRoot(document.getElementById('root')).render(<Subject.WebhookInspector deliveries={[${row}]} onRetry={()=>new Promise(resolve=>window.finish=resolve)} />);`,
);
await p.locator('[data-demo="retry"]').click();
await p.waitForTimeout(1600);
assert.ok(await p.locator('[data-demo="retry"]').isDisabled());
assert.ok(await p.getByText("Attempt 1 sending…").isVisible());
await p.evaluate(() => window.finish());
await p.waitForTimeout(350);
assert.equal(
  await p.getByRole("list", { name: "Attempts" }).locator("li").count(),
  0,
);
assert.deepEqual(errors, []);
console.log(
  "Webhook empty attempts, unavailable metrics, tab/filter keys, failed and pending host retries pass without fabricated attempts.",
);
await b.close();
