import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/** Public pixels only. The licensed material and source stay in private packs. */
export function stylePreviewManifest(root, variants, { required = false } = {}) {
  const result = {}, missing = [];
  for (const [style, slugs] of Object.entries(variants)) {
    if (!/^[a-z][a-z0-9-]*$/.test(style)) throw new Error("Invalid preview style");
    for (const slug of slugs) {
      if (!/^[a-z][a-z0-9-]*$/.test(slug)) throw new Error("Invalid preview slug");
      const relative = `/style-previews/${style}/${slug}.webp`;
      const file = path.join(root, "public", relative);
      if (!fs.existsSync(file)) { missing.push(`${style}/${slug}`); continue; }
      const bytes = fs.readFileSync(file);
      if (!bytes.length) throw new Error(`Empty style preview: ${style}/${slug}`);
      const version = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
      (result[slug] ??= {})[style] = `${relative}?v=${version}`;
    }
  }
  if (required && missing.length) throw new Error(`Missing style posters (${missing.length}): ${missing.join(", ")}. Capture them with scripts/screenshot.mjs --visual-style=${Object.keys(variants)[0]}.`);
  return result;
}
