"use client";

import Link from "next/link";
import { useState } from "react";

type Counts = { free: number; pro: number; mobile: number; total: number };

export function PricingPlans({ counts, prices }: { counts: Counts; prices: Record<string, number> }) {
  const [cadence, setCadence] = useState<"lifetime" | "yearly">("lifetime");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(plan: string) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const json = (await res.json()) as { url?: string; error?: string };
      if (json.url) window.location.href = json.url;
      else setError(json.error ?? "Checkout is unavailable right now.");
    } catch {
      setError("Checkout is unavailable right now.");
    } finally {
      setBusy(null);
    }
  }

  const pro = cadence === "lifetime" ? "pro-lifetime" : "pro-yearly";
  const team = cadence === "lifetime" ? "team-lifetime" : "team-yearly";
  const suffix = cadence === "lifetime" ? "once" : "/ year";

  return (
    <div>
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Billing" className="relative flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          {(["lifetime", "yearly"] as const).map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={cadence === c}
              onClick={() => setCadence(c)}
              className={`relative h-10 rounded-full px-5 text-[14px] font-medium transition-colors ${cadence === c ? "bg-white text-black" : "text-site-fg-2 hover:text-site-fg"}`}
            >
              {c === "lifetime" ? "Pay once, keep forever" : "Yearly"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:items-stretch">
        <Card
          name="Free"
          price="$0"
          suffix="forever"
          blurb="The open core. MIT licensed, no account, no email."
          features={[
            `${counts.free} free components`,
            "Code, prompt and JSON prompt for each",
            "shadcn registry and MCP server",
            "llms.txt and Markdown docs for agents",
            "Use in unlimited commercial projects",
          ]}
          cta={
            <Link href="/components" className="flex h-11 items-center justify-center rounded-full border border-white/12 text-[14px] font-medium text-site-fg transition hover:border-white/25 hover:bg-white/[0.03]">
              Browse free components
            </Link>
          }
        />
        <Card
          featured
          name="Pro"
          price={`$${prices[pro]}`}
          suffix={suffix}
          blurb="Every component, including the showpieces. For one person."
          features={[
            `Everything in Free, plus ${counts.pro} Pro components`,
            "Pro prompts and JSON prompts",
            "Private shadcn registry and MCP access",
            "React Native Pro screens",
            cadence === "lifetime" ? "Every future Pro release, no renewal" : "Every release while subscribed",
            "Unlimited personal and client projects",
          ]}
          cta={
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => checkout(pro)}
              className="flex h-11 w-full items-center justify-center rounded-full bg-white text-[14px] font-medium text-black shadow-[0_10px_30px_-10px_rgba(255,255,255,0.5)] transition hover:bg-white/90 disabled:opacity-60"
            >
              {busy === pro ? "Opening checkout…" : `Get Pro ${cadence === "lifetime" ? "for life" : "yearly"}`}
            </button>
          }
        />
        <Card
          name="Team"
          price={`$${prices[team]}`}
          suffix={suffix}
          blurb="Pro for up to 10 people, one invoice."
          features={[
            "Everything in Pro",
            "Up to 10 seats",
            "One shared licence key for your agents and CI",
            "Invoice and VAT receipt",
            "Priority requests for new components",
          ]}
          cta={
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => checkout(team)}
              className="flex h-11 w-full items-center justify-center rounded-full border border-white/12 text-[14px] font-medium text-site-fg transition hover:border-white/25 hover:bg-white/[0.03] disabled:opacity-60"
            >
              {busy === team ? "Opening checkout…" : "Get Team"}
            </button>
          }
        />
      </div>
      {error && (
        <p role="alert" className="mx-auto mt-6 max-w-xl rounded-xl border border-[#ff7a45]/30 bg-[#ff7a45]/10 px-5 py-3 text-center text-[14px] text-site-glow">
          {error}
        </p>
      )}
    </div>
  );
}

function Card({
  name,
  price,
  suffix,
  blurb,
  features,
  cta,
  featured = false,
}: {
  name: string;
  price: string;
  suffix: string;
  blurb: string;
  features: string[];
  cta: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-[24px] p-7 sm:p-8 ${featured ? "site-beam bg-[linear-gradient(180deg,rgba(255,122,69,0.10),rgba(255,255,255,0.02)_45%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_40px_100px_-40px_rgba(255,122,69,0.35)] ring-1 ring-inset ring-white/10" : "site-surface"}`}
    >
      {featured && (
        <span className="absolute right-6 top-7 rounded-full bg-gradient-to-b from-[#ffb38a] to-[#ff6a3d] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-black sm:right-8 sm:top-8">
          Most popular
        </span>
      )}
      <h3 className="text-[15px] font-medium text-site-fg">{name}</h3>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-5xl font-semibold tracking-[-0.05em] tabular-nums text-site-fg">{price}</span>
        <span className="text-[14px] text-site-fg-3">{suffix}</span>
      </p>
      <p className="mt-3 text-[14px] leading-relaxed text-site-fg-2">{blurb}</p>
      <ul className="mt-7 flex-1 space-y-3 border-t border-white/[0.07] pt-7">
        {features.map((f) => (
          <li key={f} className="flex gap-3 text-[14px] text-site-fg-2">
            <svg viewBox="0 0 16 16" className={`mt-0.5 size-4 shrink-0 ${featured ? "text-site-accent" : "text-site-fg-3"}`} fill="none" aria-hidden="true">
              <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-8">{cta}</div>
    </div>
  );
}
