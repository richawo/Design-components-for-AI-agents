import { marked } from "marked";
import { escapeText, decodeEntities } from "../../scripts/lib/translation-tokens.mjs";
const keyOf = (text) => text.replace(/\s+/g, " ").trim();

export function inlineUnit(text) {
  const opaque = [];
  const html = marked.parseInline(text).replace(/<(code|kbd)\b[^>]*>[\s\S]*?<\/\1>/g, (code) => {
    opaque.push(code);
    return `{{${opaque.length - 1}}}`;
  });
  return { key: keyOf(html), opaque };
}

export function mapMarkdown(content, map) {
  const template = (text) => text.split("\n").map((line) => {
    if (!line.trim()) return line;
    const [, prefix, prose] = /^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+)?)(.*)$/.exec(line);
    const opaque = [];
    const key = keyOf(escapeText(prose.replace(/`[^`]+`/g, (code) => { opaque.push(code); return `{{${opaque.length - 1}}}`; })));
    return prefix + decodeEntities(map(key)).replace(/\{\{(\d+)\}\}/g, (_, index) => opaque[Number(index)] ?? "");
  }).join("\n");
  const inline = (text) => {
    const { key, opaque } = inlineUnit(text);
    return map(key).replace(/\{\{(\d+)\}\}/g, (_, index) => opaque[Number(index)] ?? "")
      .replace(/(<img\b[^>]*\balt=")([^"]*)(")/gi, (_, start, alt, end) => `${start}${escapeText(decodeEntities(map(keyOf(alt)))).replaceAll('"', "&quot;")}${end}`);
  };
  const render = (tokens) => tokens.map((token) => {
    switch (token.type) {
      case "heading": return `${"#".repeat(token.depth)} ${inline(token.text)}\n\n`;
      case "paragraph": case "text": return `${inline(token.text)}\n\n`;
      case "blockquote": return render(token.tokens).trimEnd().split("\n").map((line) => `> ${line}`).join("\n") + "\n\n";
      case "list": return token.items.map((item, index) => {
        const prefix = token.ordered ? `${Number(token.start) + index}. ` : "- ";
        const body = render(item.tokens).trimEnd().split("\n");
        return prefix + (item.task ? `[${item.checked ? "x" : " "}] ` : "") + body[0] + "\n" + body.slice(1).map((line) => " ".repeat(prefix.length) + line).join("\n");
      }).join("\n") + "\n\n";
      case "table": {
        // Markdown table delimiters are recognized even inside inline HTML
        // code. Preserve literal pipes after backtick code becomes <code>.
        const cellText = (cell) => inline(cell.text).replace(/(\\*)\|/g, (_, slashes) => `${slashes}${slashes.length % 2 ? "" : "\\"}|`);
        const row = (cells) => "| " + cells.map(cellText).join(" | ") + " |\n";
        return row(token.header) + row(token.align.map(() => ({ text: "---" }))) + token.rows.map(row).join("") + "\n";
      }
      case "code": return token.lang === "markdown i18n" ? `\`\`\`markdown\n${template(token.text)}\n\`\`\`\n\n` : token.raw;
      // Code, HTML blocks and other non-prose syntax never go to a translator.
      default: return token.raw;
    }
  }).join("");
  return render(marked.lexer(content));
}
