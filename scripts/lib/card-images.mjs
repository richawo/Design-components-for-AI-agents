import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const WIDTHS = [480, 768];
const RECIPE = "card-webp-v1-quality90";

/** Build small, content-addressed gallery posters. Originals remain the
 * full-resolution candidate and live-preview fallback. Registry's build lock
 * serialises callers, and each generated asset is replaced atomically. */
export async function buildCardImages(root, names) {
  const output = path.join(root, "public", "card-previews");
  const cacheFile = path.join(root, "registry", "__generated__", "card-images.json");
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheFile, "utf8")); } catch {}
  const next = {}, sources = {};
  const files = names.filter(name => /^[a-z0-9][a-z0-9-]*\.webp$/.test(name));
  let cursor = 0;
  async function buildNext() {
    while (cursor < files.length) {
      const name = files[cursor++];
      const original = fs.readFileSync(path.join(root, "public", "previews", name));
      const hash = createHash("sha256").update(RECIPE).update(original).digest("hex").slice(0, 16);
      let entry = cache[name];
      if (entry?.hash !== hash || !entry.variants?.every(v => fs.existsSync(path.join(output, v.name)))) {
        const { width } = await sharp(original).metadata();
        if (!width) throw new Error(`Poster has no width: ${name}`);
        entry = { hash, width, variants: [] };
        for (const target of WIDTHS.filter(w => w < width)) {
          const bytes = await sharp(original).resize({ width: target, withoutEnlargement: true }).webp({ quality: 90, effort: 4 }).toBuffer();
          // An unusually simple full-size image can already be smaller.
          if (bytes.length >= original.length * .95) continue;
          const file = `${name.slice(0, -5)}.${hash}.${target}.webp`;
          const destination = path.join(output, file);
          fs.writeFileSync(`${destination}.tmp`, bytes);
          fs.renameSync(`${destination}.tmp`, destination);
          entry.variants.push({ name: file, width: target });
        }
      }
      next[name] = entry;
      if (entry.variants.length) sources[name] = [...entry.variants.map(v => `/card-previews/${v.name} ${v.width}w`), `/previews/${name} ${entry.width}w`].join(", ");
    }
  }
  // Bound encoder work in both local development and the deployment builder.
  await Promise.all(Array.from({ length: 4 }, buildNext));
  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
  const json = JSON.stringify(sorted);
  if (!fs.existsSync(cacheFile) || fs.readFileSync(cacheFile, "utf8") !== json) {
    fs.writeFileSync(`${cacheFile}.tmp`, json);
    fs.renameSync(`${cacheFile}.tmp`, cacheFile);
  }
  // Only this ignored build directory is owned by the generator.
  const keep = new Set(Object.values(next).flatMap(e => e.variants.map(v => v.name)));
  for (const file of fs.readdirSync(output)) if (/^[a-z0-9-]+\.[a-f0-9]{16}\.(480|768)\.webp$/.test(file) && !keep.has(file)) fs.unlinkSync(path.join(output, file));
  return Object.fromEntries(Object.entries(sources).sort(([a], [b]) => a.localeCompare(b)));
}
