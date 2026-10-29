#!/usr/bin/env node
// Records each component's demo script (meta.demo) into the gallery card's
// preview video: public/previews/<slug>.mp4 (H.264, yuv420p, 1280×800, muted,
// faststart, 60fps). Framed exactly like the WebP poster from scripts/screenshot.mjs,
// so the video fades in over the poster without a jump.
//
//   node scripts/record-demos.mjs [slug...] [--base=http://localhost:3100]
//        [--out=public/previews] [--webm] [--sheet=dir] [--max-kb=600] [--frame-viewport]
//        [--frame-union=CSS] [--frame-padding=32] fixes one DOM union crop for a web demo
//        [--web-scale=1|2|3] captures small web specimens at higher pixel resolution
//        [--web-width=720] [--web-height=560] choose a verified equivalent web scene
//        [--isolated-source] bundles the exact checked-out demo with production React
//        [--tab-capture] records that owned fixture directly, with source-stall guards
//        [--page-frames] requests actual page images when tab capture omits a tween
//        [--extend-stage-edges] extends verified empty stage edges into crop padding
//        [--report=dir] retains metrics and rejected encoded/source inputs before cleanup
//        [--visual-style=crayon] [--theme=light|dark] records the licensed style with DESIGN_FOR_AI_LICENSE
//        [--steps-file=path.json] uses a reviewed input script for one named specimen
//
// With no slugs it records every component with a demo or reviewed style recipe. Drives the
// preview with real input (so CSS :hover shows) and draws the same branded
// cursor as the live player. Writes a poster from the first frame only when
// the component has no WebP yet.
//
// Exits non-zero if a target is missing, the page throws or logs an error,
// or the video can't get under --max-kb. Record one take at a time on an idle
// machine. Each run uses its own temp dir and replaces <slug>.mp4 atomically.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { materialCss } from "./lib/component-styles.mjs";
import { captureQuality, gallerySteps, concatFrameList, framedCropFilter, fitViewportFrame } from "./lib/recording-quality.mjs";
import { launchChromium } from "./lib/browser.mjs";
import { mountFixture } from "./lib/component-fixture.mjs";
import { startTabRecording, stopTabRecording, sourceChangeQuality } from "./lib/tab-recording.mjs";
import { startPageFrameRecording, stopPageFrameRecording, discardPageFrameRecording } from "./lib/page-frame-recording.mjs";
import { startChangedSourceScreenshots } from "./lib/source-screenshots.mjs";
import { preserveRejectedCapture } from "./lib/rejected-capture.mjs";
import { createRecordTargetResolver } from "./lib/record-target.mjs";
import { waitForPreview } from "./lib/preview-ready.mjs";
import { CURSOR_CSS, CURSOR_HTML, CURSOR_START } from "../lib/demo/cursor.mjs";
import { TIMING, demoDuration, parseSteps, targetSelector } from "../lib/demo/schema.mjs";
import { loadStylePack, styleSourcePin } from "./lib/style-source.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};
const base = flag("base", process.env.PREVIEW_BASE || "http://localhost:3100");
const visualStyle = flag("visual-style", "original");
const styled = visualStyle !== "original";
const styleTheme = flag("theme", "light");
if (!["light", "dark"].includes(styleTheme) || !styled && styleTheme !== "light") throw new Error("--theme supports light or dark for licensed styles");
const catalogue = styled ? JSON.parse(fs.readFileSync(path.join(root, "registry/__generated__/index.json"), "utf8")) : [];
if (styled && !catalogue.some(entry => entry.visualStyles?.includes(visualStyle))) throw new Error("Unknown visual style");
const license = styled ? process.env.DESIGN_FOR_AI_LICENSE : null;
if (styled && !license) throw new Error("Set DESIGN_FOR_AI_LICENSE to record licensed style previews. The key is scoped to the selected base URL.");
const stylePin=styled?styleSourcePin(root):null,stylePack=styled?loadStylePack(root):null;
const previewVersion=stylePin?.previewVersion??2;
const styleSuffix=previewVersion>=3?`/v${previewVersion}/${styleTheme}`:styleTheme==="dark"?"/dark":"";
const out = path.resolve(root, flag("out", styled ? `public/style-previews/${visualStyle}${styleSuffix}` : "public/previews"));
const sheetDir = flag("sheet", "");
const reportDir = flag("report", "");
const gallery = !args.includes("--original-timing");
const scenePlans = styled && gallery ? JSON.parse(fs.readFileSync(path.join(root, "scripts/recording-recipes.json"), "utf8"))[visualStyle] ?? {} : {};
const skipLeadScroll = args.includes("--skip-lead-scroll");
const refreshPoster = args.includes("--refresh-poster");
// Also usable as a temporal quality probe for the page that presents the clips.
const pagePath = flag("page-path", "");
const isolatedSource = args.includes("--isolated-source");
if (isolatedSource && pagePath) throw new Error("--isolated-source records a component demo; omit --page-path");
if (styled && (isolatedSource || pagePath)) throw new Error("Licensed styles must record their authorized live preview; omit --isolated-source and --page-path");
const tabCapture = args.includes("--tab-capture");
const pageFrames = args.includes("--page-frames");
if (tabCapture && pageFrames) throw new Error("Choose --tab-capture or --page-frames, not both");
const captureTitle = `Design for AI owned fixture ${Date.now()}`;
if ((tabCapture || pageFrames) && (!isolatedSource || args.includes("--software-rendering"))) throw new Error("Direct capture requires an isolated source fixture and native rendering");
const ambientMs = Number(flag("ambient-ms", "0"));
if (ambientMs && (ambientMs < 3000 || ambientMs > 6000)) throw new Error("--ambient-ms must be between 3000 and 6000");
const timings = gallery ? { ...TIMING, glide: 450, tabGap: 220, keyGap: 150, typeGap: 45 } : TIMING;
const webm = args.includes("--webm");
// Expanding demos need room beyond the initial card bounds. Refresh the poster
// with this framing too, so hovering never changes the component scale.
const frameViewport = args.includes("--frame-viewport");
const extendStageEdges = args.includes("--extend-stage-edges");
const frameUnionSelector = flag("frame-union", undefined);
const frameUnionPadding = Number(flag("frame-padding", "32"));
if (args.includes("--frame-union")) throw new Error("--frame-union needs a CSS selector after =");
if (frameUnionSelector !== undefined && !frameUnionSelector.trim()) throw new Error("--frame-union needs a non-empty CSS selector");
if (!Number.isInteger(frameUnionPadding) || frameUnionPadding < 0 || frameUnionPadding > 160) throw new Error("--frame-padding must be an integer from 0 to 160");
const webScaleFlag = flag("web-scale", undefined);
const webScale = Number(webScaleFlag ?? "1");
if (args.includes("--web-scale")) throw new Error("--web-scale needs 1, 2 or 3 after =");
if (![1, 2, 3].includes(webScale)) throw new Error("--web-scale must be 1, 2 or 3");
const webWidthFlag = flag("web-width", undefined);
const webHeightFlag = flag("web-height", undefined);
for (const [name, value, min, max] of [["web-width", webWidthFlag, 320, 1920], ["web-height", webHeightFlag, 360, 1600]]) {
  if (args.includes(`--${name}`)) throw new Error(`--${name} needs an integer after =`);
  if (value !== undefined && (!Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max)) throw new Error(`--${name} must be an integer from ${min} to ${max}`);
}
const maxBytes = Number(flag("max-kb", "600")) * 1024;
const only = args.filter((a) => !a.startsWith("--"));
const stepsFile = flag("steps-file", "");
if (stepsFile && (only.length !== 1 || ambientMs)) throw new Error("--steps-file requires one named specimen and cannot be combined with --ambient-ms");
const inputSteps = stepsFile ? JSON.parse(fs.readFileSync(path.resolve(root, stepsFile), "utf8")) : null;
if (inputSteps && !Array.isArray(inputSteps)) throw new Error("--steps-file must contain a JSON array of demo steps");

