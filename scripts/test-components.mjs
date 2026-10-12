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
  "tabs-geometry-probe",
  "tooltip-arrival-probe",
  "pagination-motion-probe",
  "announcement-transition-probe",
  "navigation-surface-probe",
  "otp-acknowledgement-probe",
  "invitation-acknowledgement",
  "unconfigured-action-probe",
  "native-empty-data-probe",
  "table-probe",
  "ime-probe",
  "expansion-inputs-probe",
  "demo-editing-probe",
  "demo-transition-targets",
  "preview-cascade-probe",
  "pixel-microphone-lifecycle",
  "catalogue-empty-recovery",
  "mobile-accessibility-probe",
  "terminal-scroll-probe",
  "component-pages-probe",
  "settings-composition-probe",
];
const cases = [...publicCases];
if (fs.existsSync(path.join(root, "registry/pro/block-saas-dashboard")))
  cases.push(
    "blocks-probe",
    "blocks-pages-probe",
    "workspace-panels-probe",
    "blocks-replay-probe",
  );
if (fs.existsSync(path.join(root, "registry/pro/collab-call-stage")))
  cases.push("call-stage-states");
if (fs.existsSync(path.join(root, "registry/pro/media-audio-transport")))
  cases.push("audio-player-states");
if (fs.existsSync(path.join(root, "registry/pro/saas-customer-health")))
  cases.push("pro-50-demo-probe", "audit-trail-polish-probe");
if (fs.existsSync(path.join(root, "registry/pro/commerce-promotion-builder")))
  cases.push("pro-native-themes-probe");
if (fs.existsSync(path.join(root, "registry/pro/scroll-expanding-mosaic")))
  cases.push("pro-scroll-probe");
if (fs.existsSync(path.join(root, "registry/pro/devtools-webhook-inspector")))
  cases.push("webhook-probe", "focus-probe", "chart-data-probe");
if (fs.existsSync(path.join(root, "registry/pro/data-kanban-compact")))
  cases.push("expansion-pro-probe", "kanban-polish-probe");
if (fs.existsSync(path.join(root, "registry/pro/bento-grid")))
  cases.push("bento-rhythm-probe");
if (fs.existsSync(path.join(root, "registry/pro/data-query-builder")))
  cases.push("pro-industry-probe", "pro-demo-probe", "pro-select-polish-probe");
if (fs.existsSync(path.join(root, "registry/pro/agent-plan-steps")))
  cases.push("demo-native-interactions");
if (fs.existsSync(path.join(root, "registry/pro/chart-revenue-trend")))
  cases.push("revenue-history-probe");
if (
  fs.existsSync(path.join(root, "registry/pro/commerce-operations-dashboard"))
)
  cases.push("pro-50-commerce-probe");
if (
  fs.existsSync(path.join(root, "registry/pro/fashion-merchandising-dashboard"))
)
  cases.push("pro-50-fashion-probe");
if (fs.existsSync(path.join(root, "registry/pro/finance-cashflow-dashboard")))
  cases.push("pro-50-finance-probe");
if (fs.existsSync(path.join(root, "registry/pro/hr-people-dashboard")))
  cases.push("pro-50-hr-probe");
if (fs.existsSync(path.join(root, "registry/pro/legal-matter-dashboard")))
  cases.push("pro-50-legal-probe");
if (fs.existsSync(path.join(root, "registry/pro/saas-workspace-dashboard")))
  cases.push("pro-50-saas-probe");
if (cases.length === publicCases.length)
  console.log(
    "Pro integration cases skipped: private sources are not checked out.",
  );
let failed = 0;
for (const name of cases) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "tests/browser", `${name}.mjs`)],
    {
      cwd: root,
      encoding: "utf8",
      timeout: ["pro-50-demo-probe", "pro-select-polish-probe"].includes(name)
        ? 900000
        : name === "component-pages-probe"
          ? 300000
          : 180000,
    },
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
console.log(`${cases.length - failed}/${cases.length} browser suites passed.`);
if (failed) process.exitCode = 1;
