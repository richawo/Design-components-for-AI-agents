import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { componentFiles, readModules, renderBlock, syncSource } from "../scripts/lib/controls-kit.mjs";

describe("control kit", () => {
  const modules = readModules();

  it("defines every module the docs describe", () => {
    expect([...modules.keys()].sort()).toEqual(["check", "radio", "range", "stepper", "switch"]);
  });

  it("namespaces every selector and custom property with the prefix", () => {
    const css = renderBlock([...modules.keys()], "zz", modules);
    expect(css).not.toContain("{p}");
    for (const selector of css.match(/^\.[a-z-]+/gm) ?? []) expect(selector.startsWith(".zz-ctl-")).toBe(true);
    expect(css).not.toMatch(/[`$\\]/);
  });

  it("keeps every embedded copy in sync with docs/controls/controls.css", () => {
    const drifted = componentFiles().filter((file) => {
      const text = fs.readFileSync(file, "utf8");
      return syncSource(text, modules).text !== text;
    });
    expect(drifted).toEqual([]);
  });
});
