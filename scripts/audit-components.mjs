#!/usr/bin/env node
/** Browser quality gate. Run with a preview server: npm run audit:components -- --since=2026-10-10 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { launchChromium } from "./lib/browser.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ??
  fallback;
const base = option(
  "base",
  process.env.PREVIEW_BASE ?? "http://localhost:3100",
).replace(/\/$/, "");
const out = path.resolve(root, option("out", "test-results/quality"));
const since = option("since", "");
const requested = args.filter((a) => !a.startsWith("--"));
const workers = Math.max(1, Math.min(4, Number(option("workers", "2")) || 2));
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const entries = ["free", "pro"].flatMap((tier) => {
  const dir = path.join(root, "registry", tier);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith("_") && !name.startsWith("."))
    .flatMap((name) => {
      const file = path.join(dir, name, "meta.json");
      if (
        !fs.existsSync(file) ||
        !fs.existsSync(path.join(dir, name, `${name}.tsx`))
      )
        return [];
      const meta = JSON.parse(fs.readFileSync(file, "utf8"));
      return (!since || meta.added >= since) &&
        (!requested.length || requested.includes(meta.slug))
        ? [meta]
        : [];
    });
});
for (const slug of requested)
  if (!entries.some((m) => m.slug === slug))
    throw new Error(`No local component matched ${slug}`);
if (!entries.length) throw new Error("No components matched the selection.");
fs.mkdirSync(out, { recursive: true });

async function geometry(frame) {
  return frame.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    return {
      viewportWidth: innerWidth,
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
    };
  });
}
async function accessibility(frame) {
  if (!(await frame.evaluate(() => !!window.axe)))
    await frame.addScriptTag({ path: axePath });
  return frame.evaluate(async () => {
    const result = await window.axe.run(document.body, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        html: n.html,
        summary: n.failureSummary,
      })),
    }));
  });
}
async function stableAccessibility(frame) {
  const first = await accessibility(frame);
  if (!first.length) return { violations: [], transient: [] };
  // An entrance or streamed word can be halfway through a fade. Keep both observations as evidence.
  await frame.waitForTimeout(2400);
  return { violations: await accessibility(frame), transient: first };
}

async function screenshotTouch(page, frame, file) {
  // A body screenshot inside an 844px iframe clips everything below that frame.
  // Expand only for the capture, then restore the measured viewport for checks.
  const height = await frame.evaluate(() =>
    Math.max(
      844,
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    ),
  );
  await page.evaluate((height) => {
    document.querySelector("iframe").style.height = `${height}px`;
  }, height);
  await frame.waitForTimeout(100);
  await page.screenshot({ path: file, fullPage: true });
  await page.evaluate(() => {
    document.querySelector("iframe").style.height = "844px";
  });
}

const browser = await launchChromium();
let cursor = 0;
const results = [];
try {
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < entries.length) {
        const meta = entries[cursor++];
        const dir = path.join(out, meta.slug);
        fs.mkdirSync(dir, { recursive: true });
        const result = {
          slug: meta.slug,
          tier: meta.tier,
          platform: meta.platform,
          errors: [],
          viewports: [],
          themes: [],
          reducedMotion: [],
        };
        const page = await browser.newPage({
          viewport: { width: 1440, height: 900 },
        });
        page.on("pageerror", (error) => result.errors.push(error.message));
        try {
          const response = await page.goto(`${base}/preview/${meta.slug}`, {
            waitUntil: "networkidle",
            timeout: 120000,
          });
          if (!response?.ok())
            throw new Error(`Preview returned ${response?.status()}`);
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(2400);
          for (const width of meta.platform === "mobile"
            ? [360, 390, 430]
            : [320, 390, 768, 1024, 1440, 1920]) {
            await page.setViewportSize({ width, height: 900 });
            await page.waitForTimeout(350);
            const measurement = await geometry(page);
            result.viewports.push({ width, ...measurement });
            if (width === 1440)
              result.themes.push({
                theme: "default-desktop",
                ...measurement,
                ...(await stableAccessibility(page)),
              });
            await page.screenshot({
              path: path.join(dir, `${width}.png`),
              fullPage: meta.platform !== "mobile",
            });
          }
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.reload({ waitUntil: "networkidle" });
          await page.waitForTimeout(2000);
          result.reducedMotion = await page.evaluate(() =>
            document
              .getAnimations()
              .filter((a) => a.playState === "running")
              .map((a) => ({
                target: a.effect?.target?.outerHTML?.slice(0, 240),
                timing: a.effect?.getTiming(),
              })),
          );
        } catch (error) {
          result.errors.push(String(error));
        } finally {
          await page.close();
        }

        // Coarse-pointer layouts are distinct from simply shrinking a desktop browser.
        const touch = await browser.newPage({
          viewport: { width: 390, height: 844 },
          hasTouch: true,
          isMobile: true,
        });
        touch.on("pageerror", (error) => result.errors.push(error.message));
        try {
          await touch.goto(`${base}/robots.txt`);
          await touch.evaluate((slug) => {
            document.body.innerHTML = "";
            const viewport = document.createElement("meta");
            viewport.name = "viewport";
            viewport.content = "width=device-width, initial-scale=1";
            document.head.appendChild(viewport);
            document.body.style.margin = "0";
            const iframe = document.createElement("iframe");
            iframe.style = "width:100vw;height:844px;border:0";
            iframe.src = `/preview/${slug}`;
            document.body.appendChild(iframe);
          }, meta.slug);
          const frame = touch.frameLocator("iframe");
          await frame
            .locator(
              "body button, body section, body input, body svg, body canvas",
            )
            .first()
            .waitFor({ timeout: 30000 });
          const content = touch
            .frames()
            .find((f) => f.url().includes(`/preview/${meta.slug}`));
          if (!content) throw new Error("No preview frame");
          await content.evaluate(() => document.fonts.ready);
          await content.waitForTimeout(2400);
          for (const theme of meta.props.some((p) => p.name === "theme")
            ? ["dark", "light"]
            : ["default"]) {
            if (theme !== "default") {
              await touch.evaluate(
                (theme) =>
                  document.querySelector("iframe").contentWindow.postMessage(
                    {
                      channel: "dfa-preview",
                      type: "props",
                      props: { theme },
                      remount: true,
                    },
                    location.origin,
                  ),
                theme,
              );
              await content.waitForTimeout(2000);
            }
            const scan = await stableAccessibility(content);
            const measurement = await geometry(content);
            result.themes.push({ theme, ...measurement, ...scan });
            await screenshotTouch(touch, content, path.join(dir, `${theme}-touch.png`));
            await touch.setViewportSize({ width: 320, height: 844 });
            await content.waitForTimeout(350);
            result.viewports.push({
              width: 320,
              touch: true,
              theme,
              ...(await geometry(content)),
            });
            await screenshotTouch(touch, content, path.join(dir, `${theme}-touch-320.png`));
            await touch.setViewportSize({ width: 390, height: 844 });
          }
        } catch (error) {
          result.errors.push(String(error));
        } finally {
          await touch.close();
        }
        result.passed =
          !result.errors.length &&
          result.viewports.every(
            (v) =>
              v.viewportWidth === v.width &&
              v.overflow <= 1 &&
              !v.duplicateIds.length,
          ) &&
          result.themes.every(
            (t) =>
              !t.violations.length &&
              t.viewportWidth ===
                (t.theme === "default-desktop" ? 1440 : 390) &&
              t.overflow <= 1 &&
              !t.duplicateIds.length,
          ) &&
          !result.reducedMotion.length;
        fs.writeFileSync(
          path.join(dir, "audit.json"),
          JSON.stringify(result, null, 2) + "\n",
        );
        results.push(result);
        console.log(
          `${result.passed ? "PASS" : "FAIL"} ${meta.slug}: ${result.errors.length} runtime errors, ${result.themes.reduce((n, t) => n + t.violations.length, 0)} accessibility rules, ${result.reducedMotion.length} reduced-motion animations`,
        );
      }
    }),
  );
} finally {
  await browser.close();
}
results.sort((a, b) => a.slug.localeCompare(b.slug));
fs.writeFileSync(
  path.join(out, "audit.json"),
  JSON.stringify(results, null, 2) + "\n",
);
console.log(
  `${results.filter((r) => r.passed).length}/${results.length} passed. Review the screenshots in ${out}.`,
);
if (results.some((r) => !r.passed)) process.exitCode = 1;
