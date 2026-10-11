#!/usr/bin/env node
/** Observable browser regressions. Requires the preview server and a local Chromium installation. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicCases = [
  "composer-failure",
  "composer-races",
  "code-block-probe",
  "waffle-probe",
  "new-free-probe",
  "table-probe",
  "ime-probe",
  "expansion-inputs-probe",
];
const cases = [...publicCases];
if (fs.existsSync(path.join(root, "registry/pro/devtools-webhook-inspector")))
  cases.push("webhook-probe", "focus-probe", "chart-data-probe");
if (fs.existsSync(path.join(root, "registry/pro/content-release-notes")))
  cases.push("expansion-pro-probe");
if (cases.length === publicCases.length)
  console.log(
    "Pro integration cases skipped: private sources are not checked out.",
  );
let failed = 0;
for (const name of cases) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "tests/browser", `${name}.mjs`)],
    { cwd: root, encoding: "utf8", timeout: 180000 },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    failed++;
    console.error(
      `FAIL ${name}: ${result.error?.message ?? `exit ${result.status}`}`,
    );
  } else console.log(`PASS ${name}`);
}
if (failed) process.exitCode = 1;
