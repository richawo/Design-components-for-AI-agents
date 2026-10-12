import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const b = await launchChromium();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
try {
  await mountFixture(
    p,
    "header-announcement",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.HeaderAnnouncement messages={[{id:'first',text:'First announcement',link:{label:'First details',href:'#first'}},{id:'second',text:'Second announcement',link:{label:'Second details',href:'#second'}}]} interval={2000}/>);`,
  );
  await p.locator("#root").evaluate((e) => {
    e.style.maxWidth = "none";
    e.style.padding = "0";
  });
  await p.waitForTimeout(900);
  await p.evaluate(() => {
    window.duplicates = [];
    window.sample = true;
    const read = () => {
      const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
      window.duplicates.push(ids.filter((id, i) => ids.indexOf(id) !== i));
      if (window.sample) requestAnimationFrame(read);
    };
    requestAnimationFrame(read);
  });
  await p
    .getByRole("button", { name: "Announcement 2 of 2", exact: true })
    .click();
  assert.equal(
    await p.getByRole("link", { name: "First details", exact: true }).count(),
    0,
    "Exiting links leave the accessibility tree immediately",
  );
  await p.waitForTimeout(80);
  await p
    .getByRole("button", { name: "Announcement 1 of 2", exact: true })
    .click();
  await p.waitForTimeout(700);
  const duplicates = await p.evaluate(() => {
    window.sample = false;
    return window.duplicates.flat();
  });
  assert.deepEqual(
    duplicates,
    [],
    "Slide cross-fades must never duplicate IDs",
  );
  assert.equal(
    await p.getByRole("link", { name: "First details", exact: true }).count(),
    1,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Announcement reversals retain unique IDs and immediately remove exiting links from keyboard and screen-reader access.",
  );
} finally {
  await b.close();
}
