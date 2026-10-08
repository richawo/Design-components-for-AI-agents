"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Link = { label: string; href: string; /** Small mono note after the label, e.g. "2 open". */ note?: string; external?: boolean };
type Column = { title: string; links: Link[] };

export type FooterWordmarkProps = {
  /** The giant word at the bottom. Short, no descenders reads best. */
  wordmark?: string;
  headline?: string;
  email?: string;
  columns?: Column[];
  address?: string[];
  /** City label shown before the live time. */
  city?: string;
  /** IANA time zone for the live clock. */
  timeZone?: string;
  newsletter?: { title: string; body: string; placeholder: string; button: string; success: string };
  /** Called with the address when the form is submitted. */
  onSubscribe?: (email: string) => void;
  legal?: string;
  legalLinks?: Link[];
  /** Share of the cap height cut off by the bottom edge, 0–0.3. */
  clip?: number;
};

const ease = [0.2, 0.8, 0.2, 1] as const;

export function FooterWordmark({
  wordmark = "saltmarsh",
  headline = "Got a brief, a hunch or a half-built thing?",
  email = "hello@saltmarsh.studio",
  columns = [
    {
      title: "Studio",
      links: [
        { label: "About", href: "#about" },
        { label: "Services", href: "#services" },
        { label: "Careers", href: "#careers", note: "2 open" },
        { label: "Press kit", href: "#press" },
      ],
    },
    {
      title: "Work",
      links: [
        { label: "Case studies", href: "#work" },
        { label: "Archive", href: "#archive" },
        { label: "Playground", href: "#playground" },
        { label: "Awards", href: "#awards" },
      ],
    },
    {
      title: "Elsewhere",
      links: [
        { label: "Instagram", href: "#", external: true },
        { label: "Are.na", href: "#", external: true },
        { label: "LinkedIn", href: "#", external: true },
        { label: "Read.cv", href: "#", external: true },
      ],
    },
  ],
  address = ["2nd floor, 14 Rivington St", "London EC2A 3DU"],
  city = "London",
  timeZone = "Europe/London",
  newsletter = {
    title: "Low Tide",
    body: "A short letter every other Thursday: what we’re making, reading and stealing. No growth hacks.",
    placeholder: "you@domain.com",
    button: "Subscribe",
    success: "You’re in. The next one lands Thursday.",
  },
  onSubscribe,
  legal = "© 2026 Saltmarsh Studio Ltd. Registered in England, no. 13840219.",
  legalLinks = [
    { label: "Privacy", href: "#privacy" },
    { label: "Cookies", href: "#cookies" },
    { label: "Accessibility", href: "#accessibility" },
  ],
  clip = 0.14,
}: FooterWordmarkProps) {
  const reduce = useReducedMotion();

  return (
    <footer className="relative isolate overflow-hidden bg-[#050506] text-white">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div aria-hidden="true" className="absolute bottom-0 left-1/2 -z-10 h-[420px] w-[1200px] max-w-[180%] -translate-x-1/2 translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.08),transparent)]" />
      <div className="mx-auto max-w-[1440px] px-5 pt-16 sm:px-8 sm:pt-20 lg:px-12 lg:pt-24">
        {/* Closing line + email */}
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="max-w-[17ch] font-display text-[clamp(2.4rem,1.3rem+4.4vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.05em]">{headline}</h2>
            <a
              href={`mailto:${email}`}
              className="group mt-8 inline-flex max-w-full items-center gap-3 font-display text-[clamp(1.25rem,0.9rem+1.6vw,2.25rem)] font-semibold tracking-[-0.035em] outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-4 focus-visible:ring-offset-black transition-transform duration-150 active:scale-[0.99]"
            >
              <span className="truncate bg-[linear-gradient(currentColor,currentColor)] bg-[length:100%_2px] bg-bottom bg-no-repeat pb-1 transition-[background-size] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-[length:0%_2px] group-hover:bg-right-bottom">
                {email}
              </span>
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:rotate-[-45deg] sm:size-12">
                <svg viewBox="0 0 16 16" className="size-4 sm:size-5" fill="none">
                  <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </a>
          </div>
          <BackToTop reduce={!!reduce} />
        </div>

        {/* Columns */}
        <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-12 border-t-2 border-white/15 pt-10 sm:grid-cols-4 lg:mt-24 lg:grid-cols-12 lg:gap-x-8">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="lg:col-span-2">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">{col.title}</h3>
              <ul className="mt-4 space-y-1">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target={l.external ? "_blank" : undefined}
                      rel={l.external ? "noreferrer" : undefined}
                      className="group inline-flex min-h-9 items-center gap-1.5 text-[17px] font-medium tracking-[-0.015em] outline-none focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 transition-transform duration-150 active:scale-[0.97]"
                    >
                      <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1.5px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 group-hover:bg-[length:100%_1.5px]">
                        {l.label}
                      </span>
                      {l.external ? (
                        <span aria-hidden="true" className="text-[13px] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                          ↗
                        </span>
                      ) : null}
                      {l.note ? <span className="rounded-full bg-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white/80">{l.note}</span> : null}
                      {l.external ? <span className="sr-only">(opens in a new tab)</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="lg:col-span-2">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Visit</h3>
            <address className="mt-4 text-[17px] not-italic leading-[1.45] tracking-[-0.015em]">
              {address.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
            <LocalTime city={city} timeZone={timeZone} />
          </div>

          <Newsletter {...newsletter} onSubscribe={onSubscribe} reduce={!!reduce} />
        </div>

        {/* Legal */}
        <div className="mt-14 flex flex-col gap-3 border-t border-white/[0.08] py-5 font-mono text-[11px] uppercase tracking-[0.12em] text-white/55 lg:flex-row lg:items-center lg:justify-between">
          <p>{legal}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {legalLinks.map((l) => (
              <li key={l.label}>
                <a href={l.href} className="inline-flex min-h-8 items-center outline-none hover:text-white focus-visible:underline transition-transform duration-150 active:scale-[0.97]">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <Wordmark text={wordmark} clip={clip} reduce={!!reduce} />
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */

type Box = { x: number; w: number; asc: number };

/**
 * The giant word. Rendered as SVG text at 100 units and measured with canvas
 * (actual ink bounds, tracking included) so the viewBox hugs the glyphs:
 * the word spans the container edge to edge at any width, and the bottom of
 * the viewBox stops above the baseline so the letters sink into the floor.
 */
function Wordmark({ text, clip, reduce }: { text: string; clip: number; reduce: boolean }) {
  const ref = useRef<SVGTextElement>(null);
  const [box, setBox] = useState<Box>({ x: 0, w: text.length * 58, asc: 74 });
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    let live = true;
    const measure = () => {
      const el = ref.current;
      const ctx = document.createElement("canvas").getContext("2d");
      if (!el || !ctx || !live) return;
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      const m = ctx.measureText(text);
      const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      if (w > 0) {
        setBox({ x: -m.actualBoundingBoxLeft, w, asc: m.actualBoundingBoxAscent });
        setMeasured(true);
      }
    };
    measure();
    document.fonts?.ready.then(measure);
    return () => {
      live = false;
    };
  }, [text]);

  const c = Math.min(Math.max(clip, 0), 0.3);
  const h = box.asc * (1 - c);

  return (
    <motion.svg
      aria-hidden="true"
      viewBox={`${box.x} ${-box.asc} ${box.w} ${h}`}
      className="mt-6 block w-full select-none overflow-hidden sm:mt-8"
      initial={false}
      animate={{ opacity: measured ? 1 : 0, y: measured || reduce ? 0 : 24 }}
      transition={{ duration: reduce ? 0 : 0.8, ease }}
    >
      <defs>
        <linearGradient id="footer-wordmark-metal" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#a1a1aa" stopOpacity="0.5" />
          <stop offset="1" stopColor="#3f3f46" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <text ref={ref} x="0" y="0" fontSize="100" fill="url(#footer-wordmark-metal)" className="font-display font-semibold tracking-[-0.065em]">
        {text}
      </text>
    </motion.svg>
  );
}

function LocalTime({ city, timeZone }: { city: string; timeZone: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const parts = now
    ? new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" }).formatToParts(now)
    : null;
  const get = (t: string) => parts?.find((p) => p.type === t)?.value ?? "";
  const hh = parts ? get("hour") : "--";
  const mm = parts ? get("minute") : "--";
  const zone = parts ? get("timeZoneName") : "";

  return (
    <div className="mt-6">
      <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-40 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-white" />
        </span>
        Local time{zone ? ` · ${zone}` : ""}
      </p>
      <p className="mt-1.5 font-display text-[22px] font-semibold tracking-[-0.03em]">
        {city}{" "}
        <time className="tabular-nums" dateTime={now ? now.toISOString() : undefined}>
          {hh}
          <span className="animate-pulse motion-reduce:animate-none">:</span>
          {mm}
        </time>
      </p>
    </div>
  );
}

function Newsletter({
  title,
  body,
  placeholder,
  button,
  success,
  onSubscribe,
  reduce,
}: NonNullable<FooterWordmarkProps["newsletter"]> & { onSubscribe?: (email: string) => void; reduce: boolean }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "error" | "done">("idle");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return setState("error");
    onSubscribe?.(value.trim());
    setState("done");
  };

  return (
    <div className="col-span-2 sm:col-span-4 sm:grid sm:grid-cols-2 sm:gap-x-8 lg:col-span-4 lg:col-start-9 lg:block">
      <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Newsletter</h3>
      <p className="mt-4 font-sans text-[26px] font-semibold leading-none tracking-[-0.035em]">{title}</p>
      <p className="mt-2 max-w-[40ch] text-[15px] leading-relaxed text-white/60">{body}</p>
      </div>
      <div className="mt-5 min-h-[56px] sm:mt-9 lg:mt-5">
        <AnimatePresence mode="wait" initial={false}>
          {state === "done" ? (
            <motion.p
              key="done"
              role="status"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
              className="flex h-14 items-center gap-3 rounded-full bg-white px-5 text-[15px] font-medium text-black"
            >
              <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" aria-hidden="true">
                <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {success}
            </motion.p>
          ) : (
            <motion.form key="form" noValidate onSubmit={submit} exit={reduce ? undefined : { opacity: 0, y: -8, transition: { duration: 0.2 } }}>
              <label htmlFor={id} className="sr-only">
                Email address
              </label>
              <div
                className={`flex h-14 items-center rounded-full border-2 bg-white/[0.04] p-1 pl-5 transition-colors focus-within:bg-white/[0.07] ${
                  state === "error" ? "border-[#f87171]" : "border-white/15"
                }`}
              >
                <input
                  id={id}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={value}
                  placeholder={placeholder}
                  aria-invalid={state === "error"}
                  aria-describedby={state === "error" ? `${id}-err` : undefined}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (state === "error") setState("idle");
                  }}
                  className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-white/35"
                />
                <button
                  type="submit"
                  className="h-full shrink-0 rounded-full bg-white px-5 text-[14px] font-semibold text-black outline-none transition-transform hover:-translate-y-px active:translate-y-0 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  {button}
                </button>
              </div>
              <p id={`${id}-err`} aria-live="polite" className="mt-2 min-h-5 pl-5 text-[13px] font-medium text-[#fca5a5]">
                {state === "error" ? "That doesn’t look like an email address yet." : ""}
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BackToTop({ reduce }: { reduce: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
      className="group flex shrink-0 items-center gap-3 self-start text-[15px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-4 focus-visible:ring-offset-black md:flex-col md:items-end md:self-end transition-transform duration-150 active:scale-[0.97]"
    >
      <span className="flex size-14 items-center justify-center overflow-hidden rounded-full border-2 border-white/15 lg:size-20">
        <svg viewBox="0 0 16 16" className="size-5 transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 lg:size-6" fill="none" aria-hidden="true">
          <path d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.16em]">Back to top</span>
    </button>
  );
}

export default FooterWordmark;
