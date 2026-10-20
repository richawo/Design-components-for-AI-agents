import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
import { check } from "./review/footer-newsletter-request.mjs";

const browser = await launchChromium();
try {
  for (const theme of ["dark", "light"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      const mount = code => mountFixture(page, "footer-newsletter", "free",
        code.replaceAll("<Subject.FooterNewsletter", '<Subject.FooterNewsletter theme="' + theme + '" '),
        { frameStyle: "width:100%;max-width:none;margin:0" });
      await check({ page, mount, assert });
      assert.deepEqual(errors, [], theme + " Footer runtime errors");
      console.log("PASS Footer request ownership, exact retry, context retirement, keyboard focus and phone bounds: " + theme);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
