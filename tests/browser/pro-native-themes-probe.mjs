import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
// Exchange Selector uses custom choice cards; its dedicated probe covers them.
const slugs = [
  "commerce-promotion-builder",
  "fashion-size-guide",
  "finance-payment-run",
  "hr-policy-acknowledgement",
  "hr-compensation-review",
  "legal-signature-request",
  "saas-report-scheduler",
];
const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: 390, height: 900 },
  reducedMotion: "reduce",
});
try {
  for (const slug of slugs) {
    if (!fs.existsSync("registry/pro/" + slug)) continue;
    for (const theme of ["light", "dark"]) {
      await mountFixture(
        page,
        slug,
        "pro",
        `createRoot(document.getElementById('root')).render(<Subject.default theme="${theme}"/>);`,
      );
      const controls = await page
        .locator("input,select,textarea")
        .evaluateAll((els) =>
          els.map((el) => getComputedStyle(el).colorScheme),
        );
      assert.ok(controls.length > 0, slug);
      assert.ok(
        controls.every((value) => value === theme),
        slug + " " + theme + ": " + controls.join(", "),
      );
    }
    console.log("PASS native control palettes " + slug);
  }
} finally {
  await browser.close();
}
