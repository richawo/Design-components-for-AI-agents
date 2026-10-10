// One way for the scripts to start Chromium, wherever they run:
//   1. $CHROMIUM_PATH, if set;
//   2. the CI image's browsers in /opt/pw-browsers;
//   3. Playwright's own download for this playwright-core version;
//   4. failing that, the newest Chromium already in the local Playwright cache
//      (a version bump otherwise breaks every script until someone downloads it).
//      Full builds win over chrome-headless-shell: the old headless shell
//      starves animation frames while a mouse button is held, so holds and
//      drags never finish in recordings.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

function fromCi() {
  const root = "/opt/pw-browsers";
  if (!fs.existsSync(root)) return undefined;
  for (const d of fs.readdirSync(root)) {
    for (const rel of ["chrome-linux/chrome", "chrome-linux64/chrome"]) {
      const p = path.join(root, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

function fromCache() {
  const caches = [path.join(os.homedir(), "Library/Caches/ms-playwright"), path.join(os.homedir(), ".cache/ms-playwright")].filter((d) => fs.existsSync(d));
  const found = [];
  for (const c of caches) {
    for (const d of fs.readdirSync(c)) {
      const m = /^chromium(_headless_shell)?-(\d+)$/.exec(d);
      if (!m) continue;
      for (const rel of [
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium",
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        "chrome-linux/chrome",
        "chrome-linux64/chrome",
        "chrome-headless-shell-mac-arm64/chrome-headless-shell",
        "chrome-headless-shell-mac-x64/chrome-headless-shell",
        "chrome-headless-shell-linux64/chrome-headless-shell",
      ]) {
        const p = path.join(c, d, rel);
        if (fs.existsSync(p)) found.push({ p, v: Number(m[2]) - (m[1] ? 1e6 : 0) });
      }
    }
  }
  return found.sort((a, b) => b.v - a.v)[0]?.p;
}

export async function launchChromium() {
  const explicit = process.env.CHROMIUM_PATH || fromCi();
  if (explicit) return chromium.launch({ executablePath: explicit, args: ARGS });
  try {
    // The full build in new-headless mode, not the headless shell (see above).
    return await chromium.launch({ channel: "chromium", args: ARGS });
  } catch (e) {
    const cached = fromCache();
    if (!cached || !/Executable doesn't exist/.test(String(e))) throw e;
    return chromium.launch({ executablePath: cached, args: ARGS });
  }
}
