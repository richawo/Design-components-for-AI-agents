#!/usr/bin/env node
// Run deliberately, then review and commit the dictionaries. No runtime translation calls.
import fs from "node:fs";
import path from "node:path";
import { LOCALES } from "../lib/blog/locales.mjs";
import { loadSiteDictionary, privateSiteTranslationKeys, siteCorpus } from "./lib/site-i18n.mjs";
import { encode, escapeText, decodeEntities, SEPARATOR, splitBatch } from "./lib/translation-tokens.mjs";
import { isUntranslatable } from "./lib/translation-glossary.mjs";
import { isUntouched, protectedIntact } from "./lib/translation-quality.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const argument = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const locales = LOCALES.filter((locale) => locale.code !== "en" && (!argument("--locales") || argument("--locales").split(",").includes(locale.code)));
const { keys, ui, server } = siteCorpus(root);
const ordered = [...new Set([...ui, ...keys])];
const read = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
const save = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n"); fs.renameSync(`${file}.tmp`, file); };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let previous = 0;
let cooldown = argument("--not-before") ? Date.parse(argument("--not-before")) : 0;
const interval = Math.max(1000, Number(argument("--interval-ms")) || 1000);
const seedRoot = argument("--seed-dir");
const overrides = read(path.join(root, "content/site-i18n-overrides.json"));
const preserve = new Set(overrides._preserve ?? []);
const privateKeys = privateSiteTranslationKeys(root);
const invariant = (key) => preserve.has(key) || isUntranslatable(key) || /^#[a-f0-9]{3,8}$/i.test(key) || !/[a-zA-Z]{2,}/.test(key);
const acceptable = (key, value) => typeof value === "string" && value.length > 0 && protectedIntact(key, value) && (invariant(key) || !isUntouched(key, value));
const tokens = (text) => (text.match(/\{\{\d+\}\}/g) ?? []).sort().join("|");
const seeded = new Map();
const invalid = [];
// Seed every language up front; a rate limit in one edition must not prevent
// other editions from retaining their already reviewed Yaps translations.
for (const locale of locales) {
  const file = path.join(root, "content/site-i18n", `${locale.code}.json`);
  const { publicDictionary: old, privateOverlay } = loadSiteDictionary(root, locale.code, overrides);
  const seeds = { ...read(path.join(root, "registry/pro/_site/i18n/strings", `${locale.code}.json`)), ...(seedRoot ? read(path.join(seedRoot, `${locale.code}.json`)) : {}) };
  const dictionary = {};
  for (const key of ordered) {
    if (privateKeys.has(key)) {
      const value = privateOverlay[key];
      if (typeof value !== "string" || !value.trim() || tokens(key) !== tokens(value) || !protectedIntact(key, value)) {
        throw new Error(`Missing or invalid private site translation for ${locale.code}: ${key}`);
      }
      // Never copy a private overlay into the public dictionary. Preserve any
      // pre-existing public entry verbatim; the overlay still takes precedence.
      if (Object.hasOwn(old, key)) dictionary[key] = old[key];
      continue;
    }
    if (invariant(key)) dictionary[key] = key;
    else if (acceptable(key, old[key])) dictionary[key] = old[key];
    else if (acceptable(key, seeds[key])) dictionary[key] = seeds[key];
    if (overrides[locale.code]?.[key]) dictionary[key] = overrides[locale.code][key];
  }
  save(file, dictionary); seeded.set(locale.code, dictionary);
}
if (args.includes("--seed-only")) { console.log(`Seeded ${locales.length} language dictionaries without network requests.`); process.exit(0); }
const unit = (key) => {
  const opaque = [];
  const tokenized = encode(key.replace(/`[^`]+`|\[\d+\]/g, (value) => { opaque.push(value); return `{{${9000 + opaque.length - 1}}}`; }));
  const restoreHtml = (value) => value ? decodeEntities(value).replace(/\{\{(9\d{3})\}\}/g, (_, index) => opaque[Number(index) - 9000] ?? _) : null;
  return { text: tokenized.text, restore: (value) => restoreHtml(tokenized.restore(value)), runs: () => { const runs = tokenized.runs(); return { texts: runs.texts, rebuild: (values) => restoreHtml(runs.rebuild(values)) }; } };
};
async function request(locale, text) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const start = Math.max(Date.now(), previous + interval, cooldown);
    previous = start;
    await delay(start - Date.now());
    try {
      const url = new URL("https://translate.googleapis.com/translate_a/single");
      for (const [key, value] of Object.entries({ client: "gtx", sl: "en", tl: locale.translateAs, dt: "t", q: text })) url.searchParams.set(key, value);
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (response.status === 429) {
        const retry = response.headers.get("retry-after");
        const requested = retry ? /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now() : 0;
        const backoff = Math.min(30 * 60_000, 60_000 * 2 ** attempt);
        cooldown = Math.max(cooldown, Date.now() + Math.max(Number.isFinite(requested) ? requested : 0, backoff));
        console.log(`${new Date().toISOString()} ${locale.code}: provider rate limit; backing off for ${Math.ceil((cooldown - Date.now()) / 1000)} seconds`);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json())[0].map((part) => part[0]).join("");
    } catch (error) { if (attempt === 11) throw error; await delay(Math.min(60_000, 1000 * 2 ** attempt)); }
  }
  throw new Error(`Translation provider rate limit persists (${locale.code}); saved progress can be resumed.`);
}
async function translate(locale, texts, phase) {
  const file = path.join(root, "content/site-i18n", `${locale.code}.json`);
  const dictionary = seeded.get(locale.code);
  const missing = texts.filter((key) => !dictionary[key] && !privateKeys.has(key));
  if (!missing.length) return;
  console.log(`${locale.code}: ${missing.length}/${texts.length} ${phase} text units need translation`);
  const batches = []; let group = [], size = 0;
  for (const key of missing) {
    if (isUntranslatable(key) || !/[a-zA-Z]{2,}/.test(key)) { dictionary[key] = key; continue; }
    const encoded = unit(key);
    const encodedSize = encodeURIComponent(encoded.text + SEPARATOR).length;
    if (group.length && size + encodedSize > 12000) { batches.push(group); group = []; size = 0; }
    group.push({ key, ...encoded }); size += encodedSize;
  }
  if (group.length) batches.push(group);
  save(file, dictionary);
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];
    const parts = splitBatch(await request(locale, batch.map((item) => item.text).join(SEPARATOR)), batch.length);
    for (let at = 0; at < batch.length; at++) {
      const item = batch[at];
      let translated = parts && item.restore(parts[at]);
      if (!translated || !acceptable(item.key, translated)) translated = item.restore(await request(locale, item.text));
      if (!translated) {
        const runs = item.runs(); const texts = [];
        for (const text of runs.texts) texts.push(/[a-zA-Z]{2,}/.test(text.replace(/\[\[\[[^\]]+\]\]\]/g, "")) ? await request(locale, text) : text);
        translated = runs.rebuild(texts);
      }
      if (!translated || !acceptable(item.key, translated)) {
        invalid.push(`${locale.code}: ${item.key}`);
        console.error(`Needs review: ${locale.code}: ${item.key.slice(0, 120)}`);
        continue;
      }
      dictionary[item.key] = translated;
    }
    save(file, dictionary);
    if (index % 20 === 0 || index === batches.length - 1) console.log(`${locale.code}: batch ${index + 1}/${batches.length}; ${Object.keys(dictionary).length} saved`);
  }
}
async function translatePhase(texts, phase) {
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (cursor < locales.length) await translate(locales[cursor++], texts, phase); }));
}
// Finish the navigation, pages and catalogue in every edition before moving
// through the larger component/demo corpus. Quotas must not starve later UI.
await translatePhase([...new Set([...ui, ...server])], "site");
if (!args.includes("--ui-only")) await translatePhase(keys, "component");
if (invalid.length) { console.error(`${invalid.length} translations need review; all other progress is saved.`); process.exitCode = 1; }
