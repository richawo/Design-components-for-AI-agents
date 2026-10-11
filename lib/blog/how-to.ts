export type HowToStep = { name: string; text: string; id: string };

const plain = (html: string) => html.replace(/<[^>]*>/g, "")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

/** Schema steps come from the same localized headings and paragraphs readers see. */
export function visibleHowToSteps(html: string, names: string[] = []): HowToStep[] {
  const sections = [...html.matchAll(/<h2\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\b|$)/gi)];
  return names.map((name) => {
    const section = sections.find((match) => plain(match[2]) === name);
    const paragraph = section?.[3].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1];
    if (!section || !paragraph) throw new Error(`HowTo step has no visible heading and paragraph: ${name}`);
    return { name: plain(section[2]), text: plain(paragraph), id: section[1] };
  });
}
