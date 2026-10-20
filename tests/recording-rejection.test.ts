import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { preserveRejectedCapture } from "../scripts/lib/rejected-capture.mjs";

describe("rejected recording evidence", () => {
  it("retains independent CDP takes and their exact source bytes after temporary cleanup", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dfa-rejection-test-"));
    try {
      const working = path.join(root, "working"), reports = path.join(root, "reports");
      fs.mkdirSync(working);
      const candidateFile = path.join(working, "candidate.mp4"), first = path.join(working, "first.jpg"), second = path.join(working, "second.jpg");
      fs.writeFileSync(candidateFile, "rejected encoded bytes");
      fs.writeFileSync(first, "first actual source bytes");
      fs.writeFileSync(second, "second actual source bytes");
      const input = { reportDir: reports, slug: "owned-fixture", candidateFile, frames: [
        { file: first, t: 1, sourceAt: .99, origin: "owned-screenshot" },
        { file: second, t: 1.02, origin: "screencast" },
      ], startTime: 1, endTime: 1.04, problems: ["source delivery exceeded 100ms"], metrics: { maxDelayMs: 120 } };
      const takes = [preserveRejectedCapture(input), preserveRejectedCapture(input)];
      expect(takes[0]).not.toBe(takes[1]);
      fs.rmSync(working, { recursive: true });
      for (const take of takes) {
        const capture = JSON.parse(fs.readFileSync(path.join(take, "capture.json"), "utf8"));
        expect(capture.problems).toEqual(input.problems);
        expect(capture.metrics).toEqual(input.metrics);
        expect(capture.frames.map((frame: { file: string }) => fs.readFileSync(path.join(take, frame.file), "utf8")))
          .toEqual(["first actual source bytes", "second actual source bytes"]);
        expect(capture.frames[0]).toMatchObject({ t: 1, sourceAt: .99, origin: "owned-screenshot" });
        expect(fs.readFileSync(path.join(take, capture.candidate), "utf8")).toBe("rejected encoded bytes");
        const concat = fs.readFileSync(path.join(take, "frames.txt"), "utf8");
        expect(concat).not.toContain(working);
        expect(concat).toContain("duration 0.020000");
      }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it("retains native source bytes and timing evidence without inventing JPEG frames", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dfa-native-rejection-test-"));
    try {
      const nativeFile = path.join(root, "raw.webm"), candidateFile = path.join(root, "candidate.mp4");
      fs.writeFileSync(nativeFile, "original native bytes"); fs.writeFileSync(candidateFile, "candidate bytes");
      const take = preserveRejectedCapture({ reportDir: path.join(root, "reports"), slug: "native-fixture", candidateFile, nativeFile,
        frames: [{ t: 1 }, { t: 1.2 }], startTime: 1, endTime: 1.3, problems: ["capture stalled"], metrics: { sourceFrames: [1, 1.2] } });
      fs.rmSync(nativeFile); fs.rmSync(candidateFile);
      const capture = JSON.parse(fs.readFileSync(path.join(take, "capture.json"), "utf8"));
      expect(fs.readFileSync(path.join(take, capture.native), "utf8")).toBe("original native bytes");
      expect(capture.frames).toEqual([{ file: null, t: 1 }, { file: null, t: 1.2 }]);
      expect(capture.metrics.sourceFrames).toEqual([1, 1.2]);
      expect(fs.existsSync(path.join(take, "frames.txt"))).toBe(false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
