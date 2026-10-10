import { GLOSSARY_PATTERN } from "./translation-glossary.mjs";
import { decodeEntities, PROTECTED } from "./translation-tokens.mjs";

/** Checks on translations, kept apart from translate.ts so tests can import them without starting a run. */

const plainText = (html        ) =>
  decodeEntities(html.replace(/<[^>]*>/g, " ").replace(/\{\{\d+\}\}|\{\w+\}/g, " ")).replace(GLOSSARY_PATTERN, " ");
const words = (html        ) => plainText(html).toLowerCase().match(/\p{L}{4,}/gu) ?? [];

/** Any three consecutive English words that survive verbatim. */
function sharesEnglishRun(source        , translated        )          {
  const english = plainText(source).toLowerCase().match(/\p{L}{2,}/gu) ?? [];
  const reply = ` ${(plainText(translated).toLowerCase().match(/\p{L}{2,}/gu) ?? []).join(" ")} `;
  for (let at = 0; at + 3 <= english.length; at++) if (reply.includes(` ${english.slice(at, at + 3).join(" ")} `)) return true;
  return false;
}

/** True when a reply still carries most of the English words: a batch that came back partly untouched. */
export function looksUntranslated(source        , translated        )          {
  const english = words(source);
  const reply = words(translated);
  // A short heading that came back word for word is untouched; one word ("Guides") may be a cognate.
  if (english.length < 4) return english.length >= 2 && english.join(" ") === reply.join(" ");
  const replySet = new Set(reply);
  return english.filter((word) => replySet.has(word)).length / english.length >= 0.5 || sharesEnglishRun(source, translated);
}

/** True when a reply is the English source word for word: what the endpoint returns while it throttles. */
export function isUntouched(source        , translated        )          {
  const squash = (value        ) => value.replace(/\s+/g, "");
  // A short label can legitimately stay English ("Image resizer" in Swedish,
  // "Brand team" in Danish); only a sentence handed back whole is a refusal.
  return words(source).length >= 4 && squash(source) === squash(translated) && looksUntranslated(source, translated);
}

/** Every name, URL, path and identifier in the source survives verbatim in the reply. */
export function protectedIntact(source        , translated        )          {
  const text = (html        ) => decodeEntities(html.replace(/<[^>]*>/g, " "));
  const reply = text(translated);
  return [...text(source).matchAll(PROTECTED)].every((match) => reply.includes(match[0]));
}
