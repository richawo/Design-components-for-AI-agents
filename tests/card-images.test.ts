import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, expect, it } from "vitest";
import { buildCardImages } from "../scripts/lib/card-images.mjs";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
async function fixture(width = 1280) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-images-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "public/previews"), { recursive: true });
  const source = path.join(root, "public/previews/example.webp");
  const data = Buffer.alloc(width * 160 * 3);
  let seed = 42;
  for (let i = 0; i < data.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    data[i] = seed & 255;
  }
  await sharp(data, { raw: { width, height: 160, channels: 3 } }).webp({ lossless: true }).toFile(source);
  return { root, source, output: path.join(root, "public/card-previews") };
}

it("ships smaller candidates with real dimensions and preserves the original", async () => {
  const { root, source, output } = await fixture();
  const original = fs.readFileSync(source);
  const result = await buildCardImages(root, ["example.webp"]);
  expect(result["example.webp"]).toContain("/previews/example.webp 1280w");
  for (const width of [480, 768]) {
    const file = fs.readdirSync(output).find(f => f.endsWith(`.${width}.webp`))!;
    expect(result["example.webp"]).toContain(`${file} ${width}w`);
    expect(await sharp(path.join(output, file)).metadata()).toMatchObject({ width, height: width * 160 / 1280 });
    expect(fs.statSync(path.join(output, file)).size).toBeLessThan(original.length * .95);
  }
  expect(fs.readFileSync(source).equals(original)).toBe(true);
});

it("reuses unchanged assets, repairs missing derivatives and changes URLs for new pixels", async () => {
  const { root, source, output } = await fixture();
  const first = await buildCardImages(root, ["example.webp"]);
  const file = path.join(output, fs.readdirSync(output)[0]);
  fs.utimesSync(file, 1, 1);
  expect(await buildCardImages(root, ["example.webp"])).toEqual(first);
  expect(fs.statSync(file).mtimeMs).toBe(1000);
  fs.unlinkSync(file);
  expect(await buildCardImages(root, ["example.webp"])).toEqual(first);
  expect(fs.existsSync(file)).toBe(true);
  const changed = await sharp(source).negate().webp({ lossless: true }).toBuffer();
  fs.writeFileSync(source, changed);
  expect(await buildCardImages(root, ["example.webp"])).not.toEqual(first);
  expect(fs.existsSync(file)).toBe(false);
});

it("never enlarges small originals or publishes out-of-scope paths", async () => {
  const { root, output } = await fixture(320);
  expect(await buildCardImages(root, ["example.webp", "../../secret.webp"])).toEqual({});
  expect(fs.readdirSync(output)).toEqual([]);
});
