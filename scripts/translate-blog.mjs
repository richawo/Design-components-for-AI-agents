#!/usr/bin/env node
// The same provider and token protection used by Post Yaps and yaps.ai.
// Translations and stable slugs are written only into the private checkout.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES } from "../lib/blog/locales.mjs";
import { loadBlogSource, corpusUnits, readJson, stableSlugs } from "./lib/blog-source.mjs";
import { encode, SEPARATOR, splitBatch } from "./lib/translation-tokens.mjs";
import { isUntouched, protectedIntact, translationMarkupIntact } from "./lib/translation-quality.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = loadBlogSource(root);
if (!source.posts.length) throw new Error("Sync the private repository before translating the blog.");
const args = process.argv.slice(2);
const flag = (name) => args[args.indexOf(name) + 1];
const wanted = args.includes("--locales") ? flag("--locales").split(",") : null;
const locales = LOCALES.filter((l) => l.code !== "en" && (!wanted || wanted.includes(l.code)));
if (wanted && locales.length !== wanted.length) throw new Error("Unknown or duplicate locale");
const keys = corpusUnits(source);
const seedDir = args.includes("--seed-dir") ? flag("--seed-dir") : null;
const dryRun = args.includes("--dry-run");
const workers = args.includes("--workers") ? Number(flag("--workers")) : 2;
const intervalMs = args.includes("--interval-ms") ? Number(flag("--interval-ms")) : 350;
if (!Number.isInteger(workers) || workers < 1 || workers > 2) throw new Error("--workers must be 1 or 2");
if (!Number.isInteger(intervalMs) || intervalMs < 350 || intervalMs > 60_000) throw new Error("--interval-ms must be between 350 and 60000");
const houseStyle = (text) => text.replace(/\s*\u2014\s*/g, ": ");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const save = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(temp, file);
};
let lastRequest = 0;

async function request(locale, text) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(Math.max(0, lastRequest + intervalMs - Date.now()));
    lastRequest = Date.now();
    try {
      const url = new URL("https://translate.googleapis.com/translate_a/single");
      for (const [key, value] of Object.entries({ client: "gtx", sl: "en", tl: locale.translateAs, dt: "t", q: text })) url.searchParams.set(key, value);
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      return body[0].map((part) => part[0]).join(/^(ja|zh)/.test(locale.code) ? "" : " ");
    } catch (error) {
      if (attempt === 4) throw error;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

async function translatedUnit(locale, key, reply) {
  const encoded = encode(key);
  let restored = reply ? encoded.restore(reply) : null;
  if (!restored || isUntouched(key, restored) || (!protectedIntact(key, restored) || !translationMarkupIntact(key, restored))) {
    restored = encoded.restore(await request(locale, encoded.text));
  }
  if (!restored || isUntouched(key, restored) || (!protectedIntact(key, restored) || !translationMarkupIntact(key, restored))) {
    // Markup never leaves in this fallback, so the provider cannot lose tags.
    const runs = encoded.runs();
    const texts = [];
    for (const text of runs.texts) texts.push(/\p{L}{2,}/u.test(text.replace(/\[\[\[[^\]]+\]\]\]/g, "")) ? await request(locale, text) : text);
    restored = runs.rebuild(texts);
  }
  if (!restored || isUntouched(key, restored) || (!protectedIntact(key, restored) || !translationMarkupIntact(key, restored)) || /\[\[\[|\]\]\]/.test(restored)) throw new Error(`Invalid translation (${locale.code}): ${key.slice(0, 80)}`);
  return houseStyle(restored);
}

async function translateLocale(locale) {
  const file = path.join(source.base, "i18n", "strings", `${locale.code}.json`);
  const old = readJson(file);
  const seed = seedDir ? readJson(path.join(seedDir, `${locale.code}.json`)) : {};
  const strings = {};
  for (const key of keys) {
    const saved = old[key] ?? seed[key];
    if (saved && !isUntouched(key, saved) && protectedIntact(key, saved) && translationMarkupIntact(key, saved)) strings[key] = houseStyle(saved);
  }
  const missing = keys.filter((key) => !strings[key]);
  console.log(`${locale.code}: ${missing.length} of ${keys.length} units need translation`);
  if (dryRun) return;
  const batches = [];
  let batch = [], size = 0;
  for (const key of missing) {
    const text = encode(key).text;
    if (batch.length && size + text.length > 2800) { batches.push(batch); batch = []; size = 0; }
    batch.push({ key, text }); size += text.length + SEPARATOR.length;
  }
  if (batch.length) batches.push(batch);
  for (const group of batches) {
    const reply = await request(locale, group.map((item) => item.text).join(SEPARATOR));
    const parts = splitBatch(reply, group.length);
    for (let index = 0; index < group.length; index++) strings[group[index].key] = await translatedUnit(locale, group[index].key, parts?.[index]);
    save(file, strings); // Resumable checkpoints never leave the private repo.
  }
  const slugFile = path.join(source.base, "i18n", "slugs", `${locale.code}.json`);
  save(slugFile, stableSlugs(source, locale, strings, readJson(slugFile)));
  console.log(`${locale.code}: complete, ${keys.length} translated units; published slugs preserved`);
}

let cursor = 0;
await Promise.all(Array.from({ length: workers }, async () => {
  while (cursor < locales.length) await translateLocale(locales[cursor++]);
}));
