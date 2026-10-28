import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { stylePreviewManifest } from "../scripts/lib/style-previews.mjs";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "style-posters-"));
  roots.push(root);
  const directory = path.join(root, "public/style-previews/crayon");
  fs.mkdirSync(directory, { recursive: true });
  return { root, file: path.join(directory, "example.webp") };
}

it("publishes source-free, pixel-versioned poster paths only for supported components", () => {
  const { root, file } = fixture(); fs.writeFileSync(file, "pixel-fixture");
  fs.writeFileSync(path.join(path.dirname(file), "unpublished.webp"), "draft");
  const first = stylePreviewManifest(root, { crayon: ["example"] }, { required: true });
  expect(Object.keys(first)).toEqual(["example"]);
  expect(first.example.crayon).toMatch(/^\/style-previews\/crayon\/example.webp\?v=[a-f0-9]{16}$/);
  fs.writeFileSync(file, "new-pixel-fixture");
  expect(stylePreviewManifest(root, { crayon: ["example"] })).not.toEqual(first);
});

it("rejects incomplete production coverage, empty files and paths outside the style directory", () => {
  const { root, file } = fixture();
  expect(() => stylePreviewManifest(root, { crayon: ["example"] }, { required: true })).toThrow("Missing style posters");
  expect(stylePreviewManifest(root, { crayon: ["example"] })).toEqual({});
  fs.writeFileSync(file, "");
  expect(() => stylePreviewManifest(root, { crayon: ["example"] })).toThrow("Empty style preview");
  expect(() => stylePreviewManifest(root, { "../secret": ["example"] })).toThrow("Invalid preview style");
  expect(() => stylePreviewManifest(root, { crayon: ["../secret"] })).toThrow("Invalid preview slug");
});
