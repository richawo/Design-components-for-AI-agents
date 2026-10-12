#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { showcaseCollections } from "../lib/showcase-collections.mjs";
import { conveyorVideoHash } from "./lib/conveyor-videos.mjs";
const root = path.resolve(new URL("..", import.meta.url).pathname);
const output = path.join(root, "public/conveyor-previews");
fs.mkdirSync(output, { recursive: true });
const keep = new Set();
for (const slug of new Set(showcaseCollections.flatMap(c => c.slugs))) {
  const source = path.join(root, "public/previews", `${slug}.mp4`);
  if (!fs.existsSync(source)) continue;
  const name = `${slug}.${conveyorVideoHash(fs.readFileSync(source))}.mp4`;
  keep.add(name);
  const destination = path.join(output, name);
  if (!fs.existsSync(destination)) {
    const temporary = `${destination}.tmp.mp4`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", source, "-vf", "scale=960:600:flags=lanczos", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", temporary]);
    fs.renameSync(temporary, destination);
  }
  console.log(`${slug}: ${Math.round(fs.statSync(destination).size / 1024)} KB`);
}
for (const name of fs.readdirSync(output)) if (/^[a-z0-9-]+\.[a-f0-9]{16}\.mp4$/.test(name) && !keep.has(name)) fs.unlinkSync(path.join(output, name));
