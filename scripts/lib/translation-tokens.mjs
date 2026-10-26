import { GLOSSARY_PATTERN } from "./translation-glossary.mjs";

/** URLs, site paths and email addresses travel as tokens too: a translator will happily "fix" /api/v1/openapi.json. */
export const PROTECTED = new RegExp(
  [
    String.raw`https?:\/\/[^\s<>"]*[^\s<>".,;:!?)]`,
    // File names and snake_case identifiers: "scheduled_at" came back as "cheduled_at".
    String.raw`[\w-]+\.(?:csv|txt|json|md|jpe?g|png|webp|zip|pdf)(?![\w.])`,
    String.raw`(?<![\p{L}\p{N}])[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?![\p{L}\p{N}])`,
    String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)+`,
    String.raw`(?<![\p{L}\p{N}/.])\/[a-z0-9_.][\w./-]*[\w/]`,
    // The short product name also occurs in prose as "Radix-based". The
    // general glossary boundary excludes hyphenated package-name fragments.
    String.raw`(?<![\p{L}\p{N}])Radix(?=-based\b)`,
    GLOSSARY_PATTERN.source,
  ].join("|"),
  "gu",
);
/** The same, without product names: for a retry that sends names as plain words. */
const STRUCTURAL = new RegExp(
  [
    String.raw`https?:\/\/[^\s<>"]*[^\s<>".,;:!?)]`,
    // File names and snake_case identifiers: "scheduled_at" came back as "cheduled_at".
    String.raw`[\w-]+\.(?:csv|txt|json|md|jpe?g|png|webp|zip|pdf)(?![\w.])`,
    String.raw`(?<![\p{L}\p{N}])[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?![\p{L}\p{N}])`,
    String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)+`,
    String.raw`(?<![\p{L}\p{N}/.])\/[a-z0-9_.][\w./-]*[\w/]`,
  ].join("|"),
  "gu",
);

/**
 * The translation endpoint strips HTML and ignores translate="no", but it
 * carries bracketed tokens through and moves them with the words they wrap.
 * So a unit such as `Use <a href="/x">the <b>free</b> tool</a>` travels as
 * `Use [[[1]]]the [[[2]]]free[[[/2]]] tool[[[/1]]]`, protected names and
 * placeholders travel as `[[[T0]]]`, and the reply is accepted only when every
 * token comes back exactly once and properly nested.
 */

const VOID = new Set(["br", "img", "input", "wbr", "hr", "source"]);
const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:\s[^>]*)?)\s*\/?>/y;
const OPAQUE = /\{\{\d+\}\}/y;
const PLACEHOLDER = /\{[a-zA-Z][\w-]*\}/y;
const TOKEN = /[[{]+\s*(\/?)\s*(T?)\s*(\d+)\s*[\]}]+/g;
export const SEPARATOR = "\n[[[§]]]\n";
const SEPARATOR_PATTERN = /\s*[[{]+\s*§\s*[\]}]+\s*/;












