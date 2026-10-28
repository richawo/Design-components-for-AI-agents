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
  return { root, file: path.join(directory, "example.webp"), recording: path.join(directory, "example.mp4") };
}

it("publishes matched, independently versioned posters and recordings only for supported components", () => {
  const { root, file, recording } = fixture(); fs.writeFileSync(file, "pixel-fixture");
  fs.writeFileSync(recording, "recording-fixture");
  fs.writeFileSync(path.join(path.dirname(file), "unpublished.webp"), "draft");
  const first = stylePreviewManifest(root, { crayon: ["example"] }, { required: true });
  expect(Object.keys(first)).toEqual(["example"]);
  expect(first.example.crayon.thumb).toMatch(/^\/style-previews\/crayon\/example.webp\?v=[a-f0-9]{16}$/);
  expect(first.example.crayon.video?.mp4).toMatch(/^\/style-previews\/crayon\/example.mp4\?v=[a-f0-9]{16}$/);
  fs.writeFileSync(file, "new-pixel-fixture");
  const second = stylePreviewManifest(root, { crayon: ["example"] });
  expect(second.example.crayon.thumb).not.toEqual(first.example.crayon.thumb);
  expect(second.example.crayon.video).toEqual(first.example.crayon.video);
  fs.writeFileSync(recording, "new-recording-fixture");
  const third = stylePreviewManifest(root, { crayon: ["example"] });
  expect(third.example.crayon.thumb).toEqual(second.example.crayon.thumb);
  expect(third.example.crayon.video).not.toEqual(second.example.crayon.video);
});

it("rejects incomplete production coverage, empty files and paths outside the style directory", () => {
  const { root, file, recording } = fixture();
  expect(() => stylePreviewManifest(root, { crayon: ["example"] }, { required: true })).toThrow("Missing style preview media");
  expect(stylePreviewManifest(root, { crayon: ["example"] })).toEqual({});
  fs.writeFileSync(file, "pixel-fixture");
  expect(() => stylePreviewManifest(root, { crayon: ["example"] }, { required: true })).toThrow("crayon/example.mp4");
  fs.writeFileSync(recording, "");
  expect(() => stylePreviewManifest(root, { crayon: ["example"] })).toThrow("Empty style preview: crayon/example.mp4");
  fs.writeFileSync(file, "");
  expect(() => stylePreviewManifest(root, { crayon: ["example"] })).toThrow("Empty style preview");
  expect(() => stylePreviewManifest(root, { "../secret": ["example"] })).toThrow("Invalid preview style");
  expect(() => stylePreviewManifest(root, { crayon: ["../secret"] })).toThrow("Invalid preview slug");
});

it("keeps both themes versioned independently and requires complete dark recordings before publication",()=>{
 const{root,file,recording}=fixture();fs.writeFileSync(file,"light-pixels");fs.writeFileSync(recording,"light-movie");
 expect(()=>stylePreviewManifest(root,{crayon:["example"]},{required:true,themes:["light","dark"]})).toThrow('crayon/dark/example.mp4');
 const dark=path.join(path.dirname(file),"dark");fs.mkdirSync(dark);fs.writeFileSync(path.join(dark,"example.webp"),"dark-pixels");fs.writeFileSync(path.join(dark,"example.mp4"),"dark-movie");
 const media=stylePreviewManifest(root,{crayon:["example"]},{required:true,themes:["light","dark"]}).example.crayon;
 expect(media.themes?.dark?.video?.mp4).toMatch(/^\/style-previews\/crayon\/dark\/example.mp4\?v=[a-f0-9]{16}$/);
 expect(media.thumb).not.toContain('/dark/');
 fs.writeFileSync(path.join(dark,"example.mp4"),"new-dark-movie");
 const updated=stylePreviewManifest(root,{crayon:["example"]},{required:true,themes:["light","dark"]}).example.crayon;
 expect(updated.video).toEqual(media.video);expect(updated.themes?.dark?.thumb).toEqual(media.themes?.dark?.thumb);expect(updated.themes?.dark?.video).not.toEqual(media.themes?.dark?.video);
});
