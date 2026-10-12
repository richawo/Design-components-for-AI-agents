import assert from "node:assert/strict";
import fs from "node:fs";
import { webkit } from "playwright-core";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const slugs = JSON.parse(fs.readFileSync("registry/__generated__/index.json"))
  .filter((entry) => entry.kind === "block")
  .map((entry) => entry.slug);
const browser = await webkit.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const results = [];
try {
  for (const slug of slugs) {
    for (const theme of ["dark", "light"]) {
      await mountFixture(
        page,
        slug,
        "pro",
        `createRoot(document.getElementById('root')).render(<Subject.default theme="${theme}"/>);`,
      );
      await page.locator("#root").evaluate((node) => {
        node.style.maxWidth = "none";
        node.style.padding = "0";
      });
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(120);
        assert.ok(
          (await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          )) <= 1,
          `${slug} ${theme} ${width}`,
        );
      }
      if (!slug.includes("landing")) {
        const select = page.getByRole("combobox").first();
        if ((await select.count()) && !(await select.isDisabled())) {
          await select.click();
          const popup = page.getByRole("listbox").last();
          await popup.waitFor();
          const rect = await popup.boundingBox();
          assert.ok(
            rect.x >= -1 && rect.x + rect.width <= 321,
            `${slug} menu horizontal bounds`,
          );
          await page.keyboard.press("Escape");
        }
      }
      assert.deepEqual(errors, []);
      results.push({ slug, theme, widths: [1440, 768, 390, 320] });
    }
    console.log("PASS WebKit block render " + slug);
  }
  for (const slug of [
    "commerce-workspace",
    "fashion-workspace",
    "legal-workspace",
    "people-workspace",
    "saas-landing",
    "workspace-settings",
  ]) {
    await page.setViewportSize({ width: 1440, height: 1500 });
    const mount = async (code) => {
      await mountFixture(page, "block-" + slug, "pro", code);
      await page.locator("#root").evaluate((node) => {
        node.style.maxWidth = "none";
        node.style.padding = "0";
      });
    };
    const { check } = await import("./blocks/" + slug + ".mjs");
    await check({ page, mount, assert });
    assert.deepEqual(errors, []);
    console.log("PASS WebKit block workflow " + slug);
  }
  fs.writeFileSync(
    "test-results/page-structure-20261012/webkit-blocks.json",
    JSON.stringify(results, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
