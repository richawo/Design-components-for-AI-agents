#!/usr/bin/env node
// Everything a builder runs before calling a component done, for one slug:
//
//   node scripts/check-component.mjs <slug> [--base=http://localhost:3100] [--no-video] [--keep-going]
//
//   1. validate its four files, demo script and controls (no writes)
//   2. make sure the dev server can render /preview/<slug>
//   3. screenshot it at 1440, 768 and 390 (fails on overflow or console errors)
//   4. push every control to a non-default value and check the preview changes
//   5. record the demo into public/previews/<slug>.mp4 (fails on missing targets)
//
// Output goes to test-results/check/<slug>/. Exits 1 on any problem.
//
// Safe to run from many agents at once against one dev server: validation
// writes nothing, screenshots and contact sheets go to a per-slug folder, the
// video replaces public/previews/<slug>.mp4 atomically, and the only shared
// files (registry/__generated__/*) are rebuilt under build-registry's lock,
// only when this slug is missing from them.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { launchChromium } from "./lib/browser.mjs";
import { REPLAY_ACTION, optionOf } from "../lib/demo/schema.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};
const slug = args.find((a) => !a.startsWith("--"));
if (!slug) {
  console.error("usage: node scripts/check-component.mjs <slug> [--base=http://localhost:3100] [--no-video]");
  process.exit(2);
}
const base = flag("base", process.env.PREVIEW_BASE || "http://localhost:3100").replace(/\/$/, "");
const outDir = path.join(root, "test-results", "check", slug);
const keepGoing = args.includes("--keep-going");
const problems = [];
const note = (ok, msg) => console.log(`${ok ? "✓" : "✗"} ${msg}`);

