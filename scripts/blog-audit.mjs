#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBlogSource, bundleBlog, corpusUnits, readJson } from "./lib/blog-source.mjs";
import { auditBlog } from "./lib/blog-audit.mjs";
import { isUntouched } from "./lib/translation-quality.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = loadBlogSource(root);
if (!source.posts.length) {
  if (process.argv.includes("--require-source")) throw new Error("Private blog source is required");
  console.log("blog: no private source, public component-only build");
} else {
  const report = auditBlog(source);
  for (const warning of report.warnings) console.warn(`blog warning: ${warning}`);
  const bundle = bundleBlog(source);
  for (const [locale, coverage] of Object.entries(bundle.coverage)) {
    if (coverage.missing && process.argv.includes("--require-locales")) report.errors.push(`${locale}: ${coverage.missing}/${coverage.total} untranslated units`);
    if (process.argv.includes("--require-locales")) {
      const strings = readJson(path.join(source.base, "i18n", "strings", `${locale}.json`));
      const untouched = corpusUnits(source).filter((key) => strings[key] && isUntouched(key, strings[key]));
      if (untouched.length) report.errors.push(`${locale}: ${untouched.length} untranslated sentences remain: ${untouched[0].slice(0, 100)}`);
    }
  }
  if (report.errors.length) throw new Error(report.errors.join("\n"));
  console.log(`blog: ${source.posts.length} source posts, ${Object.keys(bundle.localizedBlog).length + 1}/30 complete languages, audit passed`);
}