const OUT_W = 1280;
const OUT_H = 800;
const captureJpegQuality = Number(flag("capture-quality", pageFrames ? "75" : "92"));
if (!Number.isInteger(captureJpegQuality) || captureJpegQuality < 75 || captureJpegQuality > 95) throw new Error("--capture-quality must be 75–95");
const FPS = Number(flag("fps", "60"));
if (![30, 60].includes(FPS)) throw new Error("--fps must be 30 or 60");

// Read metas from source (not the generated index) so a component being
// built right now can be recorded before anyone rebuilds the registry.
function readMeta(slug) {
  for (const tier of ["free", "pro"]) {
    const p = path.join(root, "registry", tier, slug, "meta.json");
    if (fs.existsSync(p)) {
      if (args.includes("--published-meta")) {
        const repository = tier === "pro" ? path.join(root, "registry/pro") : root;
        const file = tier === "pro" ? `${slug}/meta.json` : `registry/free/${slug}/meta.json`;
        return JSON.parse(execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8" }));
      }
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  }
  return null;
}
function allSlugsWithDemo() {
  const slugs = [];
  for (const tier of ["free", "pro"]) {
    const dir = path.join(root, "registry", tier);
    if (!fs.existsSync(dir)) continue;
    for (const d of fs.readdirSync(dir)) {
      const m = fs.existsSync(path.join(dir, d, "meta.json")) ? JSON.parse(fs.readFileSync(path.join(dir, d, "meta.json"), "utf8")) : null;
      if (m && (m.demo || scenePlans[d]?.steps || scenePlans[d]?.ambientMs) && m.status !== "draft") slugs.push(d);
    }
  }
  return slugs.sort();
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Same framing rules as scripts/screenshot.mjs, expressed as a crop of the viewport. */
async function framing(png, vw, vh) {
  const t = await sharp(png).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
  const { width: tw, height: th, trimOffsetLeft = 0, trimOffsetTop = 0 } = t.info;
  const bgPx = await sharp(png).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer();
  const bg = `0x${[...bgPx.subarray(0, 3)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  if (tw < 1300 || th < 820) {
    // The poster fits the trimmed box into 1120×680, centred on 1280×800, so
    // the video shows the region of the viewport that lands on the same pixels.
    const s = Math.min(1120 / tw, 680 / th);
    return { cw: OUT_W / s, ch: OUT_H / s, cx: -trimOffsetLeft + tw / 2 - OUT_W / s / 2, cy: -trimOffsetTop + th / 2 - OUT_H / s / 2, bg };
  }
  return { cw: vw, ch: vh, cx: 0, cy: 0, bg };
}

/** One initial union, including reserved future-state regions, stays fixed for every frame. */
async function fixedUnionFrame(page, selector, padding, bg) {
  const bounds = await page.evaluate((selector) => {
    let matches;
    try { matches = [...document.querySelectorAll(selector)]; }
    catch { throw new Error(`Invalid CSS selector for --frame-union: ${selector}`); }
    const rectangles = matches.map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0 && [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite));
    if (!rectangles.length) throw new Error(`--frame-union has no rendered matches: ${selector}`);
    if (rectangles.some(rect => rect.left < -.5 || rect.top < -.5 || rect.right > innerWidth + .5 || rect.bottom > innerHeight + .5)) throw new Error("--frame-union includes content outside the recording viewport; choose a fully visible union");
    return { left: Math.min(...rectangles.map(rect => rect.left)), top: Math.min(...rectangles.map(rect => rect.top)), right: Math.max(...rectangles.map(rect => rect.right)), bottom: Math.max(...rectangles.map(rect => rect.bottom)), count: rectangles.length };
  }, selector);
  const width = bounds.right - bounds.left + padding * 2;
  const height = bounds.bottom - bounds.top + padding * 2;
  // Multiples of16 keep the16:10 crop exact and both YUV420 dimensions even.
  const cw = Math.ceil(Math.max(width, height * OUT_W / OUT_H) / 16) * 16;
  const ch = cw * OUT_H / OUT_W;
  return { cw, ch, cx: (bounds.left + bounds.right - cw) / 2, cy: (bounds.top + bounds.bottom - ch) / 2, bg, selector, padding, union: bounds };
}

/** Mobile posters are the phone at 700px tall with 44px corners on #050505; this is the mask that frames the video the same way. */
async function phoneMask(file, vw, vh) {
  const h = 700;
  const w = Math.round((vw / vh) * h);
  const x = Math.round((OUT_W - w) / 2);
  const y = Math.round((OUT_H - h) / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}"><defs><mask id="m"><rect width="100%" height="100%" fill="#fff"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="44" fill="#000"/></mask></defs><rect width="100%" height="100%" fill="#050505" mask="url(#m)"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
  return { w, h };
}

async function record(browser, slug) {
  const meta = readMeta(slug);
  const plan = scenePlans[slug] ?? {};
  const fullViewport = frameViewport || plan.frameViewport === true;
  const sceneAmbientMs = ambientMs || (!inputSteps ? plan.ambientMs ?? 0 : 0);
  const sceneSteps = inputSteps ?? plan.steps ?? meta?.demo?.steps;
  if (!meta || (!sceneSteps && !sceneAmbientMs)) throw new Error("no demo in meta.json; supply --steps-file or use --ambient-ms for an ambient component");
  if (styled && !catalogue.some(entry => entry.slug === slug && entry.visualStyles?.includes(visualStyle))) throw new Error("Component does not support the selected visual style");
  const parsed = parseSteps(sceneAmbientMs ? [`wait:${sceneAmbientMs}`] : sceneSteps);
  const steps = gallery ? gallerySteps(parsed) : parsed;
  const setupScroll = skipLeadScroll && steps[0]?.cmd === "scroll" ? steps.shift().px : 0;
  const mobile = meta.platform === "mobile";
  if (mobile && extendStageEdges) throw new Error("--extend-stage-edges is for web stages; mobile keeps its complete phone mask");
  if (mobile && frameUnionSelector !== undefined) throw new Error("--frame-union is for web demos; mobile keeps its complete phone mask");
  if (mobile && webScaleFlag !== undefined) throw new Error("--web-scale is for web demos; mobile keeps its complete 2x phone mask");
  const strip = meta.category === "headers" || meta.category === "footers";
  if (mobile && (webWidthFlag !== undefined || webHeightFlag !== undefined)) throw new Error("--web-width/height are for web demos; mobile keeps its complete phone geometry");
  const vw = mobile ? 390 : webWidthFlag !== undefined ? Number(webWidthFlag) : plan.viewport?.width ?? (strip ? 1024 : 1440);
  // Expanded workspace recordings honour the validated preview height.
  const vh = mobile ? 844 : webHeightFlag !== undefined ? Number(webHeightFlag) : plan.viewport?.height ?? (fullViewport ? Math.max(900, Math.min(1600, Number(meta.previewHeight) || 900)) : (strip ? 640 : 900));
  const dpr = mobile ? 2 : webScale;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `dfa-rec-${slug}-`));
  const problems = [];
  let materialEvidence;
  let sourceScreenshots;

  const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, reducedMotion: "no-preference" });
  if (license) await context.addCookies([{ name: "dfa_license", value: license, url: base, httpOnly: true, sameSite: "Lax", secure: new URL(base).protocol === "https:" }]);
  const page = await context.newPage();
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`console error: ${m.text()}`));
  try {
    if (isolatedSource) {
      // Keep dev React and hot reload out of motion measurements. Bundle the
      // checked-out demo with production React, retaining the preview's CSS
      // and same-origin fonts. The demo owns its actual frame dimensions.
      const previousBase = process.env.PREVIEW_BASE;
      try {
        process.env.PREVIEW_BASE = base;
        await mountFixture(page, slug, meta.tier, 'const root = createRoot(document.getElementById("root")); root.render(<Subject.default />);', {
          frameStyle: mobile ? "display:flex;flex-direction:column;width:390px;height:844px;margin:auto" : "width:100%;min-height:100vh",
        });
      } finally {
        if (previousBase === undefined) delete process.env.PREVIEW_BASE;
        else process.env.PREVIEW_BASE = previousBase;
      }
    } else {
      const response = await page.goto(`${base}${pagePath || `/preview/${slug}${styled ? `?visualStyle=${visualStyle}&theme=${styleTheme}` : ""}`}`, { waitUntil: "load", timeout: 120000 });
      if (!response?.ok()) throw new Error(`Preview returned HTTP ${response?.status()}`);
      if (!pagePath) await waitForPreview(page, slug);
      if (styled) {
        await page.locator("[data-licensed-visual-style]").waitFor({ state: "attached", timeout: 15000 });
        await page.waitForFunction(({style,theme})=>[...document.querySelectorAll("[data-dfa-style]")].some(node=>node.getAttribute("data-dfa-style")===style&&node.getAttribute("data-dfa-theme")===theme),{style:visualStyle,theme:styleTheme},{timeout:15000});
        const expected=stylePack?.themes?.[styleTheme]?.page??stylePack?.palette?.page;
        const actual=await page.locator('[data-dfa-style="crayon"]').first().evaluate(node=>getComputedStyle(node).getPropertyValue("--dfa-crayon-page").trim().toLowerCase());
        if(expected&&actual!==expected.toLowerCase())throw new Error(`Preview palette ${actual} differs from the pinned ${styleTheme} palette ${expected}; keep the last good recording.`);
        let compiledCssSha256,runtimeSha256;
        const sourceFile=path.join(root,"registry",meta.tier,slug,slug+".tsx");
        if(stylePack&&fs.existsSync(sourceFile)){
          const css=await page.locator("[data-licensed-visual-style]").textContent();
          const localFont=new URL(new URL(stylePack.font.url).pathname,base).href;
          const normalized=(css??"").replaceAll(localFont,stylePack.font.url);
          const expectedCss=materialCss(fs.readFileSync(sourceFile,"utf8"),stylePack);
          const sha=value=>createHash("sha256").update(value).digest("hex");
          compiledCssSha256=sha(expectedCss);
          if(sha(normalized)!==compiledCssSha256)throw new Error("Preview CSS differs from the checked-out style compiler and pinned material; keep the last good recording.");
          if(stylePack.webModule){
            runtimeSha256=sha(stylePack.webModule);
            await page.locator('[data-dfa-ink-ready="true"]').first().waitFor({state:"attached",timeout:15000});
            const loaded=await page.locator('[data-dfa-runtime]').first().getAttribute('data-dfa-runtime');
            const moduleUrl=new URL('/api/styles/'+encodeURIComponent(slug)+'?format=module&v='+runtimeSha256,base).href;
            const response=await page.request.get(moduleUrl);
            if(loaded!==runtimeSha256||response.status()!==200||sha(await response.text())!==runtimeSha256)throw new Error("Preview drawing runtime differs from the pinned compiler material; keep the last good recording.");
          }
        }
        materialEvidence={commit:stylePin?.commit,theme:styleTheme,page:actual,...(compiledCssSha256?{compiledCssSha256,sourceCssVerified:true}:{}),...(runtimeSha256?{runtimeSha256,sourceRuntimeVerified:true}:{})};
      }
    }
    await page.waitForTimeout(meta.category === "three-d" || meta.dependencies?.includes("three") ? 6000 : 3200);

    // The branded cursor, following the real mouse.
    await page.addStyleTag({ content: CURSOR_CSS });
    await page.evaluate(
      ({ html, start }) => {
        const c = document.createElement("div");
        c.className = "dfa-cursor";
        c.innerHTML = html;
        c.setAttribute("aria-hidden", "true");
        document.body.appendChild(c);
        const ring = c.firstElementChild;
        const place = (x, y) => (c.style.transform = `translate3d(${x}px, ${y}px, 0)`);
        place(innerWidth * start[0], innerHeight * start[1]);
        addEventListener("pointermove", (e) => place(e.clientX, e.clientY), true);
        addEventListener("pointerdown", () => {
          c.dataset.down = "1";
          ring.dataset.pulse = "0";
          void ring.offsetWidth;
          ring.dataset.pulse = "1";
        }, true);
        addEventListener("pointerup", () => (c.dataset.down = "0"), true);
        window.__dfaCursor = c;
      },
      { html: CURSOR_HTML, start: sceneAmbientMs ? [0, 0] : CURSOR_START },
    );
    let px = sceneAmbientMs ? 0 : vw * CURSOR_START[0];
    let py = sceneAmbientMs ? 0 : vh * CURSOR_START[1];
    await page.mouse.move(px, py);

    if (setupScroll) {
      await page.mouse.wheel(0, setupScroll);
      await page.waitForTimeout(700);
    }
    // Start near the first target instead of spending the opening on travel.
    let firstTarget = null;
    if (gallery && steps[0]?.target) {
      firstTarget = await page.locator(targetSelector(steps[0].target.name)).first().boundingBox();
      if (firstTarget && firstTarget.y >= 0 && firstTarget.y + firstTarget.height <= vh) {
        const [fx, fy] = steps[0].target.at ?? [.5, .5];
        px = firstTarget.x + firstTarget.width * fx;
        py = firstTarget.y + firstTarget.height * fy;
        await page.mouse.move(px, py);
      }
    }
    // Poster framing from the frame we're about to start on.
    const first = await page.screenshot({ type: "png" });
    const framingImage = !mobile && dpr > 1 ? await sharp(first).resize(vw, vh).png().toBuffer() : first;
    const initialFrame = mobile ? null : await framing(framingImage, vw, vh);
    const frame = frameUnionSelector !== undefined
      ? await fixedUnionFrame(page, frameUnionSelector, frameUnionPadding, initialFrame.bg)
      : initialFrame && fullViewport ? fitViewportFrame(vw, vh, initialFrame.bg, OUT_W, OUT_H) : initialFrame;

    // Frames: Chrome's screencast, with timestamps, at full quality.
    const cdp = tabCapture || pageFrames ? null : await context.newCDPSession(page);
    let frames = [];
    const writes = [];
    let frameIndex = 0;
    let resolveOpeningFrame;
    const openingFrame = new Promise((resolve) => { resolveOpeningFrame = resolve; });
    cdp?.on("Page.screencastFrame", (f) => {
      // Release Chrome's capture buffer immediately. Encoding and disk I/O
      // must not hold up the compositor's next frame.
      void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
      const file = path.join(tmp, `f${String(frameIndex++).padStart(5, "0")}.jpg`);
      frames.push({ file, t: f.metadata.timestamp });
      writes.push(fs.promises.writeFile(file, Buffer.from(f.data, "base64")));
      if (frames.length === 1) resolveOpeningFrame();
    });
    const nativeStart = tabCapture ? await startTabRecording(page, { title: captureTitle, width: vw * dpr, height: vh * dpr }) : pageFrames ? await startPageFrameRecording(page, { width: vw * dpr, height: vh * dpr, quality: captureJpegQuality }) : null;
    if (cdp && isolatedSource) await page.evaluate(() => {
      const root = document.getElementById("root");
      if (!root) throw new Error("Owned source fixture root is missing.");
      const sourceFrames = [], sourceChanges = [], longTasks = [];
      let raf;
      const sample = () => { sourceFrames.push(Date.now() / 1000); raf = requestAnimationFrame(sample); };
      raf = requestAnimationFrame(sample);
      const change = () => sourceChanges.push(Date.now() / 1000);
      // The branded cursor is a sibling on document.body, outside this root.
      const mutations = new MutationObserver(change);
      mutations.observe(root, { subtree: true, attributes: true, childList: true, characterData: true });
      root.addEventListener("input", change, true);
      root.addEventListener("scroll", change, true);
      const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration }))));
      observer.observe({ entryTypes: ["longtask"] });
      window.__dfaCDPSourceEvidence = { sourceFrames, sourceChanges, longTasks, stop: () => {
        cancelAnimationFrame(raf); mutations.disconnect(); observer.disconnect();
        root.removeEventListener("input", change, true); root.removeEventListener("scroll", change, true);
      } };
    });
    sourceScreenshots = cdp && isolatedSource ? startChangedSourceScreenshots({
      page, cdp, quality: captureJpegQuality,
      getLatestFrameTime: () => frames.reduce((latest, frame) => Math.max(latest, frame.sourceAt ?? frame.t), 0),
      onFrame: ({data,t,sourceAt,origin}) => {
        const file = path.join(tmp, `f${String(frameIndex++).padStart(5, "0")}.jpg`);
        frames.push({file,t,sourceAt,origin});
        writes.push(fs.promises.writeFile(file, Buffer.from(data,"base64")));
      },
    }) : null;
    const t0 = nativeStart?.startTime ?? Date.now() / 1000;
    if (cdp) await cdp.send("Page.startScreencast", { format: "jpeg", quality: captureJpegQuality, everyNthFrame: 1, maxWidth: vw * dpr, maxHeight: vh * dpr });
    await page.evaluate((ambient) => (window.__dfaCursor.dataset.on = ambient ? "0" : "1"), !!sceneAmbientMs);
    // A screencast can wait for compositor damage before emitting its first
    // frame. Do not let the first action become that damage: otherwise a clip
    // begins halfway through its first change and its poster misses the demo's
    // actual opening state. Fail without replacing the last good assets.
    if (cdp) await Promise.race([
      openingFrame,
      page.waitForTimeout(1500).then(() => { throw new Error("No opening screencast frame before the demo actions; retry the capture."); }),
    ]);
    await page.waitForTimeout(gallery ? 60 : 150);
    if(styled&&stylePack?.webModule)await page.evaluate(()=>{for(const root of document.querySelectorAll('[data-dfa-ink-root]'))root.dispatchEvent(new Event('dfa:ink-replay'));});

    // Paced by the clock, not by step count, so a glide takes exactly as long
    // as it does in the live player however slow each mouse.move is.
    const continuousWindows = [];
    const glide = async (x, y, ms) => {
      if (Math.hypot(x - px, y - py) < 1) { px = x; py = y; return; }
      const x0 = px;
      const y0 = py;
      const start = Date.now();
      for (;;) {
        const t = Math.min(1, (Date.now() - start) / ms);
        const e = ease(t);
        await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
        if (t >= 1) break;
        await page.waitForTimeout(12);
      }
      continuousWindows.push([start / 1000, Date.now() / 1000]);
      px = x;
      py = y;
    };
    // Resolve after consecutive stable animation frames inside the page. Keeping
    // this to one browser round trip avoids stretching every recorded step.
    const pointOf = createRecordTargetResolver({ page, targetSelector, onProblem: problem => problems.push(problem) });

    const motionWindows = [];
    for (const s of steps) {
      const actionStart = Date.now() / 1000;
      if (s.cmd === "wait") await page.waitForTimeout(s.ms);
      else if (s.cmd === "move") await glide(s.point[0] * vw, s.point[1] * vh, timings.glide);
      else if (s.cmd === "hover" || (s.cmd === "click" && s.target)) {
        // A marquee stops only after the pointer enters it. Waiting for it
        // to stop before a hover creates a circular wait. Clicks still settle.
        const p = await pointOf(s.target, s.cmd === "hover");
        if (!p) continue;
        await glide(p[0], p[1], timings.glide);
        // A container can start resizing after the first measurement. Correct
        // the landing point before pressing, just as the live cursor does.
        const landing = await pointOf(s.target);
        if (!landing) continue;
        if (Math.hypot(landing[0] - px, landing[1] - py) > 1)
          await glide(landing[0], landing[1], 120);
        if (s.cmd === "click") {
          await page.mouse.down();
          await page.waitForTimeout(timings.press);
          await page.mouse.up();
        }
      } else if (s.cmd === "click") {
        await page.mouse.down();
        await page.waitForTimeout(timings.press);
        await page.mouse.up();
      } else if (s.cmd === "down") await page.mouse.down();
      else if (s.cmd === "up") await page.mouse.up();
      else if (s.cmd === "drag") {
        await page.mouse.down();
        await glide(s.point[0] * vw, s.point[1] * vh, timings.drag);
        await page.mouse.up();
      } else if (s.cmd === "tab") {
        for (let i = 0; i < s.n; i++) {
          await page.keyboard.press("Tab");
          await page.waitForTimeout(timings.tabGap);
        }
      } else if (s.cmd === "key") {
        await page.keyboard.press(s.key);
        await page.waitForTimeout(timings.keyGap);
      } else if (s.cmd === "type") await page.keyboard.type(s.text, { delay: timings.typeGap });
      else if (s.cmd === "scroll") {
        await page.mouse.wheel(0, s.px);
        await page.waitForTimeout(timings.scrollSettle);
      }
      if (s.cmd !== "wait") motionWindows.push([actionStart, Date.now() / 1000 + .3]);
    }
    // A short tail so the last state lands before the loop restarts.
    await page.evaluate(() => (window.__dfaCursor.dataset.on = "0"));
    await page.waitForTimeout(Math.max(350, gallery ? 3000 - (Date.now() / 1000 - t0) * 1000 : 350));
    const sourceScreenshotEvidence = await sourceScreenshots?.stop();
    const t1 = Date.now() / 1000;
    const nativeEnd = nativeStart ? pageFrames ? await stopPageFrameRecording(page, tmp, nativeStart) : await stopTabRecording(page, tmp, nativeStart) : null;
    if (nativeEnd) frames = nativeEnd.frames;
    // Stop before shutdown IPC, pending writes or ffmpeg add unrecorded time.
    const cdpEvidence = cdp && isolatedSource ? await page.evaluate(() => {
      const capture = window.__dfaCDPSourceEvidence;
      capture.stop();
      return { sourceFrames: capture.sourceFrames, sourceChanges: capture.sourceChanges, longTasks: capture.longTasks };
    }) : null;
    if (cdp) await cdp.send("Page.stopScreencast");
    await page.waitForTimeout(100);
    await Promise.all(writes);

    if (!frames.length) throw new Error("screencast produced no frames");
    if (!nativeEnd && !mobile && dpr > 1) {
      const captured = await sharp(frames[0].file).metadata();
      if (captured.width !== vw * dpr || captured.height !== vh * dpr) throw new Error("Higher-resolution screencast did not deliver the requested pixel dimensions; keep the last good assets.");
    }
    const quality = captureQuality(frames.map((frame) => frame.t), motionWindows);
    const continuousQuality = captureQuality(continuousWindows.length ? frames.map((frame) => frame.t) : [], continuousWindows);
    const sourceEvidence = nativeEnd?.evidence ?? cdpEvidence;
    if (sourceEvidence && sourceScreenshotEvidence) sourceEvidence.sourceScreenshots = sourceScreenshotEvidence;
    if (sourceScreenshotEvidence?.errors.length) problems.push(...sourceScreenshotEvidence.errors.map(error => `Source capture failed: ${error}`));
    const nativeSourceQuality = sourceEvidence ? captureQuality(sourceEvidence.sourceFrames) : null;
    const nativeChangeQuality = sourceEvidence ? sourceChangeQuality(
      frames.filter(frame => frame.origin !== "owned-screenshot").map(frame => frame.t),
      sourceEvidence.sourceChanges,
      sourceScreenshotEvidence?.captures,
    ) : null;
    // Regular video timestamps can conceal a frozen JS animation. Grade both.
    if (nativeSourceQuality?.maxGapMs > 100) problems.push(`Actual source animation stalled ${nativeSourceQuality.maxGapMs.toFixed(1)}ms; keep the last good clip.`);
    if (nativeChangeQuality?.stallsOver100Ms) problems.push(`Changed source waited ${nativeChangeQuality.maxDelayMs.toFixed(1)}ms for an encoded frame; keep the last good clip.`);
    if (reportDir) {
      const directory = path.resolve(root, reportDir);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, `${slug}.json`), JSON.stringify({ slug, ...(styled ? {visualStyle,theme:styleTheme,material:materialEvidence} : {}), renderMode: isolatedSource ? "isolated-production-source" : "preview", ...(sourceEvidence ? { captureTransport: nativeEnd ? pageFrames ? "owned-page-screenshots" : "owned-browser-tab" : sourceScreenshotEvidence?.captures.length ? "page-screencast+owned-screenshots" : "page-screencast", nativeSourceQuality, nativeChangeQuality, native: sourceEvidence } : {}), openingFrameBeforeActions: true, quality, continuousQuality, viewport: { vw, vh, dpr }, framing: frame, timestamps: frames.map((frame) => frame.t), motionWindows, continuousWindows }, null, 2));
      if (nativeEnd) fs.copyFileSync(nativeEnd.file, path.join(directory, `${slug}-raw.${nativeEnd.extension}`));
    }
    // Each frame holds until the next one; the last holds to the end.
    frames.sort((a, b) => a.t - b.t);
    if (!nativeEnd) fs.writeFileSync(path.join(tmp, "frames.txt"), concatFrameList(frames, t0, t1));

    let inputs = nativeEnd ? ["-i", nativeEnd.file] : ["-f", "concat", "-safe", "0", "-i", path.join(tmp, "frames.txt")];
    let graph;
    if (mobile) {
      const mask = path.join(tmp, "mask.png");
      const { h } = await phoneMask(mask, vw, vh);
      inputs = [...inputs, "-i", mask];
      graph = `[0:v]scale=-2:${h}:flags=lanczos,pad=${OUT_W}:${OUT_H}:(ow-iw)/2:(oh-ih)/2:color=0x050505[v];[v][1:v]overlay=0:0,fps=${FPS},format=yuv420p`;
    } else {
      const pixelFrame = { ...frame, cw: frame.cw * dpr, ch: frame.ch * dpr, cx: frame.cx * dpr, cy: frame.cy * dpr };
      graph = `[0:v]${framedCropFilter(vw * dpr, vh * dpr, pixelFrame, extendStageEdges)},scale=${OUT_W}:${OUT_H}:flags=lanczos,fps=${FPS},format=yuv420p`;
    }
    const mp4Tmp = path.join(tmp, `${slug}.mp4`);
    let crf = 24;
    for (;;) {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", graph, "-an", "-c:v", "libx264", "-preset", "slow", "-tune", "animation", "-crf", String(crf), "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4Tmp]);
      if (fs.statSync(mp4Tmp).size <= maxBytes || crf >= 30) break;
      crf += 2;
    }
    const size = fs.statSync(mp4Tmp).size;
    if (size > maxBytes) problems.push(`video is ${Math.round(size / 1024)} KB even at crf ${crf}; shorten the demo or reduce motion`);
    const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4Tmp]).toString().trim());
    if (dur < 2.5 || dur > 9.5) problems.push(`video runs ${dur.toFixed(1)}s; demos should be 3–8s (script estimate ${(demoDuration(steps) / 1000).toFixed(1)}s)`);

    if (continuousWindows.length && continuousQuality.activeSamples && continuousQuality.p95GapMs > 34 && !args.includes("--allow-dropped-frames")) problems.push(`capture has ${continuousQuality.p95GapMs.toFixed(1)}ms p95 moving-frame gaps; keep the last good clip and retry without competing rendering work`);
    if (continuousWindows.length && continuousQuality.stallsOver100Ms && !args.includes("--allow-dropped-frames")) problems.push(`capture has ${continuousQuality.stallsOver100Ms} moving-frame stalls over 100ms; keep the last good clip and retry`);
    if (problems.length) {
      let evidence;
      if (reportDir) {
        try {
          evidence = preserveRejectedCapture({
            reportDir: path.resolve(root, reportDir), slug, candidateFile: mp4Tmp,
            nativeFile: nativeEnd?.file, frames, startTime: t0, endTime: t1, problems,
            metrics: { quality, continuousQuality, nativeSourceQuality, nativeChangeQuality,
              sourceEvidence, viewport: { vw, vh, dpr }, framing: frame, size, durationSeconds: dur, crf },
          });
        } catch (error) {
          problems.push(`Could not retain rejected capture evidence: ${error.message}`);
        }
      }
      return { written: [], problems, evidence };
    }
    fs.mkdirSync(out, { recursive: true });
    const finalMp4 = path.join(out, `${slug}.mp4`);
    fs.copyFileSync(mp4Tmp, `${finalMp4}.${process.pid}.tmp`);
    fs.renameSync(`${finalMp4}.${process.pid}.tmp`, finalMp4);
    const written = [`${finalMp4}  ${Math.round(size / 1024)} KB · ${dur.toFixed(1)}s · crf ${crf}`];

    if (webm) {
      const w = path.join(tmp, `${slug}.webm`);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4Tmp, "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", w]);
      // Only worth shipping if it's actually smaller.
      if (fs.statSync(w).size < size * 0.9) {
        const f = path.join(out, `${slug}.webm`);
        fs.copyFileSync(w, `${f}.${process.pid}.tmp`);
        fs.renameSync(`${f}.${process.pid}.tmp`, f);
        written.push(`${f}  ${Math.round(fs.statSync(f).size / 1024)} KB`);
      }
    }

    const poster = path.join(out, `${slug}.webp`);
    if (!fs.existsSync(poster) || fullViewport || refreshPoster || styled) {
      const png = path.join(tmp, "poster.png");
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4Tmp, "-frames:v", "1", png]);
      await (styled ? sharp(png).resize(768, 480) : sharp(png)).webp({ quality: 82 }).toFile(poster);
      written.push(`${poster}  (poster from the first frame)`);
    }

    if (sheetDir) {
      const dir = path.resolve(root, sheetDir);
      fs.mkdirSync(dir, { recursive: true });
      const sheet = path.join(dir, `${slug}-video-frames.png`);
      const every = Math.max(0.25, dur / 12);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4Tmp, "-vf", `fps=${1 / every},scale=480:-1,tile=4x3:padding=4:color=0x333333`, "-frames:v", "1", sheet]);
      written.push(sheet);
    }
    return { written, problems };
  } finally {
    await sourceScreenshots?.stop();
    if (pageFrames) for (const page of context.pages()) await discardPageFrameRecording(page);
    await context.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const slugs = only.length ? only : allSlugsWithDemo();
if (!slugs.length) {
  console.log("No components with a demo.");
  process.exit(0);
}
const nativeTabMobile = (tabCapture || pageFrames) && slugs.every(slug => readMeta(slug)?.platform === "mobile");
if ((tabCapture || pageFrames) && !nativeTabMobile && slugs.some(slug => readMeta(slug)?.platform === "mobile")) throw new Error("Record web and native fixtures separately to preserve their exact pixel density");
const displayScale = nativeTabMobile ? 2 : webScale;
if (webScale > 1 && args.includes("--software-rendering")) throw new Error("--web-scale above 1 requires the native renderer");
const browser = await launchChromium(args.includes("--software-rendering") ? {} : { args: ["--mute-audio", ...(displayScale > 1 ? [`--force-device-scale-factor=${displayScale}`] : []), ...(tabCapture ? [`--auto-select-tab-capture-source-by-title=${captureTitle}`] : [])] });
let failed = 0;
for (const slug of slugs) {
  try {
    const { written, problems, evidence } = await record(browser, slug);
    console.log(`${problems.length ? "✗" : "✓"} ${slug}\n  ${written.join("\n  ")}`);
    if (evidence) console.log(`  Rejected capture evidence: ${evidence}`);
    for (const p of problems) console.log(`  ⚠ ${p}`);
    if (problems.length) failed++;
  } catch (e) {
    failed++;
    console.log(`✗ ${slug}: ${e.message}`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
