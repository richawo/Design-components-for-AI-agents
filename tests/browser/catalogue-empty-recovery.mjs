import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: 900, height: 900 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  for (const [slug, tier, name, props, recovered] of [
    [
      "footer-columns-status",
      "free",
      "FooterColumnsStatus",
      { locales: [] },
      "Language: English",
    ],
    [
      "pixel-matrix-display",
      "free",
      "PixelMatrixDisplay",
      { scenes: [] },
      "canvas",
    ],
    [
      "chart-allocation",
      "pro",
      "ChartAllocation",
      { views: [] },
      "Asset class",
    ],
    [
      "chart-revenue-trend",
      "pro",
      "ChartRevenueTrend",
      { data: [], ranges: [] },
      "Revenue",
    ],
  ]) {
    if (!fs.existsSync(`registry/${tier}/${slug}/${slug}.tsx`)) continue;
    await mountFixture(
      page,
      slug,
      tier,
      `function Fixture(){const [props,setProps]=useState(${JSON.stringify(props)});window.patch=setProps;return <Subject.${name} {...props}/>};createRoot(document.getElementById('root')).render(<Fixture/>);`,
    );
    assert.deepEqual(errors, [], slug + " empty");
    await page.evaluate(() => window.patch({}));
    await page.waitForTimeout(1200);
    if (recovered === "canvas") {
      assert.ok((await page.locator("canvas").evaluate((el) => el.width)) > 0);
    } else if (slug === "footer-columns-status") {
      assert.ok(
        await page.getByRole("button", { name: /Language:/ }).isVisible(),
      );
    } else {
      assert.ok((await page.locator("#root").innerText()).includes(recovered));
      assert.ok((await page.locator("svg").count()) > 0);
    }
    assert.deepEqual(errors, [], slug + " recovery");
    console.log("PASS empty-data recovery " + slug);
  }
} finally {
  await browser.close();
}
