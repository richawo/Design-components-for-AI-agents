// The control kit's source and the embedding format. See docs/controls/README.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const KIT_PATH = path.join(root, "docs/controls/controls.css");
export const BLOCK = /\/\* @controls ([a-z ]+?) prefix=([a-z][a-z0-9]*) \*\/[\s\S]*?\/\* @controls end \*\//g;

/** The kit's modules by name, with `{p}` still in place. */
export function readModules(source = fs.readFileSync(KIT_PATH, "utf8")) {
  const modules = new Map();
  for (const m of source.matchAll(/\/\* @module ([a-z]+) \*\/\n([\s\S]*?)\/\* @end \*\//g)) modules.set(m[1], m[2].trimEnd());
  return modules;
}

/** The exact text a component should carry for these modules and prefix. */
export function renderBlock(names, prefix, modules = readModules()) {
  const body = names.map((name) => {
    const css = modules.get(name);
    if (!css) throw new Error(`Unknown control module "${name}" (have: ${[...modules.keys()].join(", ")})`);
    return css.replaceAll("{p}", prefix);
  });
  return `/* @controls ${names.join(" ")} prefix=${prefix} */\n${body.join("\n")}\n/* @controls end */`;
}

export function componentFiles() {
  return ["free", "pro"].flatMap((tier) => {
    const dir = path.join(root, "registry", tier);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((name) => !name.startsWith(".") && name !== "_site")
      .map((name) => path.join(dir, name, `${name}.tsx`))
      .filter((file) => fs.existsSync(file));
  });
}

/** Returns the file's text with every block regenerated, plus what it found. */
export function syncSource(text, modules = readModules()) {
  const found = [];
  const next = text.replace(BLOCK, (_, names, prefix) => {
    const list = names.trim().split(/\s+/);
    found.push({ names: list, prefix });
    return renderBlock(list, prefix, modules);
  });
  return { text: next, found };
}

