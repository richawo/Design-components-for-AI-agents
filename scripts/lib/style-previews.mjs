import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { conveyorVideoManifest } from "./conveyor-videos.mjs";

/** Public pixels only. The licensed material and source stay in private packs. */
export function stylePreviewManifest(root, variants, { required = false, themes = ["light"], previewVersion = 2 } = {}) {
  if (themes.some(theme => !["light", "dark"].includes(theme))) throw new Error("Invalid preview theme");
  if (!Number.isSafeInteger(previewVersion) || previewVersion < 2) throw new Error("Invalid preview version");
  const result = {}, missing = [];
  for (const [style, slugs] of Object.entries(variants)) {
    if (!/^[a-z][a-z0-9-]*$/.test(style)) throw new Error("Invalid preview style");
    const conveyors = Object.fromEntries(["light", "dark"].map(theme => [theme, conveyorVideoManifest(root, slugs, { visualStyle: style, theme, previewVersion })]));
    for (const slug of slugs) {
      if (!/^[a-z][a-z0-9-]*$/.test(slug)) throw new Error("Invalid preview slug");
      const material = theme => {
        const suffix = previewVersion >= 3 ? `/v${previewVersion}/${theme}` : theme === "dark" ? "/dark" : "";
        const asset = extension => {
          const relative = `/style-previews/${style}${suffix}/${slug}.${extension}`;
          const file = path.join(root, "public", relative);
          if (!fs.existsSync(file)) { if (themes.includes(theme)) missing.push(`${style}${suffix}/${slug}.${extension}`); return null; }
          const bytes = fs.readFileSync(file);
          if (!bytes.length) throw new Error(`Empty style preview: ${style}${suffix}/${slug}.${extension}`);
          const version = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
          return `${relative}?v=${version}`;
        };
        const thumb = asset("webp"), mp4 = asset("mp4"), conveyor = conveyors[theme][slug];
        return thumb ? { thumb, video: mp4 ? { mp4, webm: null } : null, ...(conveyor ? { conveyorVideo: { mp4: conveyor, webm: null } } : {}) } : null;
      };
      const light = material("light"), dark = material("dark");
      if (light) (result[slug] ??= {})[style] = { ...light, ...(dark ? { themes: { dark } } : {}) };
    }
  }
  if (required && missing.length) throw new Error(`Missing style preview media (${missing.length}): ${missing.join(", ")}. Capture matched recordings and posters with scripts/record-demos.mjs --visual-style=${Object.keys(variants)[0]}.`);
  return result;
}
