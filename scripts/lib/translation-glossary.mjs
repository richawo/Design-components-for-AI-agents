/**
 * Names that must reach every language unchanged. The translation endpoint
 * ignores `translate="no"`, and without protection it turns "Design for AI" into
 * a Japanese place name, so each term is swapped for a token before the text
 * leaves and swapped back after. Longest first, so "YouTube Shorts" wins over
 * "YouTube".
 */
export const GLOSSARY = ["Notification Inbox","Audit Trail","TanStack Table","TanStack Query","AG Grid","React Hook Form","React Async","Mews","DevExpress","MiniDev","Kelvin UI","Ballmac","ABP","VLLNT","Wingo","Hairline","Ruixen","System B90","Legend List","OWASP","Crayon","React Aria Components","Color Token Studio","PrimeReact","Tool UI","Vercel Academy","Zippystarter","Telerik","Dave Lage","Watermelon UI","thefrontkit","VectorMotion","TailGrids","SmartHR","HeroUI","ReUI","Roster","Fundex","tweakcn","Apache-2.0","GBP","Kokonut UI","Motion Primitives","Tremor","Shadcn Studio","Tailark","PrimeUI Figma UI Kit","PrimeUI","Appetite UI","Sortable Data Table","Waffle Chart","Saved Views","Workspace Dashboard","Vite","Lucide","Commons Clause","MIT","USD","OpenAI","Agents SDK","Assistant Cloud","Chat Thread","Agent Tool Call","Agent Status Pill","Agent Approval Gate","Agent Diff Review","Agent Plan","React-admin","Commerce Operations Workspace","Return Desk","Variant Stock Matrix","21st.dev","React Bits Pro","React Bits","Claude Design","MCP Apps","Opus","AI Elements","AI SDK","ChatKit","assistant-ui","prompt-kit","MUI X Chat","Mantine","Medusa","Saleor","AG-UI","LangGraph","Study Yaps","Post Yaps","Glass Tab Bar","Settings Panel","Plan Card with Billing Toggle","Tailwind Plus","Tailwind UI","Untitled UI React","Untitled UI","Shadcnblocks","Magic UI","Aceternity UI","coss ui","daisyUI","TailAdmin","CoreUI","Material UI","MUI X","React Native Paper","Tamagui","gluestack-ui","NativeWind","React Aria","Base UI","Radix UI","Radix","Design for AI Pro","Design for AI","design.yaps.ai","React Native","React","Expo","Tailwind CSS","Tailwind","Claude Code","Claude","VS Code","Devin Desktop","Windsurf","Copilot","Cursor","Codex","ChatGPT","MCP","shadcn/ui","shadcn","Three.js","Motion","JSON","Markdown","GitHub","TypeScript","JavaScript","CSS","HTML","WCAG","SVG","API","CLI","npm","WebGL","Bricolage Grotesque","Geist","Instrument Serif","Yaps","v0","Lovable","Bolt","AGENTS.override.md","AGENTS.md","CLAUDE.md","DESIGN.md","DTCG","Figma","axe-core","Playwright","prefers-reduced-motion","useSyncExternalStore","MotionConfig","Next.js","MDN","WAI-ARIA","SSR"].sort((a, b) => b.length - a.length);

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
