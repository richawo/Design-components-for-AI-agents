#!/usr/bin/env node
// Copies the control kit (docs/controls/controls.css) into the components that
// use it. Components are single, self-contained files, so each one carries its
// own namespaced copy between two markers inside its CSS:
//
//   /* @controls range check prefix=cs */
//   …generated, don't edit…
//   /* @controls end */
//
//   node scripts/sync-controls.mjs            rewrite every embedded copy
//   node scripts/sync-controls.mjs --check    fail if any copy has drifted
//   node scripts/sync-controls.mjs --list     print where each module is used
import fs from "node:fs";
import path from "node:path";
import { componentFiles, readModules, root, syncSource } from "./lib/controls-kit.mjs";

const check = process.argv.includes("--check");
const list = process.argv.includes("--list");
const modules = readModules();
const drifted = [];
const usage = new Map();
for (const file of componentFiles()) {
  const text = fs.readFileSync(file, "utf8");
  const { text: next, found } = syncSource(text, modules);
  if (!found.length) continue;
  const rel = path.relative(root, file);
  for (const f of found) for (const n of f.names) usage.set(n, [...(usage.get(n) ?? []), rel]);
  if (next === text) continue;
  if (check) drifted.push(rel);
  else {
    fs.writeFileSync(file, next);
    console.log(`synced ${rel}`);
  }
}
if (list) for (const [name, files] of usage) console.log(`${name} (${files.length}):\n  ${files.join("\n  ")}`);
if (drifted.length) {
  console.error(`Control kit copies out of date:\n  ${drifted.join("\n  ")}\nRun node scripts/sync-controls.mjs`);
  process.exit(1);
}
if (check) console.log(`control kit: ${[...usage.values()].flat().length} embedded modules in sync`);
