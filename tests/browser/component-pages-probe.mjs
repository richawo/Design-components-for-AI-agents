import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { launchChromium } from "../../scripts/lib/browser.mjs";
const base = (process.env.PREVIEW_BASE || "http://localhost:3100").replace(
  /\/$/,
  "",
);
const out =
  process.env.DFA_PAGE_PROBE_OUT || "test-results/page-structure-20261012";
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
// Readiness belongs to the tested interface. A background request can outlive the page.
async function openComponentPage(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator("#installation").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.fonts.status === "loaded");
}

async function checkReadinessWithBackgroundRequest(page) {
  const releases = [];
  let requests = 0;
  await page.route("http://component-ready.test/page", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><title>Readiness fixture</title></head><body><main id="installation">Ready installation</main><script>fetch("http://component-ready.test/background").catch(()=>{});</script></body></html>',
    }),
  );
  await page.route("http://component-ready.test/background", async (route) => {
    requests++;
    await new Promise((resolve) => releases.push(resolve));
    await route.fulfill({ body: "ok" }).catch(() => {});
  });
  page.setDefaultNavigationTimeout(2000);
  try {
    await assert.rejects(
      page.goto("http://component-ready.test/page", {
        waitUntil: "networkidle",
        timeout: 1500,
      }),
      /Timeout/,
    );
    assert.ok(requests > 0, "The negative keeps a real request pending");
    const issued = page.waitForRequest(
      "http://component-ready.test/background",
      { timeout: 2000 },
    );
    await Promise.all([
      issued,
      openComponentPage(page, "http://component-ready.test/page"),
    ]);
    assert.equal(
      await page.locator("#installation").innerText(),
      "Ready installation",
    );
  } finally {
    for (const release of releases) release();
    await page.unroute("http://component-ready.test/page");
    await page.unroute("http://component-ready.test/background");
    page.setDefaultNavigationTimeout(30000);
  }
  console.log(
    "PASS component-page readiness with a pending background request",
  );
}

const errors = [];
const results = [];
let page;
try {
  page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await checkReadinessWithBackgroundRequest(page);
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
      assert.ok(
        !/^## (?:Prompt|JSON prompt|Source \([^\n]+\))\s*$/m.test(md),
        "Anonymous references exclude private source and prompt sections",
      );
    await openComponentPage(page, `${base}/components/${slug}`);
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
  const route = "**/api/license/me";
  await page.route(route, (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ active: true }),
    }),
  );
  let sourceRequests = 0;
  const sourceRoute = "**/api/pro/source/saas-audit-trail";
  await page.route(sourceRoute, (route) => {
    sourceRequests++;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "licensed fixture",
        codeHtml: "<pre>licensed fixture</pre>",
        prompt: "fixture",
        promptJson: "{}",
        promptJsonHtml: "<pre>{}</pre>",
      }),
    });
  });
  await openComponentPage(page, `${base}/components/saas-audit-trail`);
  await page.locator('[data-pro-access="active"]').waitFor();
  assert.equal(sourceRequests, 0, "Checking access must not download source");
  await page.locator("#source").scrollIntoViewIfNeeded();
  await page.getByText("licensed fixture", { exact: true }).waitFor();
  assert.equal(sourceRequests, 1, "Source loads when its panel is reached");
  assert.equal(
    await page
      .locator("#installation")
      .getByRole("link", { name: "Get Pro access" })
      .count(),
    0,
  );
  await page.unroute(route);
  await page.route(route, (r) => r.fulfill({ status: 503 }));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-pro-access="error"]').waitFor();
  await page.unroute(route);
  await page.route(route, (r) =>
    r.fulfill({ contentType: "application/json", body: '{"active":false}' }),
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
} catch (error) {
  if (page)
    await page
      .screenshot({ path: `${out}/failed.png`, fullPage: true })
      .catch(() => {});
  fs.writeFileSync(
    `${out}/failed.json`,
    JSON.stringify(
      {
        message: error.message,
        stack: error.stack,
        url: page?.url(),
        errors,
        results,
      },
      null,
      2,
    ) + "\n",
  );
  throw error;
} finally {
  await browser.close();
}
