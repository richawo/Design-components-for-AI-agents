import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createHash} from "node:crypto";
import matter from "gray-matter";
import {afterEach, describe, expect, it} from "vitest";
import {LOCALES} from "../lib/blog/locales.mjs";
import {postUnits} from "../scripts/lib/blog-source.mjs";
import {FULL_TRANSLATION_COVERAGE, verifyFullTranslationReviews} from "../scripts/lib/translation-review.mjs";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, {recursive: true, force: true}); });
function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "dfa-language-review-")); roots.push(base);
  const raw = '---\nslug: test-guide\ntitle: Private registry guide\n---\nInspect <a href="/docs">the guide</a> before using `test-value`.\n';
  const post = {raw, file: "test-guide.md", ...matter(raw)}, units = postUnits(post);
  const localizedBlog: Record<string, Record<string, string>> = {};
  const references: Array<{locale: string; review: string; reviewSha256: string}> = [];
  const reviews: Record<string, any> = {};
  const save = (locale: string) => {
    const ref = references.find(ref => ref.locale === locale)!;
    const bytes = JSON.stringify(reviews[locale]); fs.writeFileSync(path.join(base, ref.review), bytes); ref.reviewSha256 = hash(bytes);
  };
  fs.mkdirSync(path.join(base, "research")); fs.mkdirSync(path.join(base, "i18n/strings"), {recursive: true});
  for (const {code} of LOCALES.filter(locale => locale.code !== "en")) {
    // Synthetic receipt fixtures test binding and coverage, not language quality.
    const dictionary = Object.fromEntries(units.map(source => [source, source.includes("href=") ? 'Consultez <a href="/docs">le guide</a> avant d’utiliser {{0}}.' : 'Guide du registre privé']));
    fs.writeFileSync(path.join(base, "i18n/strings", code + ".json"), JSON.stringify(dictionary));
    const translated = JSON.stringify(dictionary); localizedBlog[code] = {[post.file]: translated};
    references.push({locale: code, review: "research/" + code + ".json", reviewSha256: ""});
    reviews[code] = {version: 1, scope: "complete-translation-text", locale: code, slug: "test-guide", sourceSha256: hash(raw), translatedTextSha256: hash(translated), reviewedAt: "2026-10-25T12:00:00Z", reviewer: "Synthetic reviewer fixture", nativeProfessionalReview: false, fullTextRead: true, completeCorrectedEditionReread: true, coverage: FULL_TRANSLATION_COVERAGE, semanticFindings: ["Synthetic complete-reading receipt used only for validation tests."], status: "pass", unitReviews: units.map(source => ({sourceUnitSha256: hash(source), targetSha256: hash(dictionary[source]), verdict: "pass"}))};
    save(code);
  }
  const verify = () => verifyFullTranslationReviews({base, post, translationReviews: references, localizedBlog});
  return {base, post, units, localizedBlog, references, reviews, save, verify};
}

describe("complete translation review publication gate", () => {
  it("accepts exact full-edition and unit coverage for every additional locale", () => {
    expect(fixture().verify().editions).toBe(LOCALES.length - 1);
  });
  it("rejects a missing or duplicated language even when the count appears complete", () => {
    const f = fixture(); f.references.pop(); expect(f.verify).toThrow("every language");
    const g = fixture(); g.references[1] = g.references[0]; expect(g.verify).toThrow("every language");
  });
  it("rejects changed English, rendered translation or an altered unsealed receipt", () => {
    const f = fixture(); f.post.raw += "Changed source"; expect(f.verify).toThrow("stale");
    const g = fixture(); g.localizedBlog.es[g.post.file] += "Changed translation"; expect(g.verify).toThrow("stale");
    const h = fixture(); fs.appendFileSync(path.join(h.base, h.references[0].review), " "); expect(h.verify).toThrow("stale");
  });
  it.each(["missing-unit", "duplicate-unit", "failed-unit", "changed-unit"])("rejects %s after resealing the receipt", fault => {
    const f = fixture(), review = f.reviews.es;
    if (fault === "missing-unit") review.unitReviews.pop();
    if (fault === "duplicate-unit") review.unitReviews[1] = review.unitReviews[0];
    if (fault === "failed-unit") review.unitReviews[0].verdict = "fail";
    if (fault === "changed-unit") review.unitReviews[0].targetSha256 = "0".repeat(64);
    f.save("es"); expect(f.verify).toThrow(/Partial|Unreviewed/);
  });
  it.each(["status", "fullTextRead", "completeCorrectedEditionReread", "coverage", "semanticFindings"])("rejects incomplete %s despite a valid file hash", field => {
    const f = fixture(); f.reviews.es[field] = field === "status" ? "fail" : field === "coverage" || field === "semanticFindings" ? [] : false;
    f.save("es"); expect(f.verify).toThrow("Incomplete or failed");
  });
  it("rejects changed dictionary units even when a stale rendered hash is supplied", () => {
    const f = fixture(), file = path.join(f.base, "i18n/strings/es.json"), dictionary = JSON.parse(fs.readFileSync(file, "utf8"));
    dictionary[f.units[0]] = 'Consultez <a href="/docs">une autre page</a> avant d’utiliser {{0}}.';
    fs.writeFileSync(file, JSON.stringify(dictionary)); expect(f.verify).toThrow("changed translation unit");
  });
  it("rejects damaged markup even when its unit receipt is resealed", () => {
    for (const target of ['Consultez <a href="/docs"></a> le guide avant d’utiliser {{0}}.', 'Consultez <a href="/wrong">le guide</a> avant d’utiliser {{0}}.', 'Consultez <a href="/docs">le guide</a> avant d’utiliser {{0}} {{0}}.']) {
      const f = fixture(), file = path.join(f.base, "i18n/strings/es.json"), dictionary = JSON.parse(fs.readFileSync(file, "utf8"));
      dictionary[f.units[0]] = target; fs.writeFileSync(file, JSON.stringify(dictionary));
      f.reviews.es.unitReviews[0].targetSha256 = hash(target); f.save("es"); expect(f.verify).toThrow("Damaged reviewed translation");
    }
  });
  it("rejects a receipt outside private research", () => {
    const f = fixture(); f.references[0].review = "research/../../outside.json"; expect(f.verify).toThrow("private research");
  });
});
