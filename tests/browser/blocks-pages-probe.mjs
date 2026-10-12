import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { launchChromium } from "../../scripts/lib/browser.mjs";
const base = (process.env.PREVIEW_BASE || "http://localhost:3100").replace(
  /\/$/,
  "",
);
const catalogue = (await (await fetch(base + "/api/registry")).json())
  .components;
const blocks = catalogue.filter((entry) => entry.kind === "block");
assert.ok(blocks.length, "Published blocks");
const outcomes = [];
for (const block of blocks) {
  assert.equal(block.tier, "pro");
  assert.equal(block.url, `https://design.yaps.ai/blocks/${block.slug}`);
  assert.ok(block.components.length >= 2);
  const res = await fetch(`${base}/blocks/${block.slug}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('id="built-from"'));
  assert.ok(
    html.includes(`href="https://design.yaps.ai/blocks/${block.slug}"`),
  );
  const md = await (await fetch(`${base}/blocks/${block.slug}.md`)).text();
  assert.match(md, /## Built from/);
  assert.match(md, /## When to use/);
  assert.doesNotMatch(md, /## JSON prompt|export default function|useState\(/);
  for (const slug of block.components)
    assert.ok(md.includes(slug), block.slug + " dependency " + slug);
  assert.equal((await fetch(`${base}/api/registry/${block.slug}`)).status, 401);
  assert.equal((await fetch(`${base}/r/pro/${block.slug}.json`)).status, 401);
  assert.equal((await fetch(`${base}/r/${block.slug}.json`)).status, 404);
  assert.equal(
    (await (await fetch(`${base}/api/pro/source/${block.slug}`)).json()).locked,
    true,
  );
  outcomes.push({
    slug: block.slug,
    html: true,
    markdown: true,
    sourceLocked: true,
  });
  console.log("PASS block reference " + block.slug);
}
const xml = await (await fetch(base + "/sitemaps/en.xml")).text();
for (const block of blocks) assert.ok(xml.includes(`/blocks/${block.slug}`));
const markdown = await (await fetch(base + "/blocks.md")).text();
for (const block of blocks) assert.ok(markdown.includes(block.slug));
const browser = await launchChromium();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const pathname of ["/blocks", `/blocks/${blocks[0].slug}`]) {
    await page.goto(base + pathname, { waitUntil: "networkidle" });
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        (await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        )) <= 1,
        pathname + " " + width,
      );
    }
    await page.addScriptTag({
      path: createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
    });
    const issues = await page.evaluate(async () =>
      (
        await axe.run(document.body, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
          },
        })
      ).violations.map((v) => v.id),
    );
    assert.deepEqual(issues, [], pathname);
    if (pathname === "/blocks") {
      for (const block of blocks)
        assert.ok(
          await page.locator(`a[href="/blocks/${block.slug}"]`).count(),
        );
      await page.screenshot({
        path: "test-results/page-structure-20261012/blocks-index.png",
        fullPage: true,
      });
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
fs.writeFileSync(
  "test-results/page-structure-20261012/blocks-pages.json",
  JSON.stringify(outcomes, null, 2) + "\n",
);
console.log(
  "PASS blocks discovery, canonical pages, mobile layouts and private source boundaries",
);
