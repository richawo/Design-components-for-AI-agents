import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
export const conveyorVideoHash = bytes => createHash("sha256").update("conveyor-960-crf23-v1").update(bytes).digest("hex").slice(0, 16);
/** Build hosts need no FFmpeg. Only reference a locally prepared derivative
 * when its fingerprint agrees with the published full-size recording. */
export function conveyorVideoManifest(root, slugs) {
  const result = {};
  for (const slug of slugs.filter(s => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))) {
    const original = path.join(root, "public/previews", `${slug}.mp4`);
    if (!fs.existsSync(original)) continue;
    const name = `${slug}.${conveyorVideoHash(fs.readFileSync(original))}.mp4`;
    if (fs.existsSync(path.join(root, "public/conveyor-previews", name))) result[slug] = `/conveyor-previews/${name}`;
  }
  return result;
}
