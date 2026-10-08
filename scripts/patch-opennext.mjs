#!/usr/bin/env node
// Runs after `npm install`. OpenNext's Cloudflare adapter inlines Next.js
// manifests into the Worker by filename, and @opennextjs/cloudflare 1.20.9
// doesn't yet know about `.next/server/preview-props.json`, which Next 16.4
// reads on every request. Without it, every server route on the Worker
// throws "Unexpected loadManifest(/.next/server/preview-props.json) call!".
// Remove this script once the adapter includes preview-props itself.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const file = path.join(root, "node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js");
if (!fs.existsSync(file)) process.exit(0);

const from = "{*-manifest,required-server-files,prefetch-hints}.json";
const to = "{*-manifest,required-server-files,prefetch-hints,preview-props}.json";
const src = fs.readFileSync(file, "utf8");
if (src.includes(to) || src.includes("preview-props")) process.exit(0);
if (!src.includes(from)) {
  console.warn("patch-opennext: manifest pattern not found; the adapter changed, check preview-props support");
  process.exit(0);
}
fs.writeFileSync(file, src.replace(from, to));
console.log("patch-opennext: inline preview-props.json in the Worker");
