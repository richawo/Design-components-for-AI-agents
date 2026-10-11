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
run(["deploy", "--dry-run", "--minify", "--outdir", directory]);
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

// Check the same uncompressed modules Cloudflare counts before uploading any
// assets. Source maps have their own budget above and are not runtime modules.
const runtimeBytes = fs.readdirSync(directory)
  .filter((name) => /\.(?:js|mjs|wasm)$/.test(name))
  .reduce((sum, name) => sum + fs.statSync(path.join(directory, name)).size, 0);
console.log(`Worker runtime: ${runtimeBytes} bytes (64 MiB limit)`);
if (runtimeBytes >= 64 * 1024 * 1024) throw new Error(`Worker exceeds Cloudflare's 64 MiB limit: ${runtimeBytes} bytes`);

// Prebundled code is unchanged. Avoid regenerating the oversized map on upload.
const entry = path.join(directory, "worker.js");
if (!/\/\/# sourceMappingURL=/.test(fs.readFileSync(entry, "utf8"))) {
  fs.appendFileSync(entry, "\n//# sourceMappingURL=worker.js.map\n");
}
run(["deploy", path.join(directory, "worker.js"), "--no-bundle", ...(process.argv.includes("--dry-run") ? ["--dry-run", "--outdir", path.join(root, ".open-next", "deploy-verified")] : [])]);