export function decodeEntities(value        )         {
  return value
    .replace(/&#(\d+);/g, (_, code        ) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code        ) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export const escapeText = (value        ) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Splits unit HTML into text, tags and protected spans. */
function parse(html        , names         )          {
  const pieces          = [];
  const stack           = [];
  let element = 0;
  let term = 0;
  let text = "";
  const flushText = () => {
    if (!text) return;
    const decoded = decodeEntities(text);
    let last = 0;
    for (const match of decoded.matchAll(names ? PROTECTED : STRUCTURAL)) {
      if (match.index > last) pieces.push({ kind: "text", value: decoded.slice(last, match.index) });
      pieces.push({ kind: "term", id: term++, html: escapeText(match[0]) });
      last = match.index + match[0].length;
    }
    if (last < decoded.length) pieces.push({ kind: "text", value: decoded.slice(last) });
    text = "";
  };
  for (let at = 0; at < html.length; ) {
    let match                        ;
    TAG.lastIndex = OPAQUE.lastIndex = PLACEHOLDER.lastIndex = at;
    if (html[at] === "<" && (match = TAG.exec(html))) {
      flushText();
      const [whole, slash, name] = match;
      if (VOID.has(name .toLowerCase())) pieces.push({ kind: "term", id: term++, html: whole });
      else if (!slash) {
        stack.push(++element);
        pieces.push({ kind: "open", id: element, html: whole });
      } else pieces.push({ kind: "close", id: stack.pop() ?? 0, html: whole });
      at += whole.length;
    } else if (html[at] === "{" && ((match = OPAQUE.exec(html)) || (match = PLACEHOLDER.exec(html)))) {
      flushText();
      pieces.push({ kind: "term", id: term++, html: match[0] });
      at += match[0].length;
    } else {
      text += html[at++];
    }
  }
  flushText();
  return pieces;
}

/**
 * `names: false` leaves product and platform names as plain words. Some
 * languages reorder or merge adjacent name tokens ("[[[T0]]]'s [[[T1]]]"),
 * and the endpoint rarely translates a name anyway; the caller checks they
 * survived.
 */
export function encode(html        , { names = true } = {})          {
  const pieces = parse(html, names);
  const marker = (piece       ) =>
    piece.kind === "text" ? piece.value : piece.kind === "open" ? `[[[${piece.id}]]]` : piece.kind === "close" ? `[[[/${piece.id}]]]` : `[[[T${piece.id}]]]`;
  const opens = new Map                ();
  const closes = new Map                ();
  const terms = new Map                ();
  for (const piece of pieces) {
    if (piece.kind === "open") opens.set(piece.id, piece.html);
    if (piece.kind === "close") closes.set(piece.id, piece.html);
    if (piece.kind === "term") terms.set(piece.id, piece.html);
  }

  return {
    text: pieces.map(marker).join("").replace(/\s+/g, " ").trim(),
    restore(translated) {
      const seen = new Set        ();
      const stack           = [];
      let out = "";
      let last = 0;
      for (const match of translated.matchAll(TOKEN)) {
        const [, slash, isTerm, digits] = match;
        const id = Number(digits);
        const key = `${slash}${isTerm}${id}`;
        if (seen.has(key)) return null;
        seen.add(key);
        out += escapeText(decodeEntities(translated.slice(last, match.index)));
        last = match.index + match[0].length;
        if (isTerm) {
          if (!terms.has(id) || slash) return null;
          out += terms.get(id);
        } else if (!slash) {
          if (!opens.has(id)) return null;
          stack.push(id);
          out += opens.get(id);
        } else {
          if (stack.pop() !== id) return null;
          out += closes.get(id);
        }
      }
      out += escapeText(decodeEntities(translated.slice(last)));
      if (stack.length || seen.size !== opens.size + closes.size + terms.size) return null;
      // Bracket debris means a token was half-eaten somewhere.
      if (/\[\[|\]\]/.test(out) && !/\[\[|\]\]/.test(html)) return null;
      return out.replace(/\s+/g, " ").trim();
    },
    runs() {
      // Each stretch between tags is translated on its own. Clumsier, but the
      // tags cannot be scrambled because they never leave.
      const groups            = [[]];
      for (const piece of pieces) {
        if (piece.kind === "open" || piece.kind === "close") groups.push([piece], []);
        else groups[groups.length - 1] .push(piece);
      }
      const texts = groups.filter((group) => group.length && group[0] .kind !== "open" && group[0] .kind !== "close").map((group) => group.map(marker).join(""));
      return {
        texts,
        rebuild(translated) {
          let index = 0;
          return groups
            .map((group) => {
              if (!group.length) return "";
              if (group[0] .kind === "open" || group[0] .kind === "close") return (group[0]                    ).html;
              const source = group.map(marker).join("");
              const sub = encodeRun(group);
              const original = sub(source) ;
              const result = (sub(translated[index++] ?? source) ?? original).trim();
              // Translators trim; the spaces that separate a run from its neighbouring tags must survive.
              return result ? `${/^\s/.test(source) ? " " : ""}${result}${/\s$/.test(source) ? " " : ""}` : original;
            })
            .join("")
            .replace(/\s+/g, " ")
            .trim();
        },
      };
    },
  };
}

/** Restores the term tokens in one text run; null if any went missing. */
function encodeRun(group         )                                        {
  const terms = new Map(group.filter((piece) => piece.kind === "term").map((piece) => [(piece                  ).id, (piece                    ).html]));
  return (translated) => {
    const seen = new Set        ();
    let out = "";
    let last = 0;
    for (const match of translated.matchAll(TOKEN)) {
      const id = Number(match[3]);
      if (!match[2] || match[1] || !terms.has(id) || seen.has(id)) return null;
      seen.add(id);
      out += escapeText(decodeEntities(translated.slice(last, match.index))) + terms.get(id);
      last = match.index + match[0].length;
    }
    if (seen.size !== terms.size) return null;
    return out + escapeText(decodeEntities(translated.slice(last)));
  };
}

export function splitBatch(translated        , expected        )                  {
  const parts = translated.split(SEPARATOR_PATTERN).map((part) => part.trim());
  if (parts.length === expected + 1 && parts[parts.length - 1] === "") parts.pop();
  return parts.length === expected ? parts : null;
}
