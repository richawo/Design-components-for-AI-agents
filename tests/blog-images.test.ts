import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { buildBlogImages } from "../scripts/lib/blog-images.mjs";
import type { BlogSource } from "../scripts/lib/blog-source.mjs";

const scratch: string[] = [];
afterEach(() => { for (const root of scratch.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-images-")); scratch.push(root);
  const base = path.join(root, "private"), assets = path.join(base, "assets");
  fs.mkdirSync(assets, { recursive: true }); fs.mkdirSync(path.join(root, "app"));
  fs.writeFileSync(path.join(root, "app/icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="white"/></svg>');
  const source: BlogSource = { base, config: {}, posts: [{ file: "guide.md", raw: "", content: "", data: { slug: "guide", heroAsset: "assets/guide.png" } }] };
  return { root, assets, source };
}

describe("private editorial visuals", () => {
  it("uses the private master for a real social image and ships only referenced body artwork", async () => {
    const { root, assets, source } = fixture();
    await sharp({ create: { width: 1600, height: 840, channels: 3, background: "#c77b52" } }).png().toFile(path.join(assets, "guide.png"));
    fs.writeFileSync(path.join(assets, "diagram.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="460"><rect width="900" height="460" fill="black"/></svg>');
    fs.writeFileSync(path.join(assets, "unpublished.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>');
    source.posts[0].content = '![Diagram](/blog-images/diagram.svg)';
    const images = await buildBlogImages(root, source);
    expect(images["/blog-images/guide.png"]).toEqual({ width: 1200, height: 630 });
    expect(images["/blog-images/guide.webp"]).toEqual({ width: 1200, height: 630 });
    expect(await sharp(path.join(root, "public/blog-images/guide.webp")).metadata()).toMatchObject({ format: "webp", width: 1200, height: 630 });
    expect(images["/blog-images/diagram.svg"]).toEqual({ width: 900, height: 460 });
    expect(fs.existsSync(path.join(root, "public/blog-images/unpublished.svg"))).toBe(false);
    const { data } = await sharp(path.join(root, "public/blog-images/guide.png")).raw().toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)]).toEqual([199, 123, 82]);
  });
  it("fails missing masters and private path escapes instead of replacing them with generic art", async () => {
    const { root, source } = fixture();
    await expect(buildBlogImages(root, source)).rejects.toThrow("Missing or out-of-scope");
    source.posts[0].data.heroAsset = "../app/icon.svg";
    await expect(buildBlogImages(root, source)).rejects.toThrow("out-of-scope");
  });
  it("does not publish unpublished draft covers", async () => {
    const { root, source } = fixture();
    source.posts[0].data.draft = true;
    const images = await buildBlogImages(root, source);
    expect(images["/blog-images/guide.png"]).toBeUndefined();
  });
});
