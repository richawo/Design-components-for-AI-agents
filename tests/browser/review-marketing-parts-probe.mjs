import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
import { check, checkTouch } from "./review/pricing-comparison-matrix.mjs";
import { check as checkHero } from "./review/hero-blur-statement.mjs";
import { check as checkHeader } from "./review/header-hairline.mjs";
import { checkHeaderLive, checkFeature, checkFooterLive, checkCoarseTargets } from "./review/landing-parts.mjs";
// Frame-bound interruption checks use the native renderer, matching motion QA.
const browser = await launchChromium({ args: [] });
async function preserveFailure(page, name, error) {
  const folder = process.env.DFA_DRAFT_QA_OUT;
  if (!folder) return;
  fs.mkdirSync(folder, { recursive: true });
  await page.screenshot({ path: folder + "/" + name + "-failed.png", fullPage: true });
  const animations = await page.evaluate(() => document.getAnimations({ subtree: true }).map(animation => ({ state: animation.playState, currentTime: animation.currentTime, timing: animation.effect?.getTiming(), target: animation.effect?.target?.textContent })));
  fs.writeFileSync(folder + "/" + name + "-failed.json", JSON.stringify({ error: String(error.stack), animations }, null, 2) + "\n");
}
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: "reduce" });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      const mount = (code, options) => mountFixture(page, "hero-blur-statement", "free", code.replaceAll("<Subject.HeroBlurStatement", '<Subject.HeroBlurStatement theme="' + theme + '" '), { frameStyle: "width:100%;max-width:none;margin:0", ...options });
      await checkHero({ page, mount, assert });
      assert.deepEqual(errors, []);
      console.log("PASS hero painted contrast, phone actions, keyboard rotation and live interruption: " + theme);
    } catch (error) { await preserveFailure(page, "hero-" + theme, error); throw error; }
    finally { await page.close(); }
    for (const [slug, component, checkPart] of [
      ["header-hairline", "HeaderHairline", async context => { await checkHeader(context); await checkHeaderLive(context); }],
      ["feature-sticky-scroll", "FeatureStickyScroll", checkFeature],
      ["footer-newsletter", "FooterNewsletter", checkFooterLive],
    ]) {
      const partPage = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: "reduce" });
      partPage.setDefaultTimeout(12000);
      const errors = [];
      partPage.on("pageerror", error => errors.push(error.message));
      try {
        const mount = code => mountFixture(partPage, slug, "free", component === "HeaderHairline" ? code : code.replaceAll("<Subject." + component, '<Subject.' + component + ' theme="' + theme + '" '), { frameStyle: "width:100%;max-width:none;margin:0" });
        await checkPart({ page: partPage, mount, assert });
        assert.deepEqual(errors, []);
        console.log("PASS " + slug + " keyboard, navigation and live preference: " + theme);
      } catch (error) { await preserveFailure(partPage, slug + "-" + theme, error); throw error; }
      finally { await partPage.close(); }
    }
    for (const [slug, render, widths] of [
      ["header-hairline", "<Subject.HeaderHairline/>", [320, 1440]],
      ["feature-sticky-scroll", "<Subject.FeatureStickyScroll/>", [1440]],
      ["footer-newsletter", '<Subject.FooterNewsletter theme="' + theme + '" onSubscribe={async()=>{}}/>', [320, 1440]],
    ]) {
      const touchPage = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: "reduce", hasTouch: true, isMobile: true });
      touchPage.setDefaultTimeout(12000);
      const errors = [];
      touchPage.on("pageerror", error => errors.push(error.message));
      try {
        const mount = code => mountFixture(touchPage, slug, "free", code, { frameStyle: "width:100%;max-width:none;margin:0" });
        await checkCoarseTargets({ page: touchPage, mount, assert }, render, widths);
        assert.deepEqual(errors, []);
        console.log("PASS " + slug + " coarse targets: " + theme);
      } catch (error) { await preserveFailure(touchPage, slug + "-touch-" + theme, error); throw error; }
      finally { await touchPage.close(); }
    }
  }
} finally { await browser.close(); }
