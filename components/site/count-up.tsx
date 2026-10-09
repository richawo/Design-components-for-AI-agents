"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const DURATION_S = 0.9;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** The figure starts this blurred and sharpens as it lands. */
const MAX_BLUR_PX = 3;

// useLayoutEffect warns on the server; the parked zero only matters in the browser.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A figure that counts up from zero the first time it is seen, then tweens
 * from its previous value whenever `value` changes. Tabular numerals and a
 * reserved width mean nothing around it reflows. The server renders the final
 * value, so it reads correctly without script (see `.site-count` in globals).
 */
export function CountUp({ value, pad = 0, delay = 0, className = "" }: { value: number; pad?: number; delay?: number; className?: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const digits = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const inView = useInView(root, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const format = (n: number) => String(Math.round(n)).padStart(pad, "0");
  // React renders the digits once; after that this component owns the text, frame by frame.
  const [initial] = useState(() => format(value));
  const [sizer, setSizer] = useState(initial);

  // Park at zero before the first paint, so the figure never flashes its final value.
  useIsoLayoutEffect(() => {
    if (!reduce) digits.current!.textContent = format(0);
    root.current!.setAttribute("data-live", "");
  }, []);

  useEffect(() => {
    const el = digits.current!;
    const target = format(value);
    if (reduce) {
      el.textContent = target;
      shown.current = value;
      setSizer(target);
      return;
    }
    if (!inView) return;
    const from = shown.current ?? 0;
    const first = shown.current === null;
    if (from === value) return;
    setSizer((s) => (s.length >= target.length ? s : target));
    const controls = animate(from, value, {
      duration: DURATION_S,
      delay: first ? delay : 0,
      ease: EASE_OUT,
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = format(v);
        el.style.filter = `blur(${(MAX_BLUR_PX * (1 - (v - from) / (value - from))).toFixed(2)}px)`;
      },
      onComplete: () => {
        el.style.filter = "";
        setSizer(target);
      },
    });
    return () => controls.stop();
    // `format` only depends on `pad`, which never changes for a mounted figure.
  }, [value, inView, reduce]);

  return (
    <span ref={root} className={`site-count inline-grid tabular-nums ${className}`}>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {sizer}
      </span>
      <span ref={digits} className="col-start-1 row-start-1 text-right" suppressHydrationWarning>
        {initial}
      </span>
    </span>
  );
}
