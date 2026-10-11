/**
 * Names that must reach every language unchanged. The translation endpoint
 * ignores `translate="no"`, and without protection it turns "Design for AI" into
 * a Japanese place name, so each term is swapped for a token before the text
 * leaves and swapped back after. Longest first, so "YouTube Shorts" wins over
 * "YouTube".
 */
export const GLOSSARY = ["Design for AI Pro","Design for AI","design.yaps.ai","React Native","React","Expo","Tailwind CSS","Tailwind","Claude Code","Claude","Cursor","Codex","ChatGPT","MCP","shadcn/ui","shadcn","Three.js","Motion","JSON","Markdown","GitHub","TypeScript","JavaScript","CSS","HTML","WCAG","SVG","API","CLI","npm","WebGL","Bricolage Grotesque","Geist","Instrument Serif","Yaps","v0","Lovable","Bolt","AGENTS.override.md","AGENTS.md","CLAUDE.md","DESIGN.md","DTCG","Figma","axe-core","Playwright","prefers-reduced-motion","useSyncExternalStore","MotionConfig","Next.js","MDN","WAI-ARIA","SSR"].sort((a, b) => b.length - a.length);

const escapeRegExp = (value        ) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "X" is the platform only as a whole word in capitals; lowercase x is a size ("1080 x 1920"). */
export const GLOSSARY_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}.@/-])(?:${GLOSSARY.map(escapeRegExp).join("|")}|X)(?![\\p{L}\\p{N}-]|\\.[a-z])`,
  "gu",
);

/** True when a string holds nothing a translator could change: names, numbers, punctuation. */
export function isUntranslatable(text        )          {
  const rest = text
    .replace(/https?:\/\/\S+|[\w.+-]+@[\w-]+\.[\w.]+/g, " ")
    // File names, including templates such as "post-yaps-import-{{0}}.csv".
    .replace(/[\w{}-]+\.(?:csv|txt|json|md|jpe?g|png|webp|zip|pdf)\b/g, " ")
    .replace(GLOSSARY_PATTERN, " ")
    .replace(/\{\{?\w+\}?\}/g, " ");
  return !/\p{L}{2,}/u.test(rest);
}
