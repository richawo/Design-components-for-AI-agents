import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.TEST_BASE ?? "http://127.0.0.1:3000";
const output = process.env.TEST_OUTPUT ?? "test-results/blog-editorial";
const trace = "/blog/react-agent-run-trace-ui";
const recorded = "/blog/react-saas-dashboard-components";
fs.mkdirSync(output, { recursive: true });
const browser = await launchChromium();
const errors = [];

async function visit(page, path) {
  const response = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 90_000 });
  assert.equal(response.status(), 200, path);
  await page.evaluate(() => document.fonts.ready);
}

async function noOverflow(page) {
  const overflowing = await page.locator(".blog-shell h1, .blog-prose :is(h2, h3), html").evaluateAll((elements) =>
    elements.filter((el) => el.scrollWidth > el.clientWidth + 2).map((el) => el.textContent.slice(0, 80))
  );
  assert.deepEqual(overflowing, []);
}

try {
  const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await visit(page, "/blog");
  await page.locator(".blog-card img").first().waitFor();
  assert.equal(await page.locator(".blog-lead").count(), 1);
  assert.equal(await page.locator(".blog-card").count(), 11);
  const next = page.getByRole("link", { name: "Next", exact: true });
  assert.equal(await next.getAttribute("href"), "/blog/page/2");
  await page.screenshot({ path: `${output}/archive.png` });
  await next.click();
  await page.waitForURL("**/blog/page/2");
  assert.equal(await page.locator(".blog-card").count(), 12);
  assert.equal(await page.locator(".blog-lead").count(), 0);

  await visit(page, trace);
  const figure = page.locator('[data-blog-example="trace"]');
  const timeline = figure.getByRole("slider");
  const at = (ms) => figure.locator(`[data-time="${ms}"]`).waitFor();
  const phase = (id) => figure.locator(`[data-span="${id}"]`).getAttribute("data-phase");
  await at(700);
  assert.match(await figure.innerText(), /850\s*ms/);
  await timeline.fill("275");
  await at(275);
  assert.equal(await phase("lookup"), "running");
  assert.equal(await phase("call"), "running");
  assert.equal(await phase("retry"), "pending");
  await timeline.press("End");
  await at(700);
  assert.equal(await phase("call"), "failed");
  assert.equal(await phase("retry"), "completed");
  await page.screenshot({ path: `${output}/trace.png` });
  await figure.getByRole("button", { name: "Replay timeline" }).click();
  const pause = figure.getByRole("button", { name: "Pause timeline" });
  await pause.waitFor();
  await page.waitForFunction(() => Number(document.querySelector("[data-time]").dataset.time) > 10);
  await pause.click();
  const paused = Number(await figure.locator("[data-time]").getAttribute("data-time"));
  assert(paused > 0 && paused < 700, "Playback advances along the shared clock");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await figure.getByRole("button", { name: /timeline/i }).count(), 0);
  await timeline.press("Home");
  await at(0);
  await timeline.press("End");
  await at(700);

  const code = page.locator(".blog-code").first();
  await code.getByRole("button", { name: "Copy code", exact: true }).click();
  await code.getByRole("button", { name: "Copied", exact: true }).waitFor();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(copied, await code.locator("pre code").textContent());
  assert.match(copied, /run\.duration === 700/);
  await code.screenshot({ path: `${output}/snippet.png` });

  await visit(page, "/blog/react-ai-answer-citations");
  const citation = page.locator('[data-blog-example="citations"]');
  await citation.getByRole("button", { name: "Sources 2" }).press("Enter");
  assert.equal(await citation.getByRole("status").innerText(), "Source unavailable");
  await citation.getByRole("button", { name: "Sources 1" }).click();
  assert.equal(await citation.locator("mark").innerText(), "after seven days");
  await visit(page, "/blog/react-ai-model-selector");
  const model = page.locator('[data-blog-example="model"]');
  assert.match(await model.getByRole("status").innerText(), /Image unsupported/);
  await model.getByRole("radio", { name: /Image/ }).check();
  assert.match(await model.getByRole("status").innerText(), /Image supported/);
  await visit(page, "/blog/react-ai-prompt-input-attachments");
  const attachment = page.locator('[data-blog-example="attachments"]');
  await attachment.getByRole("button", { name: "Upload", exact: true }).click();
  await attachment.getByRole("button", { name: "Remove", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-blog-example="attachments"] [role="status"]').textContent === "Removed");
  await new Promise((resolve) => setTimeout(resolve, 2400));
  assert.equal(await attachment.getByRole("status").innerText(), "Removed");
  await attachment.getByRole("button", { name: "Retry" }).click();
  await attachment.getByText("Ready", { exact: true }).waitFor();
  await visit(page, "/blog/react-ai-voice-interface");
  const voice = page.locator('[data-blog-example="voice"]');
  await voice.getByRole("button", { name: "Interrupt reply" }).click();
  assert.match(await voice.getByRole("status").innerText(), /We found…/);
  assert.doesNotMatch(await voice.getByRole("status").innerText(), /two records/);
  await voice.getByRole("button", { name: "Reset example" }).click();
  assert.match(await voice.getByRole("status").innerText(), /We found two records/);

  const videos = [];
  page.on("request", (request) => {
    if (/\/previews\/.*\.(mp4|webm)(\?|$)/.test(request.url())) videos.push(request.url());
  });
  await visit(page, recorded);
  const recording = page.locator('[data-blog-example="recording"]');
  await recording.scrollIntoViewIfNeeded();
  assert.equal(await page.locator(".blog-shell iframe, .blog-shell video").count(), 0);
  assert.equal(videos.length, 0);
  await recording.getByRole("button", { name: "Play recording" }).click();
  const video = recording.locator("video");
  await video.waitFor();
  await page.waitForFunction(() => document.querySelector(".blog-recording video")?.currentTime > .2);
  assert(videos.length > 0, "The recording decoded after Play");
  await page.locator("h1").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector(".blog-recording video")?.paused);

  await page.setViewportSize({ width: 375, height: 820 });
  await visit(page, trace);
  await noOverflow(page);
  const contents = page.locator(".blog-toc-mobile");
  await contents.locator("summary").click();
  const section = contents.getByRole("link", { name: /Read a trace/ });
  const hash = await section.getAttribute("href");
  await section.click();
  assert.equal(new URL(page.url()).hash, hash);
  assert(await page.locator(hash).isVisible());
  await page.evaluate(() => window.scrollTo(0, 0));
  await contents.locator("summary").click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${output}/phone.png` });
  await visit(page, "/ar" + trace);
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  await noOverflow(page);
  assert.equal(await page.locator(".blog-trace-board").evaluate((el) => getComputedStyle(el).direction), "ltr");
  assert.equal(await page.locator(".blog-trace-metrics").evaluate((el) => getComputedStyle(el).direction), "rtl");
  assert.notEqual(await figure.getByRole("slider").getAttribute("aria-label"), "Trace timeline");
  await page.screenshot({ path: `${output}/arabic-phone.png` });
  await visit(page, "/blog/container-queries-vs-media-queries");
  const table = page.locator(".blog-table").first();
  await table.scrollIntoViewIfNeeded();
  assert(await table.evaluate((el) => el.scrollWidth > el.clientWidth && el.tabIndex === 0), "A wide table scrolls on a phone");
  await noOverflow(page);

  const staticContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 820 } });
  const staticPage = await staticContext.newPage();
  await visit(staticPage, trace);
  assert.match(await staticPage.locator('[data-blog-example="trace"]').innerText(), /850\s*ms/);
  assert.equal(await staticPage.getByRole("slider").count(), 0);
  assert.equal(await staticPage.getByRole("link", { name: "Agent Run Trace", exact: true }).count(), 2);
  const markdown = await page.request.get(base + trace + ".md");
  assert.equal(markdown.status(), 200);
  assert.match(await markdown.text(), /run\.duration === 700/);
  assert.equal((await page.request.get(base + "/api/registry/agent-run-trace")).status(), 401);
  assert.deepEqual(errors, []);
  console.log("Blog editorial interactions, localised layout, on-demand video, and static reading passed.");
} finally {
  await browser.close();
}
