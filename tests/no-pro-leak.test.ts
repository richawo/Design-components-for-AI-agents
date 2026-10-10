import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pro components live in a private repository. These checks fail the build if
 * any of their source reaches files tracked in this public one.
 */

const root = path.resolve(__dirname, "..");
const tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
const manifest: { slug: string; usage: string }[] = JSON.parse(fs.readFileSync(path.join(root, "registry/pro-manifest.json"), "utf8"));
const proNames = manifest.map((m) => /import \{ (\w+) \}/.exec(m.usage)?.[1]).filter((n): n is string => !!n);

describe("no Pro source in the public repository", () => {
  it("tracks nothing under registry/pro", () => {
    expect(tracked.filter((f) => f.startsWith("registry/pro/"))).toEqual([]);
  });

  it("has no free component folder named after a Pro component", () => {
    const pro = new Set(manifest.map((m) => m.slug));
    expect(tracked.filter((f) => f.startsWith("registry/free/") && pro.has(f.split("/")[2]))).toEqual([]);
  });

  it("defines no Pro component in any tracked source file", () => {
    expect(proNames.length).toBe(manifest.length);
    const code = tracked.filter((f) => /\.(tsx?|jsx?|mjs|html)$/.test(f) && !f.startsWith("tests/"));
    const hits: string[] = [];
    for (const f of code) {
      const src = fs.readFileSync(path.join(root, f), "utf8");
      for (const n of proNames) if (new RegExp(`export (default )?function ${n}\\b`).test(src)) hits.push(`${f}: ${n}`);
    }
    expect(hits).toEqual([]);
  });

  it("keeps component folders to their four files", () => {
    const allowed = /^registry\/free\/([^/]+)\/(\1\.tsx|meta\.json|prompt\.md|prompt\.json)$/;
    expect(tracked.filter((f) => f.startsWith("registry/free/") && !allowed.test(f))).toEqual([]);
  });

  it("keeps the manifest to public metadata", () => {
    for (const m of manifest) expect(Object.keys(m)).not.toEqual(expect.arrayContaining(["code"]));
    expect(JSON.stringify(manifest)).not.toMatch(/useState\(|useEffect\(|useRef\(/);
  });

  it("allows only meta.json keys in the manifest, and no source inside demo or controls", () => {
    const allowed = new Set(["slug", "name", "tier", "platform", "category", "description", "tags", "dependencies", "theme", "previewHeight", "usage", "props", "added", "status", "demo", "controls"]);
    for (const m of manifest) for (const k of Object.keys(m)) expect(allowed.has(k), `${(m as { slug: string }).slug}: ${k}`).toBe(true);
    // Demo steps and control values are short strings: never code, prompts or file contents.
    const extras = JSON.stringify(manifest.map((m) => [(m as { demo?: unknown }).demo, (m as { controls?: unknown }).controls]));
    expect(extras).not.toMatch(/=>|export |import |function |className=|<\w+[\s>]/);
    expect(extras.length).toBeLessThan(manifest.length * 4000);
  });
});
