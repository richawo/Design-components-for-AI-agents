"use client";

import { useId, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";

type Link = { label: string; href: string };

export type CtaHorizonProps = {
  /** Small label above the headline. */
  eyebrow?: string;
  /** Headline. The `muted` substring is set at 45% white. */
  headline?: string;
  muted?: string;
  body?: string;
  primary?: Link;
  secondary?: Link;
  /** Three short reassurance notes along the bottom. */
  notes?: [string, string, string];
  /** Horizon glow colours: core, mid, outer. */
  glow?: [string, string, string];
};

const ease = [0.22, 1, 0.36, 1] as const;

export function CtaHorizon({
  eyebrow = "Ready when you are",
  headline = "Ship the version you’d be proud to demo.",
  muted = "proud to demo.",
  body = "Book a 30-minute call. We’ll look at what you have, tell you honestly what we’d change, and send a plan the same day.",
  primary = { label: "Book a call", href: "#contact" },
  secondary = { label: "See pricing", href: "#pricing" },
  notes = ["Replies within one working day", "Two slots open for January", "Teams in 14 countries"],
  glow = ["#ffe2c4", "#ff7a45", "#ff4d6d"],
}: CtaHorizonProps) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  // The horizon's light leans toward the pointer, so it has a source.
  const lean = useMotionValue(0);
  const leanX = useSpring(lean, { stiffness: 60, damping: 20 });
  const i = headline.indexOf(muted);
  const pre = i >= 0 ? headline.slice(0, i) : headline;
  const post = i >= 0 ? headline.slice(i + muted.length) : "";

  return (
    <section className="bg-black p-3 sm:p-5 lg:p-6">
      <div
        onPointerMove={(e) => {
          if (reduce || e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          lean.set(((e.clientX - r.left) / r.width - 0.5) * 120);
        }}
        onPointerLeave={() => lean.set(0)}
        className="relative isolate mx-auto max-w-[1440px] overflow-hidden rounded-[24px] bg-[#09090b] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.06)] sm:rounded-[32px]">
        <Horizon id={uid} glow={glow} reduce={!!reduce} leanX={leanX} />
        {/* Fine grain keeps the gradient from banding and gives the surface tooth. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />

        <div className="relative flex min-h-[560px] flex-col items-center px-6 pb-16 pt-16 text-center sm:min-h-[640px] sm:px-12 sm:pb-8 sm:pt-24 lg:min-h-[700px] lg:pt-28">
          <p className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <span className="relative flex size-1.5" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: glow[1] }} />
              <span className="relative inline-flex size-1.5 rounded-full" style={{ background: glow[1] }} />
            </span>
            {eyebrow}
          </p>

          <motion.h2
            initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.9, ease }}
            className="mt-8 max-w-[16ch] text-balance font-display text-[clamp(2.5rem,1.4rem+4.6vw,5.75rem)] font-semibold leading-[0.98] tracking-[-0.055em]"
          >
            <span className="bg-gradient-to-b from-white via-white to-white/70 bg-clip-text text-transparent">{pre}</span>
            {i >= 0 ? <span className="text-white/45">{muted}</span> : null}
            {post}
          </motion.h2>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.8, ease, delay: 0.1 }}
            className="mt-6 max-w-[50ch] text-balance text-[16px] leading-relaxed text-white/60 sm:text-[17px]"
          >
            {body}
          </motion.p>

          <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <MagneticButton href={primary.href} label={primary.label} reduce={!!reduce} />
            <a
              href={secondary.href}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-white/[0.06] px-6 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.1)] backdrop-blur transition-[background-color,transform] duration-150 hover:bg-white/[0.1] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:w-auto"
            >
              {secondary.label}
            </a>
          </div>

          <ul className="mt-auto grid w-full max-w-4xl gap-3 pt-20 text-[13px] text-white/55 sm:grid-cols-3 sm:gap-6">
            {notes.map((n, k) => (
              <motion.li
                key={n}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.8 }}
                transition={{ duration: 0.6, ease, delay: 0.25 + k * 0.08 }}
                className="flex items-center justify-center gap-2.5"
              >
                <span className="font-mono text-[10px] text-white/30">{String(k + 1).padStart(2, "0")}</span>
                {n}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Horizon: a luminous arc rising from the bottom edge                 */
/* ------------------------------------------------------------------ */

function Horizon({ id, glow, reduce, leanX }: { id: string; glow: [string, string, string]; reduce: boolean; leanX: MotionValue<number> }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20">
      {/* Bloom */}
      <motion.div style={{ x: leanX }} className="absolute inset-0">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 60 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease }}
        className="absolute bottom-[-48%] left-1/2 aspect-square w-[170%] -translate-x-1/2 rounded-full sm:bottom-[-74%] sm:w-[110%]"
        style={{ background: `radial-gradient(closest-side, ${glow[0]} 0%, ${glow[1]}cc 22%, ${glow[2]}55 45%, transparent 70%)`, filter: "blur(48px)", opacity: 0.8 }}
      />
      </motion.div>
      {/* Planet edge: dark disc with a lit rim */}
      <svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-[34%] w-full sm:h-[40%]">
        <defs>
          <linearGradient id={`${id}-rim`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={glow[2]} stopOpacity="0" />
            <stop offset="0.3" stopColor={glow[1]} stopOpacity="0.9" />
            <stop offset="0.5" stopColor={glow[0]} />
            <stop offset="0.7" stopColor={glow[1]} stopOpacity="0.9" />
            <stop offset="1" stopColor={glow[2]} stopOpacity="0" />
          </linearGradient>
          <filter id={`${id}-blur`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <radialGradient id={`${id}-disc`} cx="50%" cy="0%" r="80%">
            <stop offset="0" stopColor="#141416" />
            <stop offset="1" stopColor="#09090b" />
          </radialGradient>
        </defs>
        {[0.55, 0.38, 0.22].map((o, k) => (
          <ellipse key={k} cx="500" cy={830 + k * 60} rx={760 + k * 120} ry={420 + k * 70} fill="none" stroke="white" strokeOpacity={o * 0.12} />
        ))}
        <ellipse cx="500" cy="830" rx="760" ry="420" fill={`url(#${id}-disc)`} />
        <ellipse cx="500" cy="830" rx="760" ry="420" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="14" opacity="0.35" filter={`url(#${id}-blur)`} />
        <ellipse cx="500" cy="830" rx="760" ry="420" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="2" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Magnetic button: leans toward the cursor on a spring                */
/* ------------------------------------------------------------------ */

function MagneticButton({ href, label, reduce }: { href: string; label: string; reduce: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const spring = { stiffness: 220, damping: 18, mass: 0.5 };
  const x = useSpring(mx, spring);
  const y = useSpring(my, spring);
  const lx = useTransform(x, (v) => v * 0.4);
  const ly = useTransform(y, (v) => v * 0.4);

  const onMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set(Math.max(-18, Math.min(18, (e.clientX - (r.left + r.width / 2)) * 0.28)));
    my.set(Math.max(-12, Math.min(12, (e.clientY - (r.top + r.height / 2)) * 0.35)));
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <span ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className="-m-5 flex w-[calc(100%+2.5rem)] justify-center p-5 sm:inline-flex sm:w-auto">
      <motion.a
        href={href}
        style={{ x, y }}
        className="group relative inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-white px-6 text-[15px] font-medium text-black shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_12px_40px_-8px_rgba(255,255,255,0.45)] transition-[box-shadow,scale] duration-150 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.3),0_16px_48px_-6px_rgba(255,255,255,0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:[scale:0.97] sm:w-auto"
      >
        <motion.span style={{ x: lx, y: ly }}>{label}</motion.span>
        <motion.span style={{ x: lx, y: ly }} className="inline-flex">
          <svg viewBox="0 0 16 16" className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" aria-hidden="true">
            <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      </motion.a>
    </span>
  );
}

export default CtaHorizon;
