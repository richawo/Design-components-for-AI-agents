import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { conveyorVideoHash, conveyorVideoManifest } from "../scripts/lib/conveyor-videos.mjs";
it("only publishes a derivative matching the original recording", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "conveyor-video-"));
  try {
    fs.mkdirSync(path.join(root, "public/previews"), { recursive: true });
    fs.mkdirSync(path.join(root, "public/conveyor-previews"));
    const master = path.join(root, "public/previews/example.mp4");
    const bytes = Buffer.from("original recording");
    fs.writeFileSync(master, bytes);
    const name = `example.${conveyorVideoHash(bytes)}.mp4`;
    expect(conveyorVideoManifest(root, ["example", "../outside"])).toEqual({});
    fs.writeFileSync(path.join(root, "public/conveyor-previews", name), "encoded derivative");
    expect(conveyorVideoManifest(root, ["example"])).toEqual({ example: `/conveyor-previews/${name}` });
    fs.writeFileSync(master, "new recording");
    expect(conveyorVideoManifest(root, ["example"])).toEqual({});
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
