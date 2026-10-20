import fs from "node:fs";
import path from "node:path";
import { concatFrameList } from "./recording-quality.mjs";

/** Keep rejected inputs usable after the recorder removes its working directory. */
export function preserveRejectedCapture({ reportDir, slug, candidateFile, nativeFile = undefined, frames, startTime, endTime, problems, metrics }) {
  fs.mkdirSync(reportDir, { recursive: true });
  const directory = fs.mkdtempSync(path.join(reportDir, `${slug}-rejected-`));
  fs.copyFileSync(candidateFile, path.join(directory, "candidate.mp4"));
  const nativeName = nativeFile ? `source${path.extname(nativeFile)}` : undefined;
  if (nativeFile) fs.copyFileSync(nativeFile, path.join(directory, nativeName));

  const copied = [];
  const descriptors = frames.map((frame, index) => {
    let file;
    if (frame.file) {
      const folder = path.join(directory, "frames");
      fs.mkdirSync(folder, { recursive: true });
      file = path.join(folder, `frame-${String(index).padStart(5, "0")}${path.extname(frame.file)}`);
      fs.copyFileSync(frame.file, file);
      copied.push({ ...frame, file });
    }
    return { file: file ? path.relative(directory, file) : null, t: frame.t, sourceAt: frame.sourceAt, origin: frame.origin };
  });
  if (copied.length) fs.writeFileSync(path.join(directory, "frames.txt"), concatFrameList(copied, startTime, endTime));
  fs.writeFileSync(path.join(directory, "capture.json"), JSON.stringify({
    slug, problems: [...problems], candidate: "candidate.mp4", native: nativeName,
    startTime, endTime, frames: descriptors, metrics,
  }, null, 2) + "\n");
  return directory;
}
