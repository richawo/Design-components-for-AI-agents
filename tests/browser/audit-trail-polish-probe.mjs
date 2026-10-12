import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: 1200, height: 1000 },
  reducedMotion: "no-preference",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await mountFixture(
    page,
    "saas-audit-trail",
    "pro",
    `createRoot(document.getElementById('root')).render(<Subject.default/>);`,
  );
  await page.locator("#root").evaluate((el) => (el.style.maxWidth = "1060px"));
  const outcome = page.getByRole("combobox", { name: "Outcome", exact: true });
  await outcome.click();
  await page.getByRole("option", { name: "Denied", exact: true }).click();
  await page
    .getByRole("heading", { name: "Billing settings update attempted" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("list", { name: "Audit events" })
      .getByRole("button")
      .count(),
    1,
  );
  await page.waitForTimeout(350);
  await page.locator('[data-demo="changed-only"]').uncheck();
  await page
    .getByRole("heading", { name: "billingContact", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.waitForTimeout(500);
  const toggle = page.getByRole("button", { name: "Date range", exact: true });
  const heights = await toggle.evaluate(
    (button) =>
      new Promise((resolve) => {
        const samples = [];
        const start = performance.now();
        button.click();
        const sample = () => {
          samples.push(
            document.querySelector('[id$="-dates"]')?.getBoundingClientRect()
              .height ?? 0,
          );
          if (performance.now() - start < 900) requestAnimationFrame(sample);
          else resolve(samples);
        };
        requestAnimationFrame(sample);
      }),
  );
  const region = page.locator('[id$="-dates"]');
  const end = (await region.boundingBox()).height;
  assert.ok(
    heights.some((height) => height > 0 && height < end - 1),
    `Date expansion should have intermediate heights: ${heights.join(", ")} -> ${end}`,
  );
  await toggle.click();
  await region.waitFor({ state: "detached" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mountFixture(
    page,
    "saas-audit-trail",
    "pro",
    `const events=[{id:'offset',at:'2026-10-19T11:00:00+02:00',actor:'A',action:'Earlier instant',target:'A',outcome:'success',requestId:'a',before:{},after:{}},{id:'utc',at:'2026-10-19T10:00:00Z',actor:'B',action:'Later instant',target:'B',outcome:'denied',requestId:'b',before:{x:null},after:{x:''}}];createRoot(document.getElementById('root')).render(<Subject.AuditTrail events={events}/>);`,
  );
  assert.match(
    await page
      .getByRole("list", { name: "Audit events" })
      .getByRole("button")
      .first()
      .innerText(),
    /Later instant/,
  );
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const combo = page.getByRole("combobox", { name: "Actor", exact: true });
    await combo.click();
    const menu = page.getByRole("listbox", {
      name: "Actor options",
      exact: true,
    });
    const rect = await menu.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1);
    await combo.press("Escape");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS Audit Trail custom filtering, active exit semantics, date height animation, timestamp ordering and phone popup placement.",
  );
} finally {
  await browser.close();
}
