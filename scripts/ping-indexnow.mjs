#!/usr/bin/env node
// The verification key is intentionally served publicly. It is not an API secret.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { collectSitemapUrls } from "./lib/indexnow-sitemap.mjs";
import { deploymentMatches, notificationHttpError, retryNotification, runConfirmedNotification } from "./lib/indexnow-notification.mjs";

const { host, key } = JSON.parse(readFileSync(new URL("../lib/blog/indexnow-config.json", import.meta.url), "utf8"));
const origin = `https://${host}`;
const keyLocation = `${origin}/${key}.txt`;
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const postDeploy = args.includes("--post-deploy");

async function waitForDeployment() {
  const expected = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const requestFile = new URL('../publication/content-request.json', import.meta.url);
  const request = existsSync(requestFile) ? JSON.parse(readFileSync(requestFile, 'utf8')) : undefined;
  let last = 'No matching marker observed';
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      const response = await fetch(`${origin}/.well-known/design-build.json`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (response.ok && deploymentMatches(await response.json(), expected, request)) return;
      last = `HTTP ${response.status} or different source/request identity`;
    } catch (error) { last = error.message; }
    if (attempt < 14) await delay(8_000);
  }
  throw new Error(`The expected deployment is not verified: ${last}. Reconcile the serving marker before retrying.`);
}

async function main() {
  if (args.some((arg) => arg.startsWith("--") && !["--all", "--dry-run", "--wait-for-commit", "--post-deploy"].includes(arg))) throw new Error("Unknown option");
  if (postDeploy && !args.includes('--wait-for-commit')) throw new Error('--post-deploy requires --wait-for-commit');
  const result = await runConfirmedNotification(async () => {
    if (args.includes("--wait-for-commit") && !dryRun) await waitForDeployment();
  }, async () => {
  const sitemapFetch = async (url, options) => {
    const response = await fetch(url, options);
    if (!response.ok) throw notificationHttpError('IndexNow sitemap discovery', response);
    return response;
  };
  const input = args.includes("--all") ? await retryNotification('IndexNow sitemap discovery', () => collectSitemapUrls(`${origin}/sitemap.xml`, sitemapFetch)) : args.filter((arg) => !arg.startsWith("--"));
  const urls = [...new Set(input.map((value) => {
    const url = new URL(value);
    if (url.origin !== origin || url.hash || /\.(?:md|xml|txt)$/.test(url.pathname)) throw new Error(`Expected a canonical HTML URL on ${host}: ${value}`);
    return url.toString();
  }))];
  if (!urls.length) throw new Error("Provide URLs or --all");
  if (dryRun) { console.log(`IndexNow dry run: ${urls.length} canonical URLs on ${host}`); return {dryRun:true,urls:urls.length}; }

  await retryNotification('IndexNow public-key verification', async () => {
    const verification = await fetch(keyLocation, { redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!verification.ok) throw notificationHttpError('IndexNow public-key verification', verification);
    if ((await verification.text()).trim() !== key) throw new Error("The live IndexNow verification file is incorrect");
  });
  const batches=[];
  for (let offset = 0; offset < urls.length; offset += 10_000) {
    const batch = urls.slice(offset, offset + 10_000);
    const status = await retryNotification('IndexNow submission', async () => {
    const response = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation, urlList: batch }), signal: AbortSignal.timeout(30_000),
    });
    if (![200, 202].includes(response.status)) throw notificationHttpError('IndexNow submission', response);
    return response.status;
    });
    batches.push({urls:batch.length,status});
    console.log(`IndexNow received ${batch.length} URLs: HTTP ${status}${status === 202 ? " (key validation pending)" : ""}`);
  }
  return {urls:urls.length,batches};
  }, {allowDeferred:postDeploy&&!dryRun});
  if(postDeploy&&!dryRun)writeFileSync(new URL('../.open-next/indexnow-notification.json',import.meta.url),JSON.stringify({...result,checkedAt:new Date().toISOString()},null,2)+'\n');
  if(result.status==='deferred')console.warn(`IndexNow notification deferred: ${result.reason} ${result.publication}`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
