import Link from "next/link";
import { CATEGORIES } from "@/lib/registry-types";
import type { CardData } from "@/lib/registry";

export function TierBadge({ tier, className = "" }: { tier: "free" | "pro"; className?: string }) {
  return tier === "pro" ? (
    <span
      className={`inline-flex h-5 items-center rounded-full bg-gradient-to-b from-[#ff8a52]/25 to-[#ff4d6d]/15 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-site-glow ring-1 ring-inset ring-[#ff7a45]/30 ${className}`}
    >
      Pro
    </span>
  ) : (
    <span className={`inline-flex h-5 items-center rounded-full bg-white/[0.06] px-2 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-site-fg-2 ring-1 ring-inset ring-white/10 ${className}`}>
      Free
    </span>
  );
}

export function ComponentCard({ c, priority = false }: { c: CardData; priority?: boolean }) {
  return (
    <Link
      href={`/components/${c.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#0a0a0b] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-0.5 hover:border-white/[0.16] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_60px_-24px_rgba(255,122,69,0.25)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-white/[0.06] bg-[#050505]">
        {c.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.thumb}
            alt={`${c.name} preview`}
            loading={priority ? "eager" : "lazy"}
            className={`absolute inset-0 size-full transition duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.025] ${c.platform === "mobile" ? "object-contain py-3" : "object-cover object-top"}`}
          />
        ) : (
          <div className="absolute inset-0 site-dots opacity-60" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate text-[15px] font-medium tracking-[-0.015em] text-site-fg">{c.name}</h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {c.platform === "mobile" && (
              <span className="inline-flex h-5 items-center rounded-full bg-white/[0.06] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-site-fg-2 ring-1 ring-inset ring-white/10">
                Native
              </span>
            )}
            <TierBadge tier={c.tier} />
          </div>
        </div>
        <p className="font-mono text-[11px] text-site-fg-3">{CATEGORIES[c.category].label}</p>
      </div>
    </Link>
  );
}
