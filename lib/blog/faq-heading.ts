import { Marked, type Tokens } from "marked";

/** Resolve a translated FAQ heading by its source section, never by an H3 guess. */
export function sourceFaqHeading(sourceMarkdown: string, renderedHeadings: { level: number; text: string }[]) {
  const source = new Marked().lexer(sourceMarkdown)
    .filter((token): token is Tokens.Heading => token.type === "heading" && token.depth === 2);
  const rendered = renderedHeadings.filter((heading) => heading.level === 2);
  if (source.length !== rendered.length) return undefined;
  const index = source.findIndex((heading) => /^(?:FAQs|Frequently asked questions)$/i.test(heading.text.trim()));
  return index < 0 ? undefined : rendered[index]?.text;
}
