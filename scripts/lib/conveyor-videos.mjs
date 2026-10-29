import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
export const conveyorVideoHash = (bytes, { visualStyle = "original" } = {}) => createHash("sha256").update(visualStyle === "original" ? "conveyor-960-crf23-v1" : "conveyor-960-bounded-crf23-v1").update(bytes).digest("hex").slice(0, 16);
/** Build hosts need no FFmpeg. Only reference a locally prepared derivative
 * when its fingerprint agrees with the published full-size recording. */
export function conveyorVideoManifest(root, slugs, { visualStyle = "original", theme = "light", previewVersion = 2 } = {}) {
  if (!/^[a-z][a-z0-9-]*$/.test(visualStyle)) throw new Error("Invalid conveyor visual style");
  if (!["light","dark"].includes(theme)) throw new Error("Invalid conveyor theme");
  if (!Number.isSafeInteger(previewVersion) || previewVersion < 2) throw new Error("Invalid preview version");
  const styled = visualStyle !== "original";
  const suffix = styled ? previewVersion >= 3 ? `/v${previewVersion}/${theme}` : theme === "dark" ? "/dark" : "" : "";
  const sourceDir = path.join(root, "public", styled ? `style-previews/${visualStyle}${suffix}` : "previews");
  const relative = styled ? `/style-previews/${visualStyle}${suffix}/conveyor` : "/conveyor-previews";
  const result = {};
  if (!fs.existsSync(path.join(root, "public", relative))) return result;
  for (const slug of slugs.filter(s => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))) {
    const original = path.join(sourceDir, `${slug}.mp4`);
    if (!fs.existsSync(original)) continue;
    const name = `${slug}.${conveyorVideoHash(fs.readFileSync(original), { visualStyle })}.mp4`;
    if (fs.existsSync(path.join(root, "public", relative, name))) result[slug] = `${relative}/${name}`;
  }
  return result;
}
