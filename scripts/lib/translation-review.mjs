import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { LOCALES } from "../../lib/blog/locales.mjs";
import { postUnits } from "./blog-source.mjs";
import { isUntouched, protectedIntact, translationMarkupIntact } from "./translation-quality.mjs";

const hash = value => createHash("sha256").update(value).digest("hex");
export const FULL_TRANSLATION_COVERAGE = ["title", "description", "seoTitle", "seoDescription", "excerpt", "heroImageAlt", "keywords", "headings", "all-paragraphs", "lists", "all-table-cells", "faqs", "sources-checked", "technical-explanations"];

// The receipt records an actual complete linguistic review. Hashes and coverage
// make that review stale when content changes; they do not perform the reading.
export function verifyFullTranslationReviews({ base, post, translationReviews, localizedBlog }) {
  const codes = LOCALES.filter(locale => locale.code !== "en").map(locale => locale.code);
  if (!Array.isArray(translationReviews) || translationReviews.length !== codes.length || new Set(translationReviews.map(ref => ref.locale)).size !== codes.length || codes.some(code => !translationReviews.some(ref => ref.locale === code))) throw new Error("Complete full-text reviews of every language edition are required: " + post.data.slug);
  const units = postUnits(post), sourceSha256 = hash(post.raw);
  for (const locale of codes) {
    const ref = translationReviews.find(ref => ref.locale === locale);
    if (typeof ref.review !== "string" || !ref.review.startsWith("research/") || ref.review.split(/[\\/]/).includes("..") || path.isAbsolute(ref.review)) throw new Error("Translation review must stay in private research");
    const filename = path.join(base, ref.review), relative = path.relative(fs.realpathSync(base), fs.realpathSync(filename));
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Translation review escapes private research");
    const bytes = fs.readFileSync(filename), review = JSON.parse(bytes);
    const raw = localizedBlog[locale]?.[post.file];
    if (!raw || hash(bytes) !== ref.reviewSha256 || review.sourceSha256 !== sourceSha256 || review.translatedTextSha256 !== hash(raw)) throw new Error("Full translation review is stale: " + locale + "/" + post.data.slug);
    if (review.version !== 1 || review.scope !== "complete-translation-text" || review.slug !== post.data.slug || review.locale !== locale || review.status !== "pass" || review.fullTextRead !== true || review.completeCorrectedEditionReread !== true || !review.reviewer?.trim() || typeof review.nativeProfessionalReview !== "boolean" || !Number.isFinite(Date.parse(review.reviewedAt)) || !Array.isArray(review.semanticFindings) || !review.semanticFindings.length || review.semanticFindings.some(finding => typeof finding !== "string" || !finding.trim()) || !Array.isArray(review.coverage) || FULL_TRANSLATION_COVERAGE.some(field => !review.coverage.includes(field))) throw new Error("Incomplete or failed full translation review: " + locale + "/" + post.data.slug);
    const reviewed = review.unitReviews;
    if (!Array.isArray(reviewed) || reviewed.length !== units.length || new Set(reviewed.map(unit => unit.sourceUnitSha256)).size !== units.length) throw new Error("Partial full translation review: " + locale + "/" + post.data.slug);
    const dictionary = JSON.parse(fs.readFileSync(path.join(base, "i18n/strings", locale + ".json")));
    for (const source of units) {
      const target = dictionary[source], receipt = reviewed.find(unit => unit.sourceUnitSha256 === hash(source));
      if (typeof target !== "string" || !target.trim() || target.includes("\u2014") || isUntouched(source, target) || !protectedIntact(source, target) || !translationMarkupIntact(source, target)) throw new Error("Damaged reviewed translation: " + locale + "/" + post.data.slug);
      if (!receipt || receipt.verdict !== "pass" || receipt.targetSha256 !== hash(target)) throw new Error("Unreviewed or changed translation unit: " + locale + "/" + post.data.slug);
    }
  }
  return { slug: post.data.slug, editions: codes.length, unitsPerEdition: units.length };
}
