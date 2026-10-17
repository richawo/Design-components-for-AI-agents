import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";

const specs = {
  "scroll-image-curtain": "ScrollImageCurtain",
  "scroll-horizontal-showcase": "HorizontalScrollShowcase",
  "scroll-expanding-mosaic": "ExpandingScrollMosaic",
};
const requested = new Set(process.argv.slice(2));
for (const slug of requested) assert.ok(slug in specs, `Unknown scroll review case: ${slug}`);
const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(120000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const frameStyle = "margin:0;padding:0;max-width:none";
async function mount(slug, props = "") {
  await mountFixture(page, slug, "pro",
    `createRoot(document.getElementById('root')).render(<Subject.${specs[slug]} ${props}/>);`, { frameStyle });
  await page.locator("#root > section").waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function flowing() {
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#root > section").lastElementChild).position === "static");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}
async function contrastOverWhite(text, backing) {
  const ratio = await text.evaluate((element, backingSelector) => {
    const rgba = css => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.fillStyle = css;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const background = rgba(getComputedStyle(document.querySelector(backingSelector)).backgroundColor);
    const foreground = rgba(getComputedStyle(element).color);
    const alpha = (foreground[3] ?? 1) * Number(getComputedStyle(element).opacity);
    const plate = background.slice(0, 3).map(channel => channel * (background[3] ?? 1) + 255 * (1 - (background[3] ?? 1)));
    const ink = foreground.slice(0, 3).map((channel, i) => channel * alpha + plate[i] * (1 - alpha));
    const luminance = rgb => rgb.map(channel => channel / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    const a = luminance(ink), b = luminance(plate);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, backing);
  assert.ok(ratio >= 4.5, `Caption remains readable over a white host image (${ratio.toFixed(2)}:1)`);
}
try {
  for (const slug of Object.keys(specs)) {
    if ((requested.size && !requested.has(slug)) || !fs.existsSync(`registry/pro/${slug}`)) continue;
    errors.length = 0;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const meta = JSON.parse(fs.readFileSync(`registry/pro/${slug}/meta.json`));
    await mountFixture(page, slug, "pro", `import {DemoPlayer} from './lib/demo/player';import {parseSteps} from './lib/demo/schema.mjs';createRoot(document.getElementById('root')).render(<Subject.default/>);window.play=steps=>new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},new AbortController().signal).play(parseSteps(steps));`, { frameStyle });
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#root > section").lastElementChild).position === "sticky");
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(steps => window.play(steps), meta.demo.steps);
    assert.ok(await page.evaluate(() => scrollY > 0), `${slug} metadata moves the story`);
    if (slug === "scroll-image-curtain") {
      await page.getByRole("button", { name: "Return to cover ↑", exact: true }).waitFor();
      assert.equal(await page.locator("figure > figcaption").count(), 1);
      const credit = page.locator("figure > figcaption > div > span").last();
      await contrastOverWhite(credit, "figure > figcaption > div");
      await page.getByRole("button", { name: "Return to cover ↑", exact: true }).press("Enter");
      await page.waitForFunction(() => scrollY === 0);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await mount(slug, 'imageSrc="data:image/png;base64,invalid" imageAlt="Dune photograph unavailable"');
      await page.getByRole("img", { name: "Dune photograph unavailable", exact: true }).waitFor();
      await page.getByText("Dune photograph unavailable", { exact: true }).waitFor();
      await flowing();
    } else if (slug === "scroll-horizontal-showcase") {
      await page.waitForFunction(() => document.querySelector('[data-demo="project-2"]')?.getAttribute('aria-current') === 'step');
      await page.locator('[data-demo="project-0"]').press("Enter");
      await page.waitForFunction(() => scrollY === 0);
      await page.setViewportSize({ width: 768, height: 900 });
      await page.waitForFunction(() => {
        const words = document.querySelector('article > .grid');
        return words && getComputedStyle(words).gridTemplateColumns.split(' ').length === 1;
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await flowing();
      assert.equal(await page.locator("article").count(), 3);
      assert.equal(await page.locator('[data-demo="project-track"]').evaluate(el => getComputedStyle(el).transform), "none");
      await page.setViewportSize({ width: 1440, height: 480 });
      await mount(slug);
      await flowing();
      await mount(slug, `projects={[{id:'broken',title:'Sample project',client:'Sample',discipline:'Identity',year:'2026',description:'A project with a missing image.',imageSrc:'data:image/png;base64,invalid',imageAlt:'Project artwork unavailable'}]}`);
      await page.locator('div[role="img"][aria-label="Project artwork unavailable"]').getByText('Sample project',{exact:true}).waitFor();
      // Slow bitmap preparation must never replace the work with blank wells.
      await mountFixture(page, slug, "pro", `HTMLCanvasElement.prototype.toBlob=()=>{};createRoot(document.getElementById('root')).render(<Subject.HorizontalScrollShowcase/>);`, { frameStyle });
      assert.equal(await page.locator('figure img[src^="data:image/svg+xml"]').count(), 3);
      assert.equal(await page.locator('figure img').first().isVisible(), true);
      await mount(slug, "projects={[]}");
      await page.getByText("New work is on its way.", { exact: true }).waitFor();
      assert.equal(await page.locator("article").count(), 0);
    } else {
      const caption = page.locator("figure > figcaption");
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('figure > figcaption')).opacity) >= 0.999);
      await contrastOverWhite(caption.locator("span").first(), "figure > figcaption");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await mount(slug, `tiles={[{id:'broken',label:'Missing plate',src:'data:image/png;base64,invalid',alt:'Coastline artwork unavailable'}]}`);
      await page.locator('span[role="img"][aria-label="Coastline artwork unavailable"]').waitFor();
      await mount(slug, "tiles={[]}");
      await page.getByText("No photographs in this exhibition yet.", { exact: true }).waitFor();
      await flowing();
    }
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    if (slug !== "scroll-horizontal-showcase") {
      await mount(slug, `title={${JSON.stringify("A coastline worth looking at. ".repeat(30))}}`);
      await flowing();
      assert.equal(await page.locator("h2").count(), 1);
    }
    assert.deepEqual(errors, [], `${slug} runtime errors`);
    console.log(`PASS scroll replay, keyboard and fallbacks ${slug}`);
  }
} finally { await browser.close(); }
