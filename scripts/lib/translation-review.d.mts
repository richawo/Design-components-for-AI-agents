export const FULL_TRANSLATION_COVERAGE: string[];
export function verifyFullTranslationReviews(options: {
  base: string;
  post: {file: string; raw: string; content: string; data: Record<string, unknown>};
  translationReviews: unknown;
  localizedBlog: Record<string, Record<string, string>>;
}): {slug: unknown; editions: number; unitsPerEdition: number};
