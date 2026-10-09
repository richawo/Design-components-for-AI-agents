import type { QA } from "@/components/site/faq";

/**
 * Copy shared by a page and its Markdown twin, so the two never drift.
 */

export const HOME_FAQ: QA[] = [
  {
    q: "What is Design for AI?",
    a: "A library of design components made for AI coding agents. Each one ships as a self-contained React + Tailwind (or React Native) file, plus a natural-language prompt and a JSON prompt that describe exactly how it's designed, so an agent can install it or rebuild it in your brand without falling back on generic defaults.",
  },
  {
    q: "How do I stop AI tools generating generic-looking UI?",
    a: "Give the agent something specific to work from. Point it at a component and its prompt (exact type scale, palette, spacing, motion and a list of things to avoid) and it stops guessing. Our design principles also work as a standalone system prompt.",
  },
  {
    q: "Which agents and tools does it work with?",
    a: "Anything that can read a URL or run a command: Claude Code, Cursor, Windsurf, Codex, v0, Lovable, Bolt and Replit. Install with the shadcn CLI, connect the MCP server, or paste the prompt.",
  },
  {
    q: "What kinds of components are there?",
    a: "Marketing sections, product UI, AI interfaces, financial-grade charts, Three.js scenes, pixel and dot-matrix animation, and React Native screens. Every one is responsive and accessible, and respects reduced motion.",
  },
  {
    q: "Is it free?",
    a: "The free components are MIT licensed, with code and prompts included. Pro unlocks the showpieces, their prompts and the private registry, yearly or once for life.",
  },
];

export const PRICING_FAQ: QA[] = [
  {
    q: "What do I actually get with Pro?",
    a: "Every Pro component's code, natural-language prompt and JSON prompt; access to the private shadcn registry and the Pro tools in the MCP server; and every Pro component we release while your licence is active. Lifetime means exactly that: no renewal.",
  },
  {
    q: "Can I use components in client work and products I sell?",
    a: "Yes. Free components are MIT. Pro components can be used in unlimited personal and commercial projects, including client work. What you can't do is redistribute or resell the components themselves, or put them in a competing component library or template marketplace.",
  },
  {
    q: "How do my AI agents get Pro components?",
    a: "Your licence key works everywhere: set DESIGN_FOR_AI_LICENSE in your environment and the MCP server, the shadcn registry and the API all unlock. Agents in Claude Code, Cursor, Windsurf or v0 fetch the code and prompts directly.",
  },
  {
    q: "Why are some components free and others not?",
    a: "The free core is genuinely useful on its own: heroes, pricing, AI chat, dashboards and mobile screens. Pro pays for the showpieces that take days to get right, like the 3D globe, the trading chart, kinetic type and native gestures, and keeps the free library maintained.",
  },
  {
    q: "Do you offer refunds?",
    a: "Yes. If Pro isn't for you, email within 14 days of purchase and we'll refund you in full, no questions asked.",
  },
  {
    q: "Is there a student or open-source discount?",
    a: "Maintainers of active open-source projects and students get 50% off. Email us from your university address or with a link to your project.",
  },
];

/** Plan features. Counts come from the registry so they never go stale. */
export function planFeatures(counts: { free: number; pro: number }, cadence: "lifetime" | "yearly") {
  return {
    free: [
      `${counts.free} free components`,
      "Code, prompt and JSON prompt for each",
      "shadcn registry, MCP server and CLI",
      "llms.txt and a Markdown version of every page",
      "Use in unlimited commercial projects",
    ],
    pro: [
      `Everything in Free, plus ${counts.pro} Pro components`,
      "Pro prompts and JSON prompts",
      "Private shadcn registry, MCP and CLI access",
      "React Native Pro screens",
      cadence === "lifetime" ? "Every future Pro release, no renewal" : "Every release while subscribed",
      "Unlimited personal and client projects",
    ],
    team: [
      "Everything in Pro",
      "Up to 10 seats",
      "One shared licence key for your agents and CI",
      "Invoice and VAT receipt",
      "Priority requests for new components",
    ],
  };
}
