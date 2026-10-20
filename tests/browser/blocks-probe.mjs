import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const requested = new Set(process.argv.slice(2));
const cases = fs
  .readdirSync("tests/browser/blocks")
  .filter((file) => file.endsWith(".mjs"))
  .map((file) => file.slice(0, -4))
  .filter((slug) => !requested.size || requested.has(slug));
const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1500 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  for (const slug of cases) {
    const full = "block-" + slug;
    if (!fs.existsSync(`registry/pro/${full}`)) continue;
    const mount = async (code) => {
      await mountFixture(page, full, "pro", code);
      await page.locator("#root").evaluate((el) => {
        el.style.maxWidth = "none";
        el.style.padding = "0";
      });
    };
    const { check } = await import(`./blocks/${slug}.mjs`);
    await check({ page, mount, assert });
    const touchCase = {
      "people-workspace": ["PeopleWorkspace", "block-people-touch"],
      "saas-dashboard": ["SaasDashboard", "block-saas-dashboard-touch"],
      "team-workspace": ["TeamWorkspace", "block-team-touch"],
    }[slug];
    if (touchCase) {
      const touchPage = await browser.newPage({
        viewport: { width: 390, height: 940 },
        reducedMotion: "reduce",
        hasTouch: true,
        isMobile: true,
      });
      touchPage.on("pageerror", error => errors.push(error.message));
      try {
        const { check: checkTouch } = await import(`./review/${touchCase[1]}.mjs`);
        for (const theme of ["dark", "light"]) {
          const mountTouch = async code => {
            await mountFixture(touchPage, full, "pro", code
              .replaceAll("<Subject." + touchCase[0], `<Subject.${touchCase[0]} theme="${theme}" `)
              .replaceAll("<Subject.default", `<Subject.default theme="${theme}" `));
            await touchPage.locator("#root").evaluate(node => {
              node.style.maxWidth = "none";
              node.style.padding = "0";
            });
          };
          await checkTouch({ page: touchPage, mount: mountTouch, assert });
        }
      } finally {
        await touchPage.close();
      }
    }
    assert.deepEqual(errors, [], slug);
    console.log("PASS block workflow " + slug);
  }
} finally {
  await browser.close();
}
