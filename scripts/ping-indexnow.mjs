#!/usr/bin/env node
// The verification key is intentionally served publicly. It is not an API secret.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { collectSitemapUrls } from "./lib/indexnow-sitemap.mjs";

const { host, key } = JSON.parse(readFileSync(new URL("../lib/blog/indexnow-config.json", import.meta.url), "utf8"));
const origin = `https://${host}`;
const keyLocation = `${origin}/${key}.txt`;
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

async function waitForDeployment() {
  const expected = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  for (let attempt = 0; attempt < 15; attempt++) {
    const response = await fetch(`${origin}/.well-known/design-build.json`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (response.ok && (await response.json()).publicCommit === expected) return;
    if (attempt < 14) await delay(8_000);
  }
  throw new Error("The expected deployment is not live yet. Retry blog:index after publication.");
}

async function main() {
  if (args.some((arg) => arg.startsWith("--") && !["--all", "--dry-run", "--wait-for-commit"].includes(arg))) throw new Error("Unknown option");
  if (args.includes("--wait-for-commit") && !dryRun) await waitForDeployment();
  const input = args.includes("--all") ? await collectSitemapUrls(`${origin}/sitemap.xml`) : args.filter((arg) => !arg.startsWith("--"));
  const urls = [...new Set(input.map((value) => {
    const url = new URL(value);
    if (url.origin !== origin || url.hash || /\.(?:md|xml|txt)$/.test(url.pathname)) throw new Error(`Expected a canonical HTML URL on ${host}: ${value}`);
    return url.toString();
  }))];
  if (!urls.length) throw new Error("Provide URLs or --all");
  if (dryRun) { console.log(`IndexNow dry run: ${urls.length} canonical URLs on ${host}`); return; }

  const verification = await fetch(keyLocation, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!verification.ok || (await verification.text()).trim() !== key) throw new Error("The live IndexNow verification file is missing or incorrect");
  for (let offset = 0; offset < urls.length; offset += 10_000) {
    const batch = urls.slice(offset, offset + 10_000);
    const response = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation, urlList: batch }), signal: AbortSignal.timeout(30_000),
    });
    if (![200, 202].includes(response.status)) throw new Error(`IndexNow rejected the batch: HTTP ${response.status}`);
    console.log(`IndexNow received ${batch.length} URLs: HTTP ${response.status}${response.status === 202 ? " (key validation pending)" : ""}`);
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
