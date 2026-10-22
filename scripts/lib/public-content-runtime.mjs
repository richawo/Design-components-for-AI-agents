import fs from "node:fs";
import path from "node:path";

export const PUBLIC_CONTENT_PACKAGE = "@design-yaps/public-content-runtime";

// Next emits separate route chunks. A server-external package keeps their
// identical public editorial payload in one module in the prepared Worker.
// This package contains public blog/docs data only, never component sources.
export function writePublicContentRuntime(root, packed) {
  if (packed.encoding !== "gzip-base64" || typeof packed.data !== "string") throw new Error("Invalid public content pack");
  const directory = path.join(root, "node_modules", ...PUBLIC_CONTENT_PACKAGE.split("/"));
  const manifest = path.join(directory, "package.json");
  if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, "utf8")).name !== PUBLIC_CONTENT_PACKAGE) throw new Error("Unexpected public-content runtime package");
  fs.mkdirSync(directory, { recursive: true });
  const files = {
    "package.json": JSON.stringify({ name: PUBLIC_CONTENT_PACKAGE, version: "0.0.0", private: true, main: "./index.cjs", types: "./index.d.ts" }) + "\n",
    "index.cjs": 'module.exports = require("./content-packed.json");\n',
    "index.d.ts": 'declare const packed: { encoding: "gzip-base64"; data: string }; export = packed;\n',
    "content-packed.json": JSON.stringify(packed) + "\n",
  };
  for (const [name, contents] of Object.entries(files)) {
    const file = path.join(directory, name);
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== contents) fs.writeFileSync(file, contents);
  }
  return directory;
}

export function assertSinglePublicContentCopy(serverSource, packed) {
  const first = serverSource.indexOf(packed.data);
  if (first < 0 || serverSource.indexOf(packed.data, first + packed.data.length) >= 0) {
    throw new Error("Prepared server must contain exactly one complete public content pack");
  }
  return packed.data.length;
}
