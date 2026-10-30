import { describe, expect, it } from "vitest";
import { marked, type Token, type Tokens } from "marked";
import { mapMarkdown } from "@/lib/i18n/markdown.mjs";

const isTable = (token: Token): token is Tokens.Table =>
  token.type === "table" && "rows" in token && Array.isArray(token.rows);

describe("localized Markdown tables", () => {
  it("keeps a code union and a translated literal pipe inside their own cells", () => {
    const source = [
      "| Prop | Type | Description |",
      "| --- | --- | --- |",
      "| `onTriage` | `(update: T) => void \\| Promise<void>` | Save the route. |",
      "",
    ].join("\n");
    const localized = mapMarkdown(source, (key) => key === "Save the route." ? "Enregistrer | puis vérifier." : key);
    const table = marked.lexer(localized).find(isTable);
    expect(table).toBeDefined();
    expect(table!.rows[0]).toHaveLength(3);
    expect(table!.rows[0][1].text).toContain("void | Promise&lt;void&gt;");
    expect(table!.rows[0][2].text).toBe("Enregistrer | puis vérifier.");
    const html = marked.parse(localized) as string;
    expect(html).toContain("<code>(update: T) =&gt; void | Promise&lt;void&gt;</code>");
    expect(html).toContain("<td>Enregistrer | puis vérifier.</td>");
  });
});
