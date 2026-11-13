import "server-only";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Fine-grained imports and the JavaScript regex engine (no WASM), so the
// highlighter bundles small and runs the same in Node and on Cloudflare Workers.
let highlighter: Promise<HighlighterCore> | null = null;

const THEME = "site-mono";

/**
 * Vesper, taken to greys to match the site: structure is carried by weight of
 * ink (white names, lighter strings, dimmer keywords and comments), not hue.
 */
const VESPER_TO_GREY: Record<string, string> = {
  "#8B8B8B94": "#8A8A94", // comments must remain readable on code surfaces
  "#FFC799": "#FFFFFF", // functions, tags
  "#99FFE4": "#B4B4BC", // strings, keys
  "#A0A0A0": "#7C7C85", // keywords, storage
  "#FF8080": "#EDEDEF", // classes and modules (Vesper's red, which isn't an error here)
};

async function monoTheme() {
  const { default: vesper } = await import("shiki/themes/vesper.mjs");
  return {
    ...vesper,
    name: THEME,
    tokenColors: vesper.tokenColors?.map((t) => {
      const fg = t.settings?.foreground?.toUpperCase();
      return fg && VESPER_TO_GREY[fg] ? { ...t, settings: { ...t.settings, foreground: VESPER_TO_GREY[fg] } } : t;
    }),
  };
}

function getHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [monoTheme()],
    langs: [
      import("shiki/langs/tsx.mjs"),
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/bash.mjs"),
      import("shiki/langs/markdown.mjs"),
      import("shiki/langs/css.mjs"),
      import("shiki/langs/html.mjs"),
    ],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

export type HighlightLanguage = "tsx" | "json" | "bash" | "markdown" | "css" | "ts" | "js" | "html";

export async function highlight(code: string, lang: HighlightLanguage = "tsx") {
  const h = await getHighlighter();
  return h.codeToHtml(code.trimEnd(), { lang: lang === "ts" ? "typescript" : lang === "js" ? "javascript" : lang, theme: THEME });
}
