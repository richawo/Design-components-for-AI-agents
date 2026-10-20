#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { LOCALES } from "../lib/blog/locales.mjs";
import { siteCorpus } from "./lib/site-i18n.mjs";
import { protectedIntact } from "./lib/translation-quality.mjs";

const root = process.cwd();
const { keys } = siteCorpus(root);
const overrides = JSON.parse(fs.readFileSync(path.join(root, "content/site-i18n-overrides.json"), "utf8"));
const tokens = (text) => (text.match(/\{\{\d+\}\}/g) ?? []).sort().join("|");
let errors = 0;
for (const locale of LOCALES.filter((language) => language.code !== "en")) {
  const file = path.join(root, "content/site-i18n", `${locale.code}.json`);
  const dictionary = { ...(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {}), ...overrides[locale.code], ...Object.fromEntries(overrides._preserve.map((key) => [key, key])) };
  const missing = keys.filter((key) => typeof dictionary[key] !== "string" || !dictionary[key].trim());
  const invalid = keys.filter((key) => typeof dictionary[key] === "string" && (tokens(key) !== tokens(dictionary[key]) || !protectedIntact(key, dictionary[key])));
  errors += missing.length + invalid.length;
  console.log(`${locale.code}: ${keys.length - missing.length}/${keys.length} translated; ${invalid.length} invalid placeholders or protected terms`);
  if (invalid.length) console.error(invalid.slice(0, 5).map((key) => `  ${key.slice(0, 120)}`).join("\n"));
}
if (errors) {
  console.error(`Site localisation is incomplete (${errors} missing or invalid units). Resume npm run site:translate, then rebuild the registry.`);
  process.exitCode = 1;
} else console.log(`Site localisation complete: ${LOCALES.length} languages, ${keys.length} text units.`);
