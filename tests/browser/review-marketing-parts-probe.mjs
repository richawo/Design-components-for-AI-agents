import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
import { check, checkTouch } from "./review/pricing-comparison-matrix.mjs";
const browser = await launchChromium();
try {
  for (const theme of ["dark", "light"]) {
    for (const touch of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce", ...(touch ? { hasTouch: true, isMobile: true } : {}) });
      page.setDefaultTimeout(12000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      try {
        const mount = code => mountFixture(page, "pricing-comparison-matrix", "free", code.replaceAll("<Subject.PricingComparisonMatrix", '<Subject.PricingComparisonMatrix theme="' + theme + '" '), { frameStyle: "width:100%;max-width:none;margin:0" });
        await (touch ? checkTouch : check)({ page, mount, assert });
        assert.deepEqual(errors, []);
        console.log("PASS comparison keyboard, full units, inherited inset and target bounds: " + theme + (touch ? " coarse" : " fine"));
      } finally { await page.close(); }
    }
  }
} finally { await browser.close(); }
