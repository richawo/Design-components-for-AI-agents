import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Ship the public CLI and stdio MCP wrapper with the site while npm publication is pending.
const root = path.resolve(import.meta.dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "design-cli-pack-"));
try {
  for (const name of ["cli", "mcp"]) {
    const [packed] = JSON.parse(execFileSync("npm", ["pack", path.join(root, `packages/${name}`), "--json", "--pack-destination", temporary], { encoding: "utf8" }));
    const allowed = new Set(["index.mjs", "package.json", "README.md", "LICENSE", ...(name === "mcp" ? ["principles.md", "server.json"] : [])]);
    if (!packed.files.every((file) => allowed.has(file.path))) throw new Error(`${name} archive includes an unexpected file`);
    fs.copyFileSync(path.join(temporary, packed.filename), path.join(root, `public/${name}.tgz`));
    console.log(`${name}: packaged ${packed.files.length} public files`);
  }
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
