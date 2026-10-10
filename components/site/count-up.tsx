"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

const DURATION_S = 0.9;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** The figure starts this blurred and sharpens as it lands. */
const MAX_BLUR_PX = 3;
/** The count starts at most this far below its value, never from zero. */
const MAX_RUN = 15;
/** A figure already on screen this long after load has been read; it stays put rather than dip and recount. */
const SETTLED_AFTER_MS = 1000;

// useLayoutEffect warns on the server; the parking only matters in the browser.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const noSubscribe = () => () => {};

/** Where a count-up starts: just below the value, so the figure reads correctly at every frame. */
export function countStart(value: number): number {
  if (value <= 1) return value;
  return Math.max(1, value - Math.min(MAX_RUN, Math.max(1, Math.round(value * 0.2))));
}

function onScreen(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
}

/**
 * A figure that runs up the last few steps to its value the first time it is
 * seen, then tweens from its previous value whenever `value` changes. The real
 * number is in the server HTML and on screen before any script runs (search
 * engines and no-JS readers see it), and the count only ever starts a short way
 * below it: never from zero. Figures on screen at load count straight away;
 * the rest wait to be scrolled to. Tabular numerals and a reserved width mean
 * nothing around it reflows.
 */
export function CountUp({ value, pad = 0, delay = 0, className = "" }: { value: number; pad?: number; delay?: number; className?: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const digits = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const ran = useRef(false);
  const [armed, setArmed] = useState(false);
  const seen = useInView(root, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  // False while hydrating server HTML (which may already have been read), true on a client navigation.
  const clientMount = useSyncExternalStore(noSubscribe, () => true, () => false);
  const mountedOnClient = useRef(clientMount);
  const format = (n: number) => String(Math.round(n)).padStart(pad, "0");
  // React renders the digits once; after that this component owns the text, frame by frame.
  const [initial] = useState(() => format(value));
  const [sizer, setSizer] = useState(initial);

  // Before the first paint: decide whether this figure counts, and if so park it just below its value.
  useIsoLayoutEffect(() => {
    const el = root.current!;
    const visible = onScreen(el);
    const settled = visible && !mountedOnClient.current && performance.now() > SETTLED_AFTER_MS;
    if (reduce || settled || countStart(value) === value) {
      shown.current = value;
      return;
    }
    shown.current = countStart(value);
    digits.current!.textContent = format(shown.current);
    if (visible) setArmed(true);
  }, []);

  const go = armed || seen;

  useEffect(() => {
    const el = digits.current!;
    const target = format(value);
    if (reduce) {
      el.textContent = target;
      shown.current = value;
      setSizer(target);
      return;
    }
    if (!go) return;
    const from = shown.current ?? value;
    if (from === value) return;
    const first = !ran.current;
    ran.current = true;
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
  }, [value, go, reduce]);

  return (
    // The widest figure reserves the width through a pseudo-element, so the page text reads "89", not "8989".
    <span
      ref={root}
      data-sizer={sizer}
      className={`inline-grid tabular-nums before:invisible before:col-start-1 before:row-start-1 before:content-[attr(data-sizer)] ${className}`}
    >
      <span ref={digits} className="col-start-1 row-start-1 text-right" suppressHydrationWarning>
        {initial}
      </span>
    </span>
  );
}
