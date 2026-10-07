"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";

type Meta = { label: string; value: string | string[] };
type Stat = { value: string; unit?: string; label: string };

export type CaseStudyHeroProps = {
  eyebrow?: string;
  /** Position in the series, e.g. "07 / 12". */
  index?: string;
  title?: string;
  /** Words inside the title to set in italic serif. Must appear in title verbatim. */
  emphasis?: string;
  intro?: string;
  meta?: Meta[];
  stats?: Stat[];
  back?: { label: string; href: string };
  /** Colour of the cover field behind the devices. */
  coverColor?: string;
};

const ease = [0.2, 0.8, 0.2, 1] as const;

export function CaseStudyHero({
  eyebrow = "Case study — Larder",
  index = "07 / 12",
  title = "The weekly shop, done in four minutes.",
  emphasis = "four minutes.",
  intro = "Larder plans the week around what’s already in your fridge, then fills the basket with only what’s missing. We named it, built the brand and designed the app from first sketch to App Store, in eleven months with a team of nine.",
  meta = [
    { label: "Client", value: "Larder Foods Ltd" },
    { label: "Year", value: "2025—2026" },
    { label: "Role", value: ["Brand identity", "Product design", "Prototyping"] },
    { label: "Deliverables", value: ["iOS & Android app", "Web planner", "Design system", "Launch campaign"] },
  ],
  stats = [
    { value: "4", unit: "min", label: "Median weekly shop, down from 22 minutes before Larder." },
    { value: "31", unit: "%", label: "Less food binned across 2,400 households in the pilot." },
    { value: "4.8", unit: "/5", label: "Average App Store rating from 12,300 reviews since March." },
  ],
  back = { label: "All work", href: "#work" },
  coverColor = "#1b8a4f",
}: CaseStudyHeroProps) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const rise = (delay: number, y = 24) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, ease, delay } };

  const [before, after] = emphasis && title.includes(emphasis) ? title.split(emphasis) : [title, ""];
  const hasEm = !!emphasis && title.includes(emphasis);

  return (
    <section aria-labelledby={titleId} className="bg-[#fbfaf6] text-[#141414]">
      <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-8 sm:px-8 lg:px-12 lg:pb-24 lg:pt-10">
        {/* Top row */}
        <div className="flex items-center justify-between gap-6 font-mono text-[11px] uppercase tracking-[0.14em] text-[#141414]/60 sm:text-xs">
          <a href={back.href} className="group inline-flex min-h-11 items-center gap-2 outline-none hover:text-[#141414] focus-visible:text-[#141414] focus-visible:underline">
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:-translate-x-1">
              ←
            </span>
            {back.label}
          </a>
          <span className="tabular-nums">{index}</span>
        </div>

        {/* Title */}
        <motion.p {...rise(0, 12)} className="mt-12 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] sm:mt-16 sm:text-xs">
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: coverColor }} />
          {eyebrow}
        </motion.p>
        <motion.h1
          id={titleId}
          {...rise(0.06)}
          className="mt-5 max-w-[14ch] font-display text-[clamp(3rem,1.2rem+7.2vw,8.75rem)] font-extrabold leading-[0.9] tracking-[-0.055em]"
        >
          {before}
          {hasEm ? <span className="font-serif font-normal italic tracking-[-0.035em]" style={{ color: coverColor }}>{emphasis}</span> : null}
          {after}
        </motion.h1>

        {/* Intro + meta */}
        <motion.div {...rise(0.14)} className="mt-12 grid gap-10 border-t border-[#141414]/15 pt-8 lg:mt-16 lg:grid-cols-12 lg:gap-8">
          <p className="max-w-[46ch] text-[17px] leading-[1.6] text-[#141414]/80 lg:col-span-5 lg:text-lg">{intro}</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4 lg:col-span-7 lg:col-start-6">
            {meta.map((m) => (
              <div key={m.label}>
                <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#141414]/55">{m.label}</dt>
                {(Array.isArray(m.value) ? m.value : [m.value]).map((v) => (
                  <dd key={v} className="mt-1.5 text-[15px] font-medium leading-snug tracking-[-0.01em] first-of-type:mt-2.5">
                    {v}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        </motion.div>

        {/* Cover */}
        <motion.figure
          {...(reduce ? {} : { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1, ease, delay: 0.2 } })}
          className="@container relative mt-12 aspect-square overflow-hidden rounded-[24px] sm:aspect-[4/3] lg:mt-16 lg:aspect-[16/9] lg:rounded-[32px]"
          style={{ background: coverColor }}
        >
          <figcaption className="sr-only">The Larder web planner on a laptop and the basket screen on a phone.</figcaption>
          <CoverBackdrop />
          <motion.div
            {...(reduce ? {} : { initial: { y: "8%", opacity: 0 }, animate: { y: "0%", opacity: 1 }, transition: { duration: 1.1, ease, delay: 0.35 } })}
            className="absolute left-[5%] top-[14%] w-[118%] sm:left-[7%] sm:top-[12%] sm:w-[78%] lg:left-[11%] lg:top-[11%] lg:w-[64%]"
          >
            <Laptop />
          </motion.div>
          <motion.div
            {...(reduce ? {} : { initial: { y: "18%", opacity: 0, rotate: 0 }, animate: { y: "0%", opacity: 1, rotate: 5 }, transition: { duration: 1.1, ease, delay: 0.5 } })}
            style={reduce ? { rotate: 5 } : undefined}
            className="absolute bottom-[5%] right-[6%] w-[37%] sm:bottom-[6%] sm:right-[7%] sm:w-[25%] lg:bottom-[7%] lg:right-[12%] lg:w-[17%]"
          >
            <Phone />
          </motion.div>
        </motion.figure>

        {/* Results */}
        <div className="mt-12 lg:mt-16">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#141414]/55 sm:text-xs">Results, six months after launch</h2>
          <ul className="mt-6 grid gap-0 sm:grid-cols-3 sm:gap-8">
            {stats.map((s, n) => (
              <motion.li
                key={s.label}
                {...rise(0.55 + n * 0.08, 16)}
                className="border-t-2 border-[#141414] py-6 sm:pb-0"
              >
                <p className="font-display text-[clamp(3.5rem,2.4rem+3.6vw,6.5rem)] font-extrabold leading-none tracking-[-0.06em] tabular-nums">
                  {s.value}
                  {s.unit ? <span className="ml-1 font-serif text-[0.5em] font-normal italic tracking-[-0.02em]" style={{ color: coverColor }}>{s.unit}</span> : null}
                </p>
                <p className="mt-3 max-w-[30ch] text-[15px] leading-relaxed text-[#141414]/75">{s.label}</p>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Cover art. Everything below is decorative and sized in container     */
/* query units, so the composition scales as one picture.               */
/* ------------------------------------------------------------------ */

const ui = {
  cream: "#fff8ec",
  paper: "#fffdf8",
  ink: "#1d2b22",
  green: "#1b8a4f",
  yolk: "#ffd43b",
  radish: "#ff7a8a",
  line: "#eadfca",
};

function CoverBackdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="absolute -right-[8%] -top-[18%] aspect-square w-[62%] rounded-full sm:w-[44%] lg:w-[34%]" style={{ background: ui.yolk }} />
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{ backgroundImage: "radial-gradient(circle, #fff8ec 1.2px, transparent 1.4px)", backgroundSize: "22px 22px" }}
      />
      <p className="absolute left-[5%] top-[4.5%] hidden font-mono sm:block text-[10px] uppercase tracking-[0.16em] text-[#fff8ec]/75 sm:text-[11px] lg:left-[4%]">
        Larder — Planner v3.2 / Basket
      </p>
    </div>
  );
}

function Laptop() {
  return (
    <div aria-hidden="true" className="@container relative drop-shadow-[0_30px_40px_rgba(10,40,20,0.35)]">
      <div className="rounded-t-[2.6cqw] bg-[#121412] p-[1cqw] pb-[1.2cqw]">
        <div className="@container relative aspect-[16/10] overflow-hidden rounded-[0.6cqw]" style={{ background: ui.paper }}>
          <PlannerScreen />
        </div>
      </div>
      {/* Base */}
      <div className="relative -mx-[6%] h-[1.8cqw] rounded-b-[1.4cqw] bg-[#d9d6cf] shadow-[inset_0_0.3cqw_0_#ece9e2]">
        <div className="absolute left-1/2 top-0 h-[40%] w-[14%] -translate-x-1/2 rounded-b-[0.8cqw] bg-[#b9b5ac]" />
      </div>
    </div>
  );
}

const week = [
  { day: "Mon", meal: "Miso aubergine", time: "25 min", tone: ui.radish, tag: "", items: [["Aubergine", 0], ["Miso", 0], ["Rice", 1], ["Spring onion", 1]] },
  { day: "Tue", meal: "Leftover ragù rigatoni", time: "15 min", tone: ui.yolk, tag: "Leftovers", items: [["Ragù", 1], ["Rigatoni", 1], ["Parmesan", 1]] },
  { day: "Wed", meal: "Chickpea & feta traybake", time: "40 min", tone: "#9fd8b4", tag: "Uses feta", items: [["Chickpeas", 1], ["Feta", 1], ["Spinach", 1], ["Red onion", 0]] },
  { day: "Thu", meal: "Crispy fish tacos", time: "30 min", tone: ui.radish, tag: "", items: [["Cod", 0], ["Tortillas", 0], ["Limes", 0], ["Cabbage", 0]] },
  { day: "Fri", meal: "Pizza night", time: "Out", tone: ui.ink, tag: "Booked", items: [["Bianchi’s, 7:30pm", 1]] },
] as const;

function PlannerScreen() {
  return (
    <div className="flex size-full text-[1.25cqw] leading-tight" style={{ color: ui.ink }}>
      {/* Sidebar */}
      <div className="flex w-[17cqw] shrink-0 flex-col gap-[0.6cqw] border-r p-[1.6cqw]" style={{ borderColor: ui.line, background: ui.cream }}>
        <div className="mb-[1.6cqw] flex items-center gap-[0.8cqw] font-display text-[1.9cqw] font-bold tracking-[-0.04em]">
          <span className="size-[1.9cqw] rounded-full" style={{ background: ui.green, boxShadow: `inset -0.5cqw -0.4cqw 0 ${ui.yolk}` }} />
          Larder
        </div>
        {["This week", "Pantry", "Recipes", "Lists", "Household"].map((l, i) => (
          <div
            key={l}
            className="flex items-center justify-between rounded-[0.7cqw] px-[1cqw] py-[0.7cqw] font-medium"
            style={i === 0 ? { background: ui.ink, color: ui.cream } : { opacity: 0.7 }}
          >
            {l}
            {i === 1 ? <span className="rounded-full px-[0.6cqw] text-[0.95cqw] font-semibold" style={{ background: ui.radish, color: ui.ink }}>3</span> : null}
          </div>
        ))}
        <div className="mt-auto flex items-center gap-[0.8cqw]">
          <span className="flex size-[2.6cqw] items-center justify-center rounded-full text-[1cqw] font-semibold" style={{ background: ui.yolk }}>
            MO
          </span>
          <span className="text-[1.05cqw] opacity-70">Mara & Olu</span>
        </div>
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col p-[2cqw]">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[0.9cqw] uppercase tracking-[0.12em] opacity-60">Week of 12 October</p>
            <p className="mt-[0.4cqw] font-display text-[3cqw] font-bold tracking-[-0.045em]">Four dinners, two from leftovers</p>
          </div>
          <span className="rounded-full px-[1.2cqw] py-[0.6cqw] text-[1.1cqw] font-semibold" style={{ background: ui.green, color: ui.cream }}>
            Fill basket
          </span>
        </div>
        <div className="mt-[1.8cqw] grid grid-cols-5 gap-[1cqw]">
          {week.map((d) => (
            <div key={d.day} className="flex flex-col rounded-[1cqw] border p-[0.8cqw]" style={{ borderColor: ui.line, background: "#fff" }}>
              <p className="font-mono text-[0.9cqw] uppercase tracking-[0.1em] opacity-60">{d.day}</p>
              <div className="relative mt-[0.6cqw] aspect-[4/3] overflow-hidden rounded-[0.7cqw]" style={{ background: d.tone }}>
                <Plate dark={d.tone === ui.ink} />
              </div>
              <p className="mt-[0.8cqw] font-semibold tracking-[-0.02em]">{d.meal}</p>
              <p className="mt-[0.3cqw] text-[1cqw] opacity-60">{d.time}</p>
              <div className="mt-[1cqw] flex flex-col gap-[0.55cqw] border-t pt-[0.9cqw] text-[1cqw]" style={{ borderColor: ui.line }}>
                {d.items.map(([name, have]) => (
                  <span key={name} className="flex items-center gap-[0.5cqw]">
                    <span className="size-[0.7cqw] shrink-0 rounded-full" style={{ background: have ? ui.green : "transparent", boxShadow: have ? undefined : `inset 0 0 0 0.18cqw ${ui.radish}` }} />
                    <span className={have ? "opacity-60" : ""}>{name}</span>
                  </span>
                ))}
              </div>
              {d.tag ? (
                <span className="mt-auto self-start rounded-full px-[0.7cqw] py-[0.25cqw] text-[0.9cqw] font-semibold" style={{ background: ui.cream }}>
                  {d.tag}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-[1.4cqw] grid flex-1 grid-cols-[1.6fr_1fr] gap-[1cqw]">
          <div className="flex flex-col rounded-[1cqw] p-[1.2cqw]" style={{ background: ui.cream }}>
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[0.9cqw] uppercase tracking-[0.12em] opacity-60">Weekly spend</p>
              <p className="text-[1cqw] opacity-60">£22 under your September average</p>
            </div>
            <div className="mt-[1cqw] flex flex-1 items-end gap-[0.8cqw]">
              {[72, 80, 66, 88, 61, 58, 52, 44].map((h, i, a) => (
                <span key={i} className="flex-1 rounded-t-[0.4cqw]" style={{ height: `${h}%`, background: i === a.length - 1 ? ui.green : ui.line }} />
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-[1cqw] p-[1.2cqw]" style={{ background: ui.ink, color: ui.cream }}>
            <p className="font-mono text-[0.9cqw] uppercase tracking-[0.12em] opacity-70">Saved from the bin</p>
            <p className="font-display text-[3.6cqw] font-bold leading-none tracking-[-0.05em]">
              3.2<span className="text-[1.6cqw] font-semibold" style={{ color: ui.yolk }}> kg</span>
            </p>
            <p className="text-[1cqw] opacity-70">since you joined in May</p>
          </div>
        </div>
        <div className="mt-[1.4cqw] flex items-center gap-[0.8cqw]">
          <span className="font-mono text-[0.9cqw] uppercase tracking-[0.12em] opacity-60">Use it up</span>
          {[
            ["Spinach", "2 days"],
            ["Feta", "3 days"],
            ["Lemons", "5 days"],
          ].map(([a, b], i) => (
            <span key={a} className="flex items-center gap-[0.5cqw] rounded-full border px-[0.9cqw] py-[0.4cqw] text-[1.05cqw]" style={{ borderColor: ui.line }}>
              <span className="size-[0.8cqw] rounded-full" style={{ background: i === 0 ? ui.radish : ui.yolk }} />
              {a} <span className="opacity-55">· {b}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Basket */}
      <div className="hidden w-[21cqw] shrink-0 flex-col border-l p-[1.6cqw] @[200px]:flex" style={{ borderColor: ui.line, background: ui.cream }}>
        <p className="font-mono text-[0.9cqw] uppercase tracking-[0.12em] opacity-60">Basket</p>
        <p className="mt-[0.4cqw] font-display text-[2.4cqw] font-bold tabular-nums tracking-[-0.04em]">£48.20</p>
        <div className="mt-[1.2cqw] flex flex-col gap-[0.9cqw]">
          {[
            ["Aubergines ×2", "1.60"],
            ["White miso", "3.25"],
            ["Corn tortillas", "1.95"],
            ["Cod fillets", "6.40"],
            ["Limes ×4", "1.20"],
            ["Red cabbage", "0.95"],
          ].map(([a, b]) => (
            <div key={a} className="flex justify-between border-b pb-[0.7cqw] text-[1.1cqw]" style={{ borderColor: ui.line }}>
              <span>{a}</span>
              <span className="tabular-nums opacity-70">£{b}</span>
            </div>
          ))}
        </div>
        <p className="mt-[1cqw] text-[1cqw] opacity-60">+ 8 more, all for this week</p>
        <span className="mt-auto rounded-[0.8cqw] py-[0.9cqw] text-center text-[1.1cqw] font-semibold" style={{ background: ui.yolk }}>
          Book Thursday, 6–7pm
        </span>
      </div>
    </div>
  );
}

function Plate({ dark }: { dark: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative aspect-square w-[62%] rounded-full" style={{ background: dark ? ui.yolk : ui.paper, boxShadow: `0 0 0 0.35cqw ${dark ? "#2d3d33" : "rgba(255,255,255,0.45)"}` }}>
        <span className="absolute left-[24%] top-[26%] size-[26%] rounded-full" style={{ background: dark ? ui.radish : ui.green }} />
        <span className="absolute bottom-[24%] right-[22%] size-[34%] rounded-full" style={{ background: dark ? ui.paper : ui.yolk }} />
        <span className="absolute bottom-[28%] left-[30%] size-[14%] rounded-full" style={{ background: dark ? ui.green : ui.radish }} />
      </div>
    </div>
  );
}

function Phone() {
  const items = [
    { name: "Aubergines", qty: "2", done: true },
    { name: "White miso", qty: "1 tub", done: true },
    { name: "Cod fillets", qty: "4", done: true },
    { name: "Corn tortillas", qty: "12", done: false },
    { name: "Limes", qty: "4", done: false },
    { name: "Red cabbage", qty: "½", done: false },
  ];
  return (
    <div aria-hidden="true" className="@container drop-shadow-[0_30px_40px_rgba(10,40,20,0.4)]">
      <div className="rounded-[16cqw] bg-[#121412] p-[3.4cqw]">
        <div className="@container relative aspect-[9/19.5] overflow-hidden rounded-[13cqw]" style={{ background: ui.cream, color: ui.ink }}>
          <div className="absolute left-1/2 top-[2.2%] h-[3.4%] w-[32%] -translate-x-1/2 rounded-full bg-[#121412]" />
          <div className="flex h-full flex-col px-[7cqw] pb-[7cqw] pt-[22cqw] text-[5.2cqw] leading-tight">
            <p className="font-mono text-[3.6cqw] uppercase tracking-[0.12em] opacity-60">Thursday delivery</p>
            <p className="mt-[1.5cqw] font-display text-[11cqw] font-bold leading-none tracking-[-0.05em]">Basket</p>
            <div className="mt-[4cqw] h-[2cqw] overflow-hidden rounded-full" style={{ background: ui.line }}>
              <div className="h-full w-1/2 rounded-full" style={{ background: ui.green }} />
            </div>
            <p className="mt-[2cqw] text-[4cqw] opacity-60">3 of 6 already in the pantry</p>
            <div className="mt-[5cqw] flex flex-col gap-[3.2cqw]">
              {items.map((it) => (
                <div key={it.name} className="flex items-center gap-[3cqw]">
                  <span
                    className="flex size-[6.5cqw] shrink-0 items-center justify-center rounded-[2cqw] border-[0.6cqw]"
                    style={{ borderColor: it.done ? ui.green : "#c9bfa9", background: it.done ? ui.green : "transparent" }}
                  >
                    {it.done ? (
                      <svg viewBox="0 0 12 12" className="size-[70%]" fill="none">
                        <path d="M2.5 6.5l2.3 2.2L9.5 3.5" stroke={ui.cream} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  <span className={`flex-1 font-medium ${it.done ? "line-through opacity-45" : ""}`}>{it.name}</span>
                  <span className="text-[4.2cqw] opacity-55">{it.qty}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto rounded-[4cqw] border-[0.5cqw] p-[4.5cqw]" style={{ borderColor: ui.line }}>
              <p className="font-mono text-[3.4cqw] uppercase tracking-[0.12em] opacity-60">Slot</p>
              <p className="mt-[1cqw] font-semibold">Thu 15 Oct, 6–7pm</p>
              <p className="mt-[0.5cqw] text-[4cqw] opacity-60">Free over £40 · Greenline Grocers</p>
            </div>
            <div className="mt-[3cqw] flex items-center justify-between rounded-[4cqw] px-[5cqw] py-[4.5cqw] font-semibold" style={{ background: ui.ink, color: ui.cream }}>
              <span>Check out</span>
              <span className="tabular-nums" style={{ color: ui.yolk }}>
                £48.20
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CaseStudyHero;
