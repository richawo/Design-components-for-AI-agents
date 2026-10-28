#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { showcaseCollections } from "../lib/showcase-collections.mjs";
import { conveyorVideoHash } from "./lib/conveyor-videos.mjs";
const root = path.resolve(new URL("..", import.meta.url).pathname);
const visualStyle = process.argv.find(arg => arg.startsWith("--visual-style="))?.slice("--visual-style=".length) ?? "original";
const styled = visualStyle !== "original";
const catalogue = styled ? JSON.parse(fs.readFileSync(path.join(root, "registry/__generated__/index.json"), "utf8")) : [];
if (styled && !catalogue.some(entry => entry.visualStyles?.includes(visualStyle))) throw new Error("Unknown visual style");
const sourceDir = path.join(root, "public", styled ? `style-previews/${visualStyle}` : "previews");
const output = path.join(root, "public", styled ? `style-previews/${visualStyle}/conveyor` : "conveyor-previews");
fs.mkdirSync(output, { recursive: true });
const keep = new Set();
for (const slug of new Set(showcaseCollections.flatMap(c => c.slugs))) {
  const source = path.join(sourceDir, `${slug}.mp4`);
  if (!fs.existsSync(source)) continue;
  const name = `${slug}.${conveyorVideoHash(fs.readFileSync(source), { visualStyle })}.mp4`;
  const destination = path.join(output, name);
  if (!fs.existsSync(destination)) {
    const temporary = `${destination}.tmp.mp4`;
    let crf = 23;
    for (;;) {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", source, "-vf", "scale=960:600:flags=lanczos", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", temporary]);
      if (!styled || fs.statSync(temporary).size <= fs.statSync(source).size || crf >= 30) break;
      crf = Math.min(30, crf + 2);
    }
    if (styled && fs.statSync(temporary).size > fs.statSync(source).size) {
      fs.unlinkSync(temporary);
      console.log(`${slug}: keeping the full-size take within the normal decoder budget`);
      continue;
    }
    fs.renameSync(temporary, destination);
  }
  keep.add(name);
  console.log(`${slug}: ${Math.round(fs.statSync(destination).size / 1024)} KB`);
}
for (const name of fs.readdirSync(output)) if (/^[a-z0-9-]+\.[a-f0-9]{16}\.mp4$/.test(name) && !keep.has(name)) fs.unlinkSync(path.join(output, name));
