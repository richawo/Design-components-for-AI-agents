import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const b = await launchChromium();
const p = await b.newPage({
  viewport: { width: 900, height: 1100 },
  reducedMotion: "reduce",
});
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
try {
  await mountFixture(
    p,
    "collab-invite-people",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.CollabInvitePeople drafts={[{email:'new@example.com'}]} pending={[{email:'pending@example.com',name:'Pending',role:'edit'}]}/>);`,
  );
  assert.equal(await p.locator("[data-demo=send]").isDisabled(), true);
  assert.equal(
    await p
      .getByRole("button", { name: "Withdraw invite to Pending" })
      .isDisabled(),
    true,
  );
  await mountFixture(
    p,
    "collab-invite-people",
    "free",
    `window.sent=0;createRoot(document.getElementById('root')).render(<Subject.CollabInvitePeople drafts={[{email:'new@example.com'}]} onInvite={()=>{window.sent++;return new Promise((resolve,reject)=>{window.accept=resolve;window.reject=reject})}}/>);`,
  );
  await p.locator("[data-demo=send]").click();
  assert.equal(await p.evaluate(() => window.sent), 1);
  assert.equal(
    await p.getByRole("list", { name: "Pending invites" }).count(),
    0,
  );
  await p.evaluate(() => window.reject(Error("offline")));
  await p.getByRole("alert").waitFor();
  assert.match(await p.getByRole("alert").innerText(), /draft is kept/);
  assert.equal(
    await p.getByRole("list", { name: "Pending invites" }).count(),
    0,
  );
  await p.locator("[data-demo=send]").click();
  await p.evaluate(() => window.accept());
  await p.getByRole("list", { name: "Pending invites" }).waitFor();
  assert.match(
    await p.getByRole("list", { name: "Pending invites" }).innerText(),
    /new@example.com/,
  );
  await mountFixture(
    p,
    "collab-invite-people",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.CollabInvitePeople pending={[{email:'pending@example.com',name:'Pending',role:'edit'}]} onWithdraw={async()=>{throw Error('offline')}}/>);`,
  );
  await p.getByRole("button", { name: "Withdraw invite to Pending" }).click();
  await p.getByRole("alert").waitFor();
  assert.match(await p.getByRole("alert").innerText(), /still pending/);
  assert.match(
    await p.getByRole("list", { name: "Pending invites" }).innerText(),
    /pending@example.com/,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Invitation actions require handlers, await acknowledgement and preserve drafts or pending requests on rejection.",
  );
} finally {
  await b.close();
}
