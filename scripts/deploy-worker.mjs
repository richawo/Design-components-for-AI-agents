#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { compactGeneratedSourceMap } from "./lib/source-map-budget.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, ".open-next", "deploy");
const archive = path.join(root, ".open-next", "source-maps-full");
const wrangler = path.join(root, "node_modules", ".bin", "wrangler");
const run = (args) => execFileSync(wrangler, [...args, "--config", path.join(root, "wrangler.jsonc")], { cwd: root, stdio: "inherit" });

// Let Wrangler resolve the entrypoint and WASM modules exactly as for deployment.
run(["deploy", "--dry-run", "--outdir", directory]);
fs.mkdirSync(archive, { recursive: true });
let total = 0;
for (const name of fs.readdirSync(directory).filter((file) => file.endsWith(".map"))) {
  const file = path.join(directory, name), bytes = fs.readFileSync(file);
  fs.writeFileSync(path.join(archive, name), bytes);
  const { map, omitted } = compactGeneratedSourceMap(JSON.parse(bytes.toString()));
  const compact = Buffer.from(JSON.stringify(map));
  fs.writeFileSync(file, compact);
  const size = gzipSync(compact).length;
  total += size;
  console.log(`source maps: ${name}, ${size} gzipped bytes, ${omitted} compiled source copies omitted`);
}
if (total >= 15_000_000) throw new Error(`Source maps exceed Cloudflare's 15 MB limit: ${total} bytes`);

// Prebundled code is unchanged. Avoid regenerating the oversized map on upload.
run(["deploy", path.join(directory, "worker.js"), "--no-bundle", ...(process.argv.includes("--dry-run") ? ["--dry-run", "--outdir", path.join(root, ".open-next", "deploy-verified")] : [])]);
