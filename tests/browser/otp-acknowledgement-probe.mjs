import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const b = await launchChromium();
const p = await b.newPage({
  viewport: { width: 900, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
try {
  await mountFixture(
    p,
    "auth-otp",
    "free",
    `window.verified=0;createRoot(document.getElementById('root')).render(<Subject.AuthOtp resendAfter={0} onVerified={()=>window.verified++}/>);`,
  );
  const field = p.getByRole("textbox", { name: "6-digit verification code" });
  assert.equal(await field.isEditable(), false);
  assert.equal(await p.locator("[data-demo=resend]").isDisabled(), true);
  assert.equal(await p.locator("[data-demo=edit]").count(), 0);
  assert.match(await p.getByRole("status").innerText(), /unavailable/);
  await p
    .locator("form")
    .evaluate((form) =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
  await p.waitForTimeout(1100);
  assert.equal(
    await p.evaluate(() => window.verified),
    0,
    "No verifier must never produce a verified result",
  );
  await mountFixture(
    p,
    "auth-otp",
    "free",
    `window.calls=0;window.verified=0;createRoot(document.getElementById('root')).render(<Subject.AuthOtp onVerify={()=>{window.calls++;return new Promise(resolve=>window.resolveVerify=resolve)}} onVerified={()=>window.verified++}/>);`,
  );
  await p.getByRole("textbox").fill("123456");
  await p.locator("form").evaluate((form) => {
    for (let i = 0; i < 2; i++)
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
  });
  assert.equal(
    await p.evaluate(() => window.calls),
    1,
    "Verification submits once while awaiting the server",
  );
  assert.equal(await p.evaluate(() => window.verified), 0);
  await p.evaluate(() => window.resolveVerify({ ok: true }));
  await p.waitForFunction(() => window.verified === 1);
  assert.equal(await p.evaluate(() => window.verified), 1);
  await mountFixture(
    p,
    "auth-otp",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.AuthOtp onVerify={async()=>{throw Error('offline')}}/>);`,
  );
  await p.getByRole("textbox").fill("123456");
  await p.waitForTimeout(200);
  assert.equal(await p.getByRole("textbox").inputValue(), "123456");
  assert.match(await p.getByRole("alert").innerText(), /reach the server/);
  assert.equal(await p.getByRole("textbox").isEditable(), true);
  await mountFixture(
    p,
    "auth-otp",
    "free",
    `window.verified=0;window.unmount=()=>root.unmount();const root=createRoot(document.getElementById('root'));root.render(<Subject.AuthOtp onVerify={()=>new Promise(resolve=>window.resolveVerify=resolve)} onVerified={()=>window.verified++}/>);`,
  );
  await p.getByRole("textbox").fill("123456");
  await p.evaluate(() => window.unmount());
  await p.evaluate(() => window.resolveVerify({ ok: true }));
  await p.waitForTimeout(1200);
  assert.equal(
    await p.evaluate(() => window.verified),
    0,
    "A late acknowledgement cannot navigate after unmount",
  );
  assert.deepEqual(errors, []);
  console.log(
    "OTP unavailable actions, awaited single verification, retry draft and unmounted acknowledgement pass.",
  );
} finally {
  await b.close();
}
