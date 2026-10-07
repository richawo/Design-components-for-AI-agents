import "server-only";
import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Promise<Highlighter> | null = null;

function getHighlighter() {
  highlighter ??= createHighlighter({ themes: ["vesper"], langs: ["tsx", "json", "bash", "markdown", "css", "ts"] });
  return highlighter;
}

export async function highlight(code: string, lang: "tsx" | "json" | "bash" | "markdown" | "css" | "ts" = "tsx") {
  const h = await getHighlighter();
  return h.codeToHtml(code.trimEnd(), { lang, theme: "vesper" });
}
