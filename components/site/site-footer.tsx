import Link from "next/link";
import { CATEGORIES, type Category } from "@/lib/registry-types";
import { site } from "@/lib/site";
import { LogoMark } from "./logo";
import { MarkdownLink } from "./markdown-link";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Components",
    links: (["charts", "three-d", "pixel", "ai", "hero", "mobile"] as Category[]).map((c) => ({ href: `/categories/${c}`, label: CATEGORIES[c].label })),
  },
  {
    title: "For agents",
    links: [
      { href: "/docs/agents", label: "MCP server" },
      { href: "/docs/installation", label: "shadcn registry" },
      { href: "/docs/prompting", label: "Prompts & JSON prompts" },
      { href: "/docs/principles", label: "Design principles" },
      { href: "/llms.txt", label: "llms.txt" },
    ],
  },
  {
    title: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/blog", label: "Blog" },
      { href: "/docs/license", label: "Licence" },
      { href: site.github, label: "GitHub" },
      { href: `mailto:${site.email}`, label: "Contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.07] bg-black">
      <div className="mx-auto max-w-[80rem] px-5 pt-16 sm:px-8 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <LogoMark className="size-8" />
            <p className="mt-5 max-w-[34ch] text-[15px] leading-relaxed text-site-fg-2">
              Design components for AI agents. Code, prompt and JSON prompt for every one, so what your agent ships looks designed.
            </p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">A Yaps project</p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="text-[13px] font-medium text-site-fg">{col.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-[14px] text-site-fg-2 transition-colors hover:text-site-fg">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-16 flex flex-col justify-between gap-3 border-t border-white/[0.07] py-6 text-[13px] text-site-fg-3 sm:flex-row">
          <p>© 2026 Design for AI. Free components MIT licensed.</p>
          <MarkdownLink className="font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:text-site-fg" />
        </div>
      </div>
      <p
        aria-hidden="true"
        className="pointer-events-none -mb-[0.2em] select-none whitespace-nowrap bg-gradient-to-b from-white/[0.09] to-transparent bg-clip-text text-center text-[15.5vw] font-semibold leading-[0.9] tracking-[-0.06em] text-transparent"
      >
        Design for AI
      </p>
    </footer>
  );
}