function node(script, ...a) {
  const r = spawnSync(process.execPath, [path.join(root, "scripts", script), ...a], { cwd: root, encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}
function stop() {
  if (!keepGoing) finish();
}
function finish() {
  console.log(problems.length ? `\n${slug}: ${problems.length} problem(s)\n  - ${problems.join("\n  - ")}` : `\n${slug}: all checks passed. Review the screenshots in ${path.relative(root, outDir)}/ before calling it done.`);
  process.exit(problems.length ? 1 : 0);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 1. Validation, for this slug only and without writing anything.
const v = node("build-registry.mjs", `--only=${slug}`, "--dry-run");
note(v.ok, "registry validation");
if (!v.ok) {
  problems.push(...v.out.split("\n").filter((l) => l.trim().startsWith("- ")).map((l) => l.trim().slice(2)));
  stop();
}
const metaPath = ["free", "pro"].map((t) => path.join(root, "registry", t, slug, "meta.json")).find((p) => fs.existsSync(p));
const meta = metaPath ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : null;
if (!meta) finish();

// 2. The preview route. A brand-new slug isn't in the generated loaders yet:
// rebuild them once (locked and atomic, so other agents' builds are safe).
async function previewStatus() {
  try {
    return (await fetch(`${base}/preview/${slug}`, { redirect: "manual" })).status;
  } catch {
    return 0;
  }
}
let status = await previewStatus();
if (status === 0) {
  problems.push(`no server at ${base}. Start one (npm run dev -- -p 3100) or pass --base`);
  finish();
}
const generated = path.join(root, "registry", "__generated__", "index.json");
const listed = () => fs.existsSync(generated) && JSON.parse(fs.readFileSync(generated, "utf8")).some((e) => e.slug === slug);
if (status !== 200 && !listed()) {
  node("build-registry.mjs");
  for (let i = 0; i < 30 && status !== 200; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    status = await previewStatus();
  }
}
note(status === 200, `GET /preview/${slug} → ${status}`);
if (status !== 200) {
  problems.push(`/preview/${slug} returned ${status}`);
  finish();
}

// 3. Screenshots at three widths.
const shot = node("shot.mjs", slug, `--base=${base}`, `--out=${outDir}`);
const overflow = shot.out.split("\n").filter((l) => l.includes("overflow"));
const errs = shot.out.split("\n").filter((l) => l.includes("errors:"));
note(shot.ok && !overflow.length && !errs.length, `screenshots → ${path.relative(root, outDir)}/`);
if (!shot.ok) problems.push(`screenshots failed: ${shot.out.split("\n").slice(-3).join(" ")}`);
for (const l of [...overflow, ...errs]) problems.push(l.trim());

// 4. Controls reach the component: each non-default value must change the preview.
const controls = (meta.controls ?? []).filter((c) => !(c.kind === "action" && c.prop === REPLAY_ACTION));
if (controls.length) {
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  // The plain-text host page has no favicon; that 404 isn't the component's.
  page.on("console", (m) => m.type() === "error" && !/favicon/.test(m.location().url ?? "") && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  // Host the preview in a same-origin frame, as the component page does. The
  // host is a plain-text route, so no React app owns (and re-renders) its body.
  await page.goto(`${base}/robots.txt`, { waitUntil: "load" });
  await page.evaluate((src) => {
    window.__ready = new Promise((resolve) => addEventListener("message", (e) => e.data?.channel === "dfa-preview" && e.data.type === "ready" && resolve(true)));
    document.body.innerHTML = "";
    const f = document.createElement("iframe");
    f.id = "frame";
    f.src = src;
    f.style.cssText = "width:1440px;height:900px;border:0";
    document.body.appendChild(f);
  }, `${base}/preview/${slug}`);
  const ready = await page.evaluate(() => Promise.race([window.__ready, new Promise((r) => setTimeout(() => r(false), 30000))]));
  if (!ready) problems.push("the preview never sent its ready message");
  await page.waitForTimeout(2500);
  const snap = () => page.evaluate(() => document.getElementById("frame").contentDocument.body.innerHTML);
  const send = (props, remount) => page.evaluate(([p, r]) => document.getElementById("frame").contentWindow.postMessage({ channel: "dfa-preview", type: "props", props: p, remount: r }, location.origin), [props, remount]);
  // Settle once, then flip each control and look for markup the flip added.
  // Anything that also changes on its own (an ambient animation, a ticking
  // value) is learned first and ignored, so it can't make a dead control pass.
  const SETTLE = 900;
  // React's useId values (_r_0_, «r0», :r0:, and the same with punctuation
  // stripped) change on every mount; they aren't a visible change.
  // Counted, not a set: a change can reuse markup found elsewhere on the stage.
  const tokens = (html) => {
    const counts = new Map();
    for (const t of html
      .replace(/_[rR]_[0-9a-z]*_|«[rR][0-9a-z]*»|:[rR][0-9a-z]*:|\b[rR][0-9a-z]{0,3}(?=-)/g, "ID")
      .split(/(?=<)|>|\s+/)
      .filter(Boolean))
      counts.set(t, (counts.get(t) ?? 0) + 1);
    return counts;
  };
  const differs = (a, b, ignore) => {
    for (const k of new Set([...a.keys(), ...b.keys()])) if (!ignore.has(k) && a.get(k) !== b.get(k)) return true;
    return false;
  };
  await send({}, true);
  await page.waitForTimeout(2600);
  const noise = new Set();
  let prev = tokens(await snap());
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(SETTLE);
    const next = tokens(await snap());
    for (const k of new Set([...next.keys(), ...prev.keys()])) if (next.get(k) !== prev.get(k)) noise.add(k);
    prev = next;
  }
  const quiet = [];
  for (const c of controls) {
    const alt = alternative(c);
    if (alt === undefined) continue;
    const before = tokens(await snap());
    await send({ [c.prop]: alt }, !!c.remount);
    await page.waitForTimeout(c.remount ? 2600 : SETTLE);
    const after = tokens(await snap());
    if (!differs(before, after, noise)) quiet.push(`${c.prop} → ${JSON.stringify(alt)}`);
    await send({}, !!c.remount);
    await page.waitForTimeout(c.remount ? 2600 : SETTLE);
  }
  note(!quiet.length, `controls change the preview (${controls.length})`);
  for (const q of quiet) problems.push(`control ${q} changed nothing in the preview: does the default export spread its overrides onto the component?`);
  if (consoleErrors.length) problems.push(...consoleErrors.slice(0, 5).map((e) => `console error while tuning: ${e}`));
  await browser.close();
}

function alternative(c) {
  switch (c.kind) {
    case "toggle":
      return !c.default;
    case "slider":
      return c.default === c.max ? c.min : c.max;
    case "select":
    case "segmented":
      return (c.options ?? []).map(optionOf).find((o) => o.value !== c.default)?.value;
    case "color":
      return c.default.toLowerCase() === "#22c55e" ? "#3b82f6" : "#22c55e";
    case "text":
      return `${c.default} (edited)`;
    case "action":
      return (c.options ?? []).map(optionOf).at(-1)?.value ?? c.value;
  }
}

// 5. The card video.
if (meta.demo && !args.includes("--no-video")) {
  const had = fs.existsSync(path.join(root, "public", "previews", `${slug}.mp4`));
  const rec = node("record-demos.mjs", slug, `--base=${base}`, `--sheet=${path.relative(root, outDir)}`);
  note(rec.ok, "demo recording");
  console.log(rec.out.split("\n").map((l) => `    ${l}`).join("\n"));
  if (!rec.ok) problems.push(...rec.out.split("\n").filter((l) => /⚠|✗/.test(l)).map((l) => l.trim().replace(/^[⚠✗]\s*/, "")));
  // The card only knows about videos listed in the generated data.
  if (rec.ok && !had) node("build-registry.mjs");
} else if (!meta.demo) {
  note(true, "no demo script (the card shows its poster only)");
}

finish();
