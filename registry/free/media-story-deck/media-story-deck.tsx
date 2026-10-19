"use client";
import { type CSSProperties, useLayoutEffect, useSyncExternalStore, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion, useAnimationControls } from "motion/react";

const control = [
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm",
  "font-medium transition-[background,transform] duration-150 hover:bg-[var(--wash)]",
  "disabled:hover:bg-transparent active:scale-[.97] focus-visible:outline-2",
  "focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed",
  "disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none",
].join(" ");
const muted = "text-[var(--muted)]";
function colors(theme: "dark" | "light"): CSSProperties {
  return {
    overflowWrap: "anywhere",
    "--panel": theme === "dark" ? "#111111" : "#ffffff",
    "--ink": theme === "dark" ? "#f5f5f5" : "#171717",
    "--muted": theme === "dark" ? "#a3a3a3" : "#525252",
    "--line": theme === "dark" ? "#333333" : "#d4d4d4",
    "--wash": theme === "dark" ? "#242424" : "#f0f0f0",
  } as CSSProperties;
}

export type StorySlide = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  figure: string;
  caption: string;
  pattern: "orbit" | "grid" | "steps";
};
export type StoryDeckProps = {
  label?: string;
  slides?: StorySlide[];
  defaultIndex?: number;
  onSlideChange?: (index: number) => void;
  theme?: "dark" | "light";
};
const defaults: StorySlide[] = [
  {
    id: "observe",
    kicker: "01 / Observe",
    title: "Start with the quiet details.",
    description:
      "The pauses, the workarounds, the things people stopped noticing. That is where the useful questions begin.",
    figure: "12",
    caption: "conversations before a single sketch",
    pattern: "orbit",
  },
  {
    id: "shape",
    kicker: "02 / Shape",
    title: "Give one idea room to grow.",
    description:
      "Put it in front of someone. Watch what they do, then change the part that gets in the way.",
    figure: "03",
    caption: "directions reduced to one clear path",
    pattern: "grid",
  },
  {
    id: "refine",
    kicker: "03 / Refine",
    title: "Make the last ten percent count.",
    description:
      "The keyboard route, the empty state, the answer that takes a little longer. This is where trust is earned.",
    figure: "01",
    caption: "system, considered from every angle",
    pattern: "steps",
  },
];
function StoryPanel({ slide, index, count }: { slide: StorySlide; index: number; count: number }) {
  const { reduced, entrance } = useLiveEntrance();
  return (
    <motion.div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}: ${slide.title}`}
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      className="grid @2xl:grid-cols-2"
    >
      <div className="relative min-h-64 overflow-hidden border-b border-[var(--line)] bg-[var(--wash)] @2xl:min-h-96 @2xl:border-b-0 @2xl:border-r">
        <svg
          aria-hidden="true"
          viewBox="0 0 400 340"
          className="absolute inset-0 h-full w-full text-[var(--muted)]"
          fill="none"
          stroke="currentColor"
          strokeWidth=".8"
        >
          {slide.pattern === "orbit"
            ? [55, 85, 115, 145].map((r) => (
                <ellipse
                  key={r}
                  cx="200"
                  cy="170"
                  rx={r}
                  ry={r * 0.65}
                  transform="rotate(-28 200 170)"
                />
              ))
            : slide.pattern === "grid"
              ? Array.from({ length: 8 }, (_, i) => (
                  <g key={i}>
                    <path d={`M ${60 + i * 40} 30 V 310`} />
                    <path d={`M 40 ${30 + i * 40} H 360`} />
                  </g>
                ))
              : Array.from({ length: 7 }, (_, i) => (
                  <rect
                    key={i}
                    x={60 + i * 28}
                    y={240 - i * 28}
                    width="64"
                    height="64"
                    className="fill-[var(--wash)]"
                  />
                ))}
        </svg>
        <span className="absolute bottom-5 left-6 font-mono text-xs uppercase tracking-wider">
          {slide.kicker}
        </span>
      </div>
      <div className="flex min-w-0 flex-col p-6 @lg:p-8">
        <p className={`mb-5 font-mono text-xs ${muted}`}>{slide.kicker}</p>
        <h2 className="max-w-xs font-serif text-4xl leading-[1.05] tracking-[-.03em]">
          {slide.title}
        </h2>
        <p className={`mt-5 text-sm leading-7 ${muted}`}>
          {slide.description}
        </p>
        <div className="mt-8 flex flex-wrap items-end gap-4 border-t border-[var(--line)] pt-5">
          <span className="min-w-0 max-w-full font-display text-5xl tracking-[-.05em]">
            {slide.figure}
          </span>
          <span className={`max-w-40 text-xs leading-relaxed ${muted}`}>
            {slide.caption}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function StoryDeck({
  label = "The studio process",
  slides = defaults,
  defaultIndex = 0,
  onSlideChange,
  theme = "dark",
}: StoryDeckProps) {
  const [local, setLocal] = useState(defaultIndex);
  const index = slides.length
    ? Math.min(
        slides.length - 1,
        Math.max(0, Number.isFinite(local) ? Math.floor(local) : 0),
      )
    : 0;
  const slide = slides[index];
  function go(next: number) {
    const target = Math.min(slides.length - 1, Math.max(0, next));
    setLocal(target);
    onSlideChange?.(target);
  }
  return (
    <section
      aria-label={label}
      aria-roledescription="carousel"
      style={colors(theme)}
      className="@container w-full max-w-4xl overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]"
    >
      {slide ? (
        <StoryPanel key={slide.id} slide={slide} index={index} count={slides.length} />
      ) : (
        <p className={`p-10 text-sm ${muted}`}>No stories to show yet.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-3">
        <p role="status" className={`font-mono text-xs ${muted}`}>
          {slides.length
            ? `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`
            : "0 / 0"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            data-demo="story-prev"
            disabled={!slides.length || index === 0}
            aria-label="Previous story"
            onClick={() => go(index - 1)}
            className={control}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            data-demo="story-next"
            disabled={!slides.length || index === slides.length - 1}
            aria-label="Next story"
            onClick={() => go(index + 1)}
            className={control}
          >
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(change: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}
function useLiveEntrance() {
  const reduced = useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
  const entrance = useAnimationControls();
  useLayoutEffect(() => {
    entrance.stop();
    if (reduced) entrance.set({ opacity: 1, y: 0 });
    else void entrance.start({ opacity: 1, y: 0, transition: { duration: 0.32 } });
    return () => entrance.stop();
  }, [entrance, reduced]);
  return { reduced, entrance };
}

export default function StoryDeckDemo(overrides: Partial<StoryDeckProps> = {}) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <StoryDeck {...overrides} />
    </div>
  );
}
