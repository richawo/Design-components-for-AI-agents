import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const b = await launchChromium();
const p = await b.newPage({
  viewport: { width: 1000, height: 1100 },
  reducedMotion: "reduce",
});
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const cases = [
  ["auth-sign-in", "free", "AuthSignIn", ""],
  ["auth-magic-link", "free", "AuthMagicLink", ""],
  ["footer-newsletter", "free", "FooterNewsletter", ""],
  ["billing-plan-change", "pro", "PlanChange", ""],
  ["billing-seat-manager", "pro", "SeatManager", ""],
  ["auth-sso-detect", "pro", "AuthSsoDetect", ""],
  ["agent-diff-review", "pro", "AgentDiffReview", ""],
  ["input-ai-prompt", "pro", "InputAiPrompt", ""],
];
try {
  for (const [slug, tier, name] of cases) {
    if (!fs.existsSync(`registry/${tier}/${slug}`)) continue;
    await mountFixture(
      p,
      slug,
      tier,
      `createRoot(document.getElementById('root')).render(<Subject.${name}/>);`,
    );
    if (slug === "footer-newsletter")
      await p.getByRole("textbox").fill("hello@example.com");
    if (slug === "billing-seat-manager")
      await p.locator("[data-demo=seat-plus]").click();
    if (slug === "input-ai-prompt")
      await p.locator("textarea").fill("Keep this draft");
    const selector =
      slug === "billing-plan-change" || slug === "billing-seat-manager"
        ? "[data-demo=confirm]"
        : slug === "agent-diff-review"
          ? "[data-demo=apply]"
          : slug === "input-ai-prompt"
            ? "[data-demo=send]"
            : "button[type=submit]";
    const action = p.locator(selector);
    assert.ok(await action.count(), slug + " has an action");
    assert.equal(
      await action.first().isDisabled(),
      true,
      slug + " cannot claim success without a handler",
    );
    if (slug === "input-ai-prompt") {
      await p.locator("textarea").press("Enter");
      assert.equal(
        (await p.locator("textarea").inputValue()).trim(),
        "Keep this draft",
      );
    }
    assert.deepEqual(errors, []);
    console.log("PASS unconfigured action " + slug);
  }
  for (const slug of ["mobile-paywall", "mobile-checkout-sheet"]) {
    if (!fs.existsSync(`registry/pro/${slug}`)) continue;
    const name =
      slug === "mobile-paywall" ? "MobilePaywall" : "MobileCheckoutSheet";
    await mountFixture(
      p,
      slug,
      "pro",
      `createRoot(document.getElementById('root')).render(<Subject.${name}/>);`,
    );
    const action =
      slug === "mobile-paywall"
        ? p.getByRole("button", { name: /Start my|Subscribe monthly/ }).first()
        : p.getByRole("button", { name: /^Pay / }).first();
    await action.waitFor({ state: "visible", timeout: 15000 });
    assert.ok(await action.count(), slug + " action renders");
    assert.equal(await action.isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log("PASS unconfigured action " + slug);
  }
} finally {
  await b.close();
}
