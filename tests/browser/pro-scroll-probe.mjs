import assert from "node:assert/strict";
import fs from "node:fs";
import { webkit } from "playwright-core";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const specs = [
  [
    "scroll-expanding-mosaic",
    "ExpandingScrollMosaic",
    "expanding-image",
    "clipPath",
  ],
  ["scroll-cinema-frame", "ScrollCinemaFrame", "film-frame", "width"],
  [
    "scroll-background-wipe",
    "ScrollBackgroundWipe",
    "second-scene",
    "clipPath",
  ],
  [
    "scroll-horizontal-showcase",
    "HorizontalScrollShowcase",
    "project-track",
    "transform",
  ],
  ["scroll-image-curtain", "ScrollImageCurtain", "reveal", "curtain"],
];
const browser =
  process.env.SCROLL_BROWSER === "webkit"
    ? await webkit.launch({ headless: true })
    : await launchChromium();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "no-preference",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const selected = new Set(process.argv.slice(2));
async function mount(slug, name, props = "") {
  await mountFixture(
    page,
    slug,
    "pro",
    `createRoot(document.getElementById('root')).render(<><Subject.${name} ${props}/><div style={{height:'100vh'}} tabIndex={0}>After the story</div></>);`,
    { frameStyle: "margin:0;padding:0;max-width:none" },
  );
  await page.locator("h2").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  // Start at the intended width. Changing the wrapper after mount can race
  // container-query geometry and the first scroll measurement.
  await page.waitForTimeout(700);
}
try {
  for (const [slug, name, target, property] of specs.filter(
    ([s]) =>
      fs.existsSync("registry/pro/" + s) && (!selected.size || selected.has(s)),
  )) {
    await mount(slug, name);
    const subject = page.locator('[data-demo="' + target + '"]');
    const measure = () =>
      property === "curtain"
        ? page
            .locator('section > div > div[aria-hidden="true"]')
            .first()
            .evaluate((el) => getComputedStyle(el).transform)
        : subject.evaluate((el, p) => getComputedStyle(el)[p], property);
    const initial = await measure();
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(350);
    await page.evaluate(() =>
      window.scrollTo({ top: 900, behavior: "instant" }),
    );
    await page.waitForTimeout(250);
    assert.notEqual(await measure(), initial, slug + " follows native scroll");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForFunction(() => window.scrollY === 0);
    // Springs settle on animation frames, which can arrive slowly on a busy runner.
    await page.waitForFunction(
      ({ target, property, initial }) => {
        const el = document.querySelector(
          property === "curtain"
            ? 'section > div > div[aria-hidden="true"]'
            : `[data-demo="${target}"]`,
        );
        return (
          el &&
          getComputedStyle(el)[
            property === "curtain" ? "transform" : property
          ] === initial
        );
      },
      { target, property, initial },
      { timeout: 10000 },
    );
    assert.equal(await measure(), initial, slug + " reverses precisely");
    if (slug === "scroll-image-curtain") {
      await page
        .getByRole("button", { name: "Reveal the image ↓", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Return to cover ↑", exact: true })
        .waitFor();
      await page.waitForTimeout(1000);
      const returnButton = page.getByRole("button", {
        name: "Return to cover ↑",
        exact: true,
      });
      await returnButton.hover();
      await page.waitForTimeout(250);
      assert.equal(
        await returnButton.evaluate(
          (el) => getComputedStyle(el).backgroundColor,
        ),
        "rgb(18, 18, 18)",
        "Curtain control retains opaque contrast over the image",
      );
      await page
        .getByRole("button", { name: "Return to cover ↑", exact: true })
        .click();
      await page.waitForFunction(() => window.scrollY === 0);
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => {
      const stage = document.querySelector("#root > section")?.lastElementChild;
      return stage && getComputedStyle(stage).position === "static";
    });
    assert.equal(
      await page
        .locator("section > div")
        .last()
        .evaluate((el) => getComputedStyle(el).position),
      "static",
    );
    assert.equal(await page.locator("h2").count(), 1);
    if (slug === "scroll-horizontal-showcase") {
      assert.equal(await page.locator("article").count(), 3);
      assert.equal(
        await subject.evaluate((el) => getComputedStyle(el).transform),
        "none",
      );
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    console.log("PASS " + slug);
  }
  if (
    fs.existsSync("registry/pro/scroll-chapter-stack") &&
    (!selected.size || selected.has("scroll-chapter-stack"))
  ) {
    await mount("scroll-chapter-stack", "ScrollChapterStack");
    await page
      .getByRole("button", { name: "02 / Exploration", exact: true })
      .click();
    await page.waitForTimeout(1000);
    assert.ok((await page.evaluate(() => window.scrollY)) > 500);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    assert.deepEqual(
      await page
        .locator("article")
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).position)),
      ["relative", "relative", "relative"],
    );
    await mount(
      "scroll-chapter-stack",
      "ScrollChapterStack",
      `chapters={[{id:'long',eyebrow:'01',title:'A longer chapter',body:'Meaningful long-form content. '.repeat(120),imageAlt:'Study'}]}`,
    );
    assert.equal(
      await page
        .locator("article")
        .evaluate((el) => getComputedStyle(el).position),
      "relative",
    );
    console.log("PASS scroll-chapter-stack");
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  if (
    fs.existsSync("registry/pro/scroll-cinema-frame") &&
    (!selected.size || selected.has("scroll-cinema-frame"))
  ) {
    await page.route("**/__fixtures__/scroll-cinema.webm", route => route.fulfill({
      contentType: "video/webm", body: fs.readFileSync(new URL("./fixtures/scroll-cinema.webm", import.meta.url)),
    }));
    await mount(
      "scroll-cinema-frame",
      "ScrollCinemaFrame",
      'videoSrc="/__fixtures__/scroll-cinema.webm" captionSrc="data:text/vtt,WEBVTT"',
    );
    const video = page.locator("video");
    assert.equal(
      await video.evaluate((v) => v.controls && !v.autoplay && v.paused),
      true,
    );
    assert.equal(await video.locator('track[kind="captions"]').count(), 1);
    await video.evaluate((v) => v.play());
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
    );
    await page.waitForTimeout(300);
    assert.equal(await video.evaluate((v) => v.paused), true);
    assert.equal(await video.evaluate((v) => v.ended), false, "Leaving view pauses playback before the fixture ends");
    await page.route("**/broken-film.mp4", (route) =>
      route.fulfill({ status: 404, body: "" }),
    );
    await mount(
      "scroll-cinema-frame",
      "ScrollCinemaFrame",
      'videoSrc="/broken-film.mp4"',
    );
    await page
      .getByText("This film could not be loaded.", { exact: true })
      .waitFor();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
