import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { conveyorVideoManifest } from "./conveyor-videos.mjs";

/** Public pixels only. The licensed material and source stay in private packs. */
export function stylePreviewManifest(root, variants, { required = false } = {}) {
  const result = {}, missing = [];
  for (const [style, slugs] of Object.entries(variants)) {
    if (!/^[a-z][a-z0-9-]*$/.test(style)) throw new Error("Invalid preview style");
    const conveyor = conveyorVideoManifest(root, slugs, { visualStyle: style });
    for (const slug of slugs) {
      if (!/^[a-z][a-z0-9-]*$/.test(slug)) throw new Error("Invalid preview slug");
      const asset = extension => {
        const relative = `/style-previews/${style}/${slug}.${extension}`;
        const file = path.join(root, "public", relative);
        if (!fs.existsSync(file)) { missing.push(`${style}/${slug}.${extension}`); return null; }
        const bytes = fs.readFileSync(file);
        if (!bytes.length) throw new Error(`Empty style preview: ${style}/${slug}.${extension}`);
        const version = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
        return `${relative}?v=${version}`;
      };
      const thumb = asset("webp"), mp4 = asset("mp4");
      if (thumb) (result[slug] ??= {})[style] = { thumb, video: mp4 ? { mp4, webm: null } : null, ...(conveyor[slug] ? { conveyorVideo: { mp4: conveyor[slug], webm: null } } : {}) };
    }
  }
  if (required && missing.length) throw new Error(`Missing style preview media (${missing.length}): ${missing.join(", ")}. Capture matched recordings and posters with scripts/record-demos.mjs --visual-style=${Object.keys(variants)[0]}.`);
  return result;
}
