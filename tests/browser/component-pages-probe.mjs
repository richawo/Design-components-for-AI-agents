import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { launchChromium } from "../../scripts/lib/browser.mjs";
const base = (process.env.PREVIEW_BASE || "http://localhost:3100").replace(
  /\/$/,
  "",
);
const out = "test-results/page-structure-20261012";
fs.mkdirSync(out, { recursive: true });
const slugs = [
  "saas-audit-trail",
  "chart-portfolio",
  "data-kanban-compact",
  "auth-sign-in",
  "mobile-settings",
];
const browser = await launchChromium();
const axe = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const errors = [];
const results = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  for (const slug of slugs) {
    const res = await fetch(`${base}/components/${slug}`);
    assert.equal(res.status, 200);
    const html = await res.text();
    for (const id of [
      "when-to-use",
      "when-not-to-use",
      "installation",
      "usage",
      "integration",
      "api",
      "source",
      "ai-reference",
      "related",
    ])
      assert.ok(html.includes(`id="${id}"`), slug + ": " + id);
    const md = await (await fetch(`${base}/components/${slug}.md`)).text();
    assert.match(md, /## When to use/);
    assert.match(md, /## When not to use/);
    assert.match(md, /## Integration notes/);
    if (slug === "saas-audit-trail" || slug === "data-kanban-compact")
      assert.doesNotMatch(md, /## JSON prompt|export default function/);
    await page.goto(`${base}/components/${slug}`, { waitUntil: "networkidle" });
    await page.locator("#installation").scrollIntoViewIfNeeded();
    if (slug === "saas-audit-trail" || slug === "data-kanban-compact")
      await page.locator('[data-pro-access="locked"]').waitFor();
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(200);
      assert.ok(
        (await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        )) <= 1,
        slug + " " + width,
      );
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `${out}/${slug}-${width}.png`,
          fullPage: true,
        });
    }
    await page.addScriptTag({ path: axe });
    const violations = await page.evaluate(async () =>
      (
        await axe.run(document.body, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
          },
        })
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    );
    assert.deepEqual(violations, [], slug);
    results.push({
      slug,
      htmlGuidance: true,
      markdownGuidance: true,
      overflow: false,
      violations,
    });
    console.log("PASS component page " + slug);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const route = "**/api/pro/source/saas-audit-trail";
  await page.route(route, (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "licensed fixture",
        codeHtml: "<pre>licensed fixture</pre>",
        prompt: "fixture",
        promptJson: "{}",
        promptJsonHtml: "<pre>{}</pre>",
      }),
    }),
  );
  await page.goto(`${base}/components/saas-audit-trail`, {
    waitUntil: "networkidle",
  });
  await page.locator('[data-pro-access="active"]').waitFor();
  assert.equal(
    await page
      .locator("#installation")
      .getByRole("link", { name: "Get Pro access" })
      .count(),
    0,
  );
  await page.unroute(route);
  await page.route(route, (r) => r.fulfill({ status: 503 }));
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-pro-access="error"]').waitFor();
  await page.unroute(route);
  await page.route(route, (r) =>
    r.fulfill({ contentType: "application/json", body: '{"locked":true}' }),
  );
  await page.getByRole("button", { name: "Retry access check" }).click();
  await page.locator('[data-pro-access="locked"]').waitFor();
  await page
    .locator("#installation")
    .getByRole("link", { name: "Get Pro access" })
    .focus();
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("href")),
    "/pricing",
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    `${out}/component-pages.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
  console.log("PASS Pro active, denied, failed and retried access states");
} finally {
  await browser.close();
}
