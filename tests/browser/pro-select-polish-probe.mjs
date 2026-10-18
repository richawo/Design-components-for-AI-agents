import assert from "node:assert/strict";
import fs from "node:fs";
import { webkit } from "playwright-core";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const requested = process.argv.slice(2);
const slugs = fs.readdirSync("registry/pro").filter((slug) => {
  const file = `registry/pro/${slug}/meta.json`;
  return (
    fs.existsSync(file) &&
    JSON.parse(fs.readFileSync(file)).props.some((prop) => prop.name === "selectMode") &&
    (!requested.length || requested.includes(slug))
  );
});
const browser = process.env.BROWSER === "webkit" ? await webkit.launch() : await launchChromium();
const page = await browser.newPage({
  viewport: { width: 390, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function capturePopupFrame(control, eventType, outside = false) {
  await control.evaluate((node, { type, outside }) => {
    node.popupFrame = null;
    (outside ? document : node).addEventListener(type, () => requestAnimationFrame(() => {
      node.popupFrame = {
        visible: document.getElementById(node.getAttribute("aria-controls"))?.matches(":popover-open"),
        expanded: node.getAttribute("aria-expanded"),
        active: node.getAttribute("aria-activedescendant"),
      };
    }), { once: true });
  }, { type: eventType, outside });
}
async function checkPopupFrame(control, open) {
  await page.waitForFunction(node => node.popupFrame !== null, await control.elementHandle());
  const frame = await control.evaluate(node => node.popupFrame);
  assert.equal(frame.visible, open, "The native popup has the intended first-frame state");
  assert.equal(frame.expanded, String(open), "ARIA follows the popup in its first frame");
  assert.equal(frame.active !== null, open, "Keyboard state follows the popup in its first frame");
}
try {
  for (const slug of slugs) {
    for (const theme of ["dark", "light"]) {
      const width = theme === "dark" ? 320 : 390;
      await page.setViewportSize({ width, height: 900 });
      await mountFixture(
        page,
        slug,
        "pro",
        `createRoot(document.getElementById('root')).render(<Subject.default theme="${theme}"/>);`,
      );
      if (slug === "commerce-catalog-import") await page.getByRole("button", { name: "Read CSV", exact: true }).click();
      const controls = page
        .getByRole("combobox")
        .or(page.getByRole("button").and(page.locator('[aria-haspopup="listbox"]')));
      assert.ok((await controls.count()) > 0, slug);
      const count = await controls.count();
      for (let index = 0; index < count; index++) {
        const control = controls.nth(index);
        if (await control.isDisabled()) continue;
        assert.equal(await control.evaluate((el) => el.tagName), "BUTTON");
        const combobox = (await control.getAttribute("role")) === "combobox";
        const pads = await control.evaluate((el) => [
          getComputedStyle(el).paddingLeft,
          getComputedStyle(el).paddingRight,
        ]);
        if (combobox) assert.deepEqual(pads, ["12px", "12px"]);
        else assert.ok(parseFloat(pads[0]) >= 4 && parseFloat(pads[1]) >= 8, `${slug}: inset the avatar and chevron`);
        const id = await control.getAttribute("aria-controls");
        if (slug === "saas-audit-trail") await capturePopupFrame(control, "click");
        await control.click();
        const menu = page.locator(`[id=${JSON.stringify(id)}]`);
        await menu.waitFor({ state: "visible" });
        if (slug === "saas-audit-trail") await checkPopupFrame(control, true);
        const rect = await menu.boundingBox();
        assert.ok(
          rect.x >= 0 && rect.x + rect.width <= width + 1 && rect.y >= 0 && rect.y + rect.height <= 901,
          slug + " popup stays in viewport",
        );
        // Comboboxes keep focus on the trigger. Menu buttons move it into their listbox.
        const keyboard = combobox ? control : menu;
        await page.waitForFunction((node) => node === document.activeElement, await keyboard.elementHandle());
        const enabled = menu.locator('[role="option"]:not([aria-disabled="true"])');
        await keyboard.press("Home");
        assert.equal(await keyboard.getAttribute("aria-activedescendant"), await enabled.first().getAttribute("id"));
        await keyboard.press("End");
        assert.equal(await keyboard.getAttribute("aria-activedescendant"), await enabled.last().getAttribute("id"));
        const active = await keyboard.getAttribute("aria-activedescendant");
        assert.ok(active);
        assert.equal(await page.locator(`[id=${JSON.stringify(active)}]`).getAttribute("aria-disabled"), null);
        if (slug === "saas-audit-trail") await capturePopupFrame(control, "keydown");
        await keyboard.press("Escape");
        await menu.waitFor({ state: "hidden" });
        if (slug === "saas-audit-trail") await checkPopupFrame(control, false);
        assert.equal(await control.evaluate((el) => el === document.activeElement), true);
        if (slug === "saas-audit-trail") {
          await control.click();
          await menu.waitFor({ state: "visible" });
          await capturePopupFrame(control, "click");
          await control.click();
          await menu.waitFor({ state: "hidden" });
          await checkPopupFrame(control, false);
          await control.click();
          await menu.waitFor({ state: "visible" });
          await capturePopupFrame(control, "click", true);
          await page.locator("h2").first().click();
          await menu.waitFor({ state: "hidden" });
          await checkPopupFrame(control, false);
        }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await mountFixture(
      page,
      slug,
      "pro",
      `createRoot(document.getElementById('root')).render(<Subject.default selectMode="native"/>);`,
    );
    if (slug === "commerce-catalog-import") await page.getByRole("button", { name: "Read CSV", exact: true }).click();
    const native = page.getByRole("combobox").first();
    assert.equal(await native.evaluate((el) => el.tagName), "SELECT");
    assert.equal(await native.evaluate((el) => getComputedStyle(el).appearance), "none");
    assert.deepEqual(errors, []);
    console.log("PASS custom/native select polish " + slug);
  }
} finally {
  await browser.close();
}
