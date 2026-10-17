/** Wait for the requested component, including deferred source loading, before timing its entrance. */
export async function waitForPreview(page, slug) {
  await page.locator(`[data-preview-slug=${JSON.stringify(slug)}][data-preview-ready="true"]`)
    .waitFor({ state: "attached", timeout: 45000 });
  await page.evaluate(() => document.fonts.ready);
}
