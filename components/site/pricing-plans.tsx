"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { CountUp } from "./count-up";
import { planFeatures } from "@/lib/copy";

type Counts = { free: number; pro: number; mobile: number; total: number };

/** First-view order: the page header holds steps 0–2, the cadence toggle 3, the cards 4–6. */
const TOGGLE_STEP = 3;
const CARD_STEP = 4;
/** Feature lines follow their card in by this many steps. */
const FEATURE_LAG = 3;
const step = (i: number) => ({ "--i": i }) as CSSProperties;

export function PricingPlans({ counts, prices }: { counts: Counts; prices: Record<string, number> }) {
  const [cadence, setCadence] = useState<"lifetime" | "yearly">("lifetime");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(plan: string) {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
      const json = (await res.json()) as { url?: string; signInUrl?: string; error?: string };
      if (res.status === 401 && json.signInUrl) window.location.href = json.signInUrl;
      else if (json.url) window.location.href = json.url;
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
  const features = planFeatures(counts, cadence);

  return (
    <div>
      <div className="site-in flex justify-center" style={step(TOGGLE_STEP)}>
        <div role="radiogroup" aria-label="Billing" className="relative flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          {(["lifetime", "yearly"] as const).map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={cadence === c}
              onClick={() => setCadence(c)}
              className={`group relative h-10 rounded-full px-5 text-[14px] font-medium transition-colors duration-200 ${cadence === c ? "text-black" : "text-site-fg-2 hover:text-site-fg"}`}
            >
              {cadence === c && (
                <motion.span
                  layoutId="pricing-cadence"
                  className="absolute inset-0 rounded-full bg-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative inline-block transition-transform duration-150 group-active:scale-[0.97]">{c === "lifetime" ? "Pay once, keep forever" : "Yearly"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:items-stretch">
        <Card
          order={0}
          name="Free"
          price={0}
          suffix="forever"
          blurb="The open core. MIT licensed, no account, no email."
          features={features.free}
          cta={
            <Link href="/components" className="site-btn site-btn-secondary h-11 w-full text-[14px]">
              Browse free components
            </Link>
          }
        />
        <Card
          featured
          order={1}
          name="Pro"
          price={prices[pro]}
          suffix={suffix}
          blurb="Every component, including the showpieces. For one person."
          features={features.pro}
          cta={
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => checkout(pro)}
              aria-busy={busy === pro}
              className="site-btn site-btn-accent h-11 w-full text-[14px]"
            >
              {busy === pro && <Spinner />}
              {busy === pro ? "Opening checkout…" : `Get Pro ${cadence === "lifetime" ? "for life" : "yearly"}`}
            </button>
          }
        />
        <Card
          order={2}
          name="Team"
          price={prices[team]}
          suffix={suffix}
          blurb="Pro for up to 10 people, one invoice."
          features={features.team}
          cta={
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => checkout(team)}
              aria-busy={busy === team}
              className="site-btn site-btn-secondary h-11 w-full text-[14px]"
            >
              {busy === team && <Spinner />}
              {busy === team ? "Opening checkout…" : "Get Team"}
            </button>
          }
        />
      </div>
      {error && (
        <p role="alert" className="site-rise mx-auto mt-6 max-w-xl rounded-xl border border-site-danger/30 bg-site-danger/10 px-5 py-3 text-center text-[14px] text-site-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Card({
  order,
  name,
  price,
  suffix,
  blurb,
  features,
  cta,
  featured = false,
}: {
  order: number;
  name: string;
  price: number;
  suffix: string;
  blurb: string;
  features: string[];
  cta: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <div
      className={`site-surface site-in relative flex flex-col rounded-[24px] p-7 sm:p-8 ${featured ? "site-beam" : ""}`}
      style={step(CARD_STEP + order)}
    >
      {featured && (
        <span className="absolute right-6 top-7 rounded-full bg-site-accent px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-black sm:right-8 sm:top-8">
          Most popular
        </span>
      )}
      <h3 className="text-[15px] font-medium text-site-fg">{name}</h3>
      <p className="mt-4 flex items-baseline gap-2">
        {/* Counts up on first view, then tweens whenever the billing toggle changes it. */}
        <span className="text-5xl font-semibold tracking-[-0.05em] text-site-fg">
          $<CountUp value={price} delay={0.45 + order * 0.06} />
        </span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={suffix}
            initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="text-[14px] text-site-fg-3"
          >
            {suffix}
          </motion.span>
        </AnimatePresence>
      </p>
      <p className="mt-3 text-[14px] leading-relaxed text-site-fg-2 lg:min-h-[2lh]">{blurb}</p>
      <ul className="mt-7 flex-1 space-y-3 border-t border-white/[0.07] pt-7">
        {/* Lines are keyed by position so a cadence switch cross-fades the one that changes, in place. */}
        {features.map((f, j) => (
          <li key={j} className="site-in flex gap-3 text-[14px] text-site-fg-2" style={step(CARD_STEP + order + FEATURE_LAG + j)}>
            <svg viewBox="0 0 16 16" className={`mt-0.5 size-4 shrink-0 ${featured ? "text-site-fg" : "text-site-fg-3"}`} fill="none" aria-hidden="true">
              <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span key={f} className="site-rise">
              {f}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-8">{cta}</div>
    </div>
  );
}

function Spinner() {
  return <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent opacity-70" />;
}
