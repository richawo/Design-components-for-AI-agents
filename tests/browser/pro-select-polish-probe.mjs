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
    JSON.parse(fs.readFileSync(file)).props.some(
      (prop) => prop.name === "selectMode",
    ) &&
    (!requested.length || requested.includes(slug))
  );
});
const browser =
  process.env.BROWSER === "webkit"
    ? await webkit.launch()
    : await launchChromium();
const page = await browser.newPage({
  viewport: { width: 390, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
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
      if (slug === "commerce-catalog-import")
        await page
          .getByRole("button", { name: "Read CSV", exact: true })
          .click();
      const controls = page.getByRole("combobox");
      assert.ok((await controls.count()) > 0, slug);
      const count = await controls.count();
      for (let index = 0; index < count; index++) {
        const control = controls.nth(index);
        if (await control.isDisabled()) continue;
        assert.equal(await control.evaluate((el) => el.tagName), "BUTTON");
        const pads = await control.evaluate((el) => [
          getComputedStyle(el).paddingLeft,
          getComputedStyle(el).paddingRight,
        ]);
        assert.deepEqual(pads, ["12px", "12px"]);
        const id = await control.getAttribute("aria-controls");
        await control.click();
        const menu = page.locator(`[id=${JSON.stringify(id)}]`);
        await menu.waitFor({ state: "visible" });
        const rect = await menu.boundingBox();
        assert.ok(
          rect.x >= 0 &&
            rect.x + rect.width <= width + 1 &&
            rect.y >= 0 &&
            rect.y + rect.height <= 901,
          slug + " popup stays in viewport",
        );
        const enabled = menu.locator(
          '[role="option"]:not([aria-disabled="true"])',
        );
        await control.press("Home");
        assert.equal(
          await control.getAttribute("aria-activedescendant"),
          await enabled.first().getAttribute("id"),
        );
        await control.press("End");
        assert.equal(
          await control.getAttribute("aria-activedescendant"),
          await enabled.last().getAttribute("id"),
        );
        const active = await control.getAttribute("aria-activedescendant");
        assert.ok(active);
        assert.equal(
          await page
            .locator(`[id=${JSON.stringify(active)}]`)
            .getAttribute("aria-disabled"),
          null,
        );
        await control.press("Escape");
        await menu.waitFor({ state: "hidden" });
        assert.equal(
          await control.evaluate((el) => el === document.activeElement),
          true,
        );
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await mountFixture(
      page,
      slug,
      "pro",
      `createRoot(document.getElementById('root')).render(<Subject.default selectMode="native"/>);`,
    );
    if (slug === "commerce-catalog-import")
      await page.getByRole("button", { name: "Read CSV", exact: true }).click();
    const native = page.getByRole("combobox").first();
    assert.equal(await native.evaluate((el) => el.tagName), "SELECT");
    assert.equal(
      await native.evaluate((el) => getComputedStyle(el).appearance),
      "none",
    );
    assert.deepEqual(errors, []);
    console.log("PASS custom/native select polish " + slug);
  }
} finally {
  await browser.close();
}
