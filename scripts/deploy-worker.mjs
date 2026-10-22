#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { compactGeneratedSourceMap } from "./lib/source-map-budget.mjs";
import { copyPreparedServerAssets } from "./lib/prepared-server-assets.mjs";
import { assertPublicationBuildReceipt } from "./lib/publication-build.mjs";
import { assertSinglePublicContentCopy } from "./lib/public-content-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
assertPublicationBuildReceipt(root);
const directory = path.join(root, ".open-next", "deploy");
const archive = path.join(root, ".open-next", "source-maps-full");
const wrangler = path.join(root, "node_modules", ".bin", "wrangler");
const openNext = path.join(root, "node_modules", ".bin", "opennextjs-cloudflare");
const run = (args) => execFileSync(wrangler, [...args, "--config", path.join(root, "wrangler.jsonc")], { cwd: root, stdio: "inherit" });
const filesIn = (dir, prefix = "") => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const name = path.join(prefix, entry.name);
  return entry.isDirectory() ? filesIn(path.join(dir, entry.name), name) : [name];
});

// This deploy path invokes Wrangler directly, so it must do the cache
// preparation normally performed by OpenNext's deploy command. The configured
// read-only cache copies build-time entries into the assets upload directory.
execFileSync(openNext, ["populateCache", "remote", "--config", path.join(root, "wrangler.jsonc")], { cwd: root, stdio: "inherit" });

// Wrangler normally folds dynamic imports back into the entrypoint. That makes
// every public cache hit initialize the entire Next server and registry. Bundle
// its Node compatibility shims separately, then preserve the lazy import using
// the explicit module rule in wrangler.jsonc.
const serverDirectory = path.join(root, ".wrangler", "prepared-server");
const lazyDirectory = path.join(root, ".open-next", "lazy-modules");
fs.rmSync(serverDirectory, { recursive: true, force: true });
fs.rmSync(lazyDirectory, { recursive: true, force: true });
fs.rmSync(directory, { recursive: true, force: true });
fs.rmSync(path.join(root, ".open-next", "deploy-verified"), { recursive: true, force: true });
const serverBundleEntry = path.join(root, ".open-next", "server-entry.mjs");
// A default export makes Wrangler use module format rather than service-worker
// format. The outer Worker always calls the named Next handler.
fs.writeFileSync(serverBundleEntry, 'export { handler } from "./server-functions/default/handler.mjs";\nexport default {};\n');
run(["deploy", serverBundleEntry, "--dry-run", "--minify", "--outdir", serverDirectory]);
const serverEntry = ["server-entry.js", "server-entry.mjs"].find(name => fs.existsSync(path.join(serverDirectory, name)));
if (!serverEntry) throw new Error("Wrangler did not emit the prepared Next server");
fs.mkdirSync(lazyDirectory, { recursive: true });
const lazyServer = path.join(lazyDirectory, "lazy-server.mjs");
fs.writeFileSync(lazyServer, fs.readFileSync(path.join(serverDirectory, serverEntry), "utf8")
  .replace(/sourceMappingURL=[^\s]+/, "sourceMappingURL=lazy-server.mjs.map"));
const copied = copyPreparedServerAssets({
  preparedDirectory: serverDirectory,
  destination: lazyDirectory,
  serverEntry,
  serverSource: fs.readFileSync(lazyServer, "utf8"),
  sharedManifest: path.join(root, ".open-next", "cloudflare", "cache-assets-manifest.sql"),
});
if (copied.omittedManifest) console.log("Prepared server: omitted unused identical router cache manifest");
const workerEntry = path.join(root, ".open-next", "worker.js");
const worker = fs.readFileSync(workerEntry, "utf8");
const serverImport = 'import("./server-functions/default/handler.mjs")';
if (!worker.includes(serverImport) && !worker.includes('import("./lazy-modules/lazy-server.mjs")')) {
  throw new Error("OpenNext's server import changed; refusing to lose the lazy boundary");
}
fs.writeFileSync(workerEntry, worker.replace(serverImport, 'import("./lazy-modules/lazy-server.mjs")'));

// Let Wrangler resolve the entrypoint and WASM modules exactly as for deployment.
run(["deploy", "--dry-run", "--minify", "--outdir", directory]);
const serverMap = path.join(serverDirectory, `${serverEntry}.map`);
if (fs.existsSync(serverMap)) fs.copyFileSync(serverMap, path.join(directory, "lazy-modules/lazy-server.mjs.map"));
if (!fs.existsSync(path.join(directory, "lazy-modules/lazy-server.mjs")) ||
    fs.statSync(path.join(directory, "worker.js")).size >= 4 * 1024 * 1024) {
  throw new Error("The public Worker entrypoint lost its small lazy-server boundary");
}
const publicPack = JSON.parse(fs.readFileSync(path.join(root, "registry/__generated__/content-packed.json"), "utf8"));
const packedBytes = assertSinglePublicContentCopy(fs.readFileSync(path.join(directory, "lazy-modules/lazy-server.mjs"), "utf8"), publicPack);
console.log(`Public content: one shared ${packedBytes}-byte packed payload`);
fs.mkdirSync(archive, { recursive: true });
let total = 0;
for (const name of filesIn(directory).filter((file) => file.endsWith(".map"))) {
  const file = path.join(directory, name), bytes = fs.readFileSync(file);
  fs.mkdirSync(path.dirname(path.join(archive, name)), { recursive: true });
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
const runtimeBytes = filesIn(directory)
  .filter((name) => /\.(?:js|mjs|wasm|txt|sql)$/.test(name))
  .reduce((sum, name) => sum + fs.statSync(path.join(directory, name)).size, 0);
console.log(`Worker runtime: ${runtimeBytes} bytes (64 MiB limit)`);
if (runtimeBytes >= 64 * 1024 * 1024) throw new Error(`Worker exceeds Cloudflare's 64 MiB limit: ${runtimeBytes} bytes`);

// Prebundled code is unchanged. Avoid regenerating the oversized map on upload.
const entry = path.join(directory, "worker.js");
if (!/\/\/# sourceMappingURL=/.test(fs.readFileSync(entry, "utf8"))) {
  fs.appendFileSync(entry, "\n//# sourceMappingURL=worker.js.map\n");
}
run(["deploy", path.join(directory, "worker.js"), "--no-bundle", ...(process.argv.includes("--dry-run") ? ["--dry-run", "--outdir", path.join(root, ".open-next", "deploy-verified")] : [])]);
