import "server-only";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Fine-grained imports and the JavaScript regex engine (no WASM), so the
// highlighter bundles small and runs the same in Node and on Cloudflare Workers.
let highlighter: Promise<HighlighterCore> | null = null;

function getHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [import("shiki/themes/vesper.mjs")],
    langs: [
      import("shiki/langs/tsx.mjs"),
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/bash.mjs"),
      import("shiki/langs/markdown.mjs"),
      import("shiki/langs/css.mjs"),
    ],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

export async function highlight(code: string, lang: "tsx" | "json" | "bash" | "markdown" | "css" | "ts" = "tsx") {
  const h = await getHighlighter();
  return h.codeToHtml(code.trimEnd(), { lang: lang === "ts" ? "typescript" : lang, theme: "vesper" });
}
