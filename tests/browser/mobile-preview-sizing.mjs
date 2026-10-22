import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.TEST_BASE || "http://127.0.0.1:4189";
const out = process.env.TEST_OUT || "test-results/mobile-preview-sizing";
const mobile = ["free", "pro"].flatMap(tier => fs.readdirSync(`registry/${tier}`, { withFileTypes: true }).filter(item => item.isDirectory() && fs.existsSync(`registry/${tier}/${item.name}/meta.json`)).map(item => JSON.parse(fs.readFileSync(`registry/${tier}/${item.name}/meta.json`))).filter(item => item.platform === "mobile").map(item => item.slug));
const slugs = process.env.MOBILE_SLUGS ? process.env.MOBILE_SLUGS.split(",") : mobile;
assert.ok(slugs.length && slugs.every(slug => mobile.includes(slug)));
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium({ args: [] });
const observations = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const slug of slugs) {
    await page.goto(`${base}/components/${slug}`, { waitUntil: "domcontentloaded" });
    const iframe = page.locator("#preview iframe");
    await iframe.waitFor();
    await page.frameLocator("#preview iframe").locator('[data-preview-ready="true"]').waitFor({ timeout: 45000 });
    const frame = await iframe.boundingBox();
    observations.push({ kind: "embedded", slug, viewport: 1440, frame });
    assert.ok(frame && Math.abs(frame.width - 390) < 1 && Math.abs(frame.height - 844) < 1, `${slug} must use a phone viewport`);
    assert.equal(await page.getByRole("radiogroup", { name: "Preview width" }).count(), 0);
    const device = await page.frameLocator("#preview iframe").locator('[data-preview-device="mobile"]').boundingBox();
    assert.ok(device && Math.abs(device.width - frame.width) < 1 && Math.abs(device.height - frame.height) < 1, `${slug} device must fit its iframe`);
  }
  for (const width of [820, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto(`${base}/components/mobile-budget-envelope`, { waitUntil: "domcontentloaded" });
    const iframe = page.locator("#preview iframe");
    await page.frameLocator("#preview iframe").locator('[data-preview-ready="true"]').waitFor({ timeout: 45000 });
    const frame = await iframe.boundingBox();
    const bounds = await iframe.evaluate(element => ({ available: element.parentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    observations.push({ kind: "responsive", width, frame, bounds });
    assert.ok(frame && Math.abs(frame.width - Math.min(390, bounds.available)) < 1 && Math.abs(frame.height - 844) < 1);
    assert.ok(bounds.scrollWidth <= width + 1, "the phone must not overflow the page");
    await iframe.screenshot({ path: `${out}/budget-${width}.png` });
  }
  for (const viewport of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${base}/preview/mobile-budget-envelope`, { waitUntil: "domcontentloaded" });
    const device = page.locator('[data-preview-device="mobile"]');
    await page.locator('[data-preview-ready="true"]').waitFor({ timeout: 45000 });
    const rect = await device.boundingBox();
    observations.push({ kind: "standalone", viewport, device: rect });
    assert.ok(rect && rect.width <= Math.min(390, viewport.width) + 1 && Math.abs(rect.height - Math.min(844, viewport.height)) < 1);
    await page.screenshot({ path: `${out}/standalone-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${base}/components/chart-portfolio`, { waitUntil: "domcontentloaded" });
  await page.frameLocator("#preview iframe").locator('[data-preview-ready="true"]').waitFor({ timeout: 45000 });
  for (const [label, expected] of [["Mobile", 390], ["Tablet", 820], ["Desktop", null]]) {
    await page.getByRole("radio", { name: label, exact: true }).click();
    await page.waitForTimeout(100);
    const rect = await page.locator("#preview iframe").boundingBox();
    observations.push({ kind: "web-control", label, frame: rect });
    assert.ok(rect && (expected === null ? rect.width > 820 : Math.abs(rect.width - expected) < 1));
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/proof.json`, JSON.stringify({ passed: true, slugs, observations, errors }, null, 2) + "\n");
  console.log(`Phone dimensions pass for ${slugs.length} mobile previews; narrow pages, standalone devices and all web width controls pass.`);
} catch (error) {
  fs.writeFileSync(`${out}/failure.json`, JSON.stringify({ passed: false, message: error.message, observations }, null, 2) + "\n");
  throw error;
} finally {
  await browser.close();
}
