"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion, useReducedMotion } from "motion/react";

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
  /** Light colours, hottest first: core, mid, outer. */
  glow?: [string, string, string];
  /** Size of one dither cell in CSS pixels. 3 reads as texture, 5 as pixel art. */
  cell?: number;
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
  cell = 3,
}: CtaHorizonProps) {
  const reduce = !!useReducedMotion();
  const notesRef = useRef<HTMLUListElement>(null);
  const i = headline.indexOf(muted);
  const pre = i >= 0 ? headline.slice(0, i) : headline;
  const post = i >= 0 ? headline.slice(i + muted.length) : "";

  return (
    <section className="bg-black p-3 sm:p-5 lg:p-6">
      <div className="relative isolate mx-auto max-w-[1440px] overflow-hidden rounded-[24px] bg-[#09090b] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.06)] sm:rounded-[32px]">
        <DitherSunrise glow={glow} cell={cell} reduce={reduce} anchorRef={notesRef} />

        <div className="relative flex min-h-[560px] flex-col items-center px-6 pb-14 pt-16 text-center sm:min-h-[640px] sm:px-12 sm:pt-24 lg:min-h-[700px] lg:pt-28">
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.6, ease }}
            className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/55"
          >
            <span className="h-px w-6 bg-white/25" aria-hidden="true" />
            {eyebrow}
            <span className="h-px w-6 bg-white/25" aria-hidden="true" />
          </motion.p>

          <motion.h2
            initial={reduce ? false : { opacity: 0, y: 18, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.9, ease, delay: 0.05 }}
            className="mt-7 max-w-[16ch] text-balance font-display text-[clamp(2.5rem,1.4rem+4.6vw,5.75rem)] font-semibold leading-[0.98] tracking-[-0.055em]"
          >
            {pre}
            {i >= 0 ? <span className="text-white/45">{muted}</span> : null}
            {post}
          </motion.h2>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.8, ease, delay: 0.12 }}
            className="mt-6 max-w-[48ch] text-balance text-[16px] leading-relaxed text-white/60 sm:text-[17px]"
          >
            {body}
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.8, ease, delay: 0.2 }}
            className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
          >
            <a
              href={primary.href}
              className="group relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-medium text-black shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_10px_30px_-10px_rgba(255,255,255,0.35)] transition-[box-shadow,background-color,scale] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#fffaf5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.98] active:duration-100 sm:w-auto"
              style={{ ["--cta-glow" as string]: glow[1] }}
            >
              {/* Hover only warms the light under the button; nothing jumps. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-6 -bottom-2 h-6 rounded-full opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-70"
                style={{ background: "var(--cta-glow)" }}
              />
              <span className="relative">{primary.label}</span>
              <svg viewBox="0 0 16 16" className="relative size-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5" fill="none" aria-hidden="true">
                <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a
              href={secondary.href}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-black/45 px-6 text-[15px] font-medium text-white/85 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] backdrop-blur-md transition-[color,background-color,box-shadow,scale] duration-200 hover:bg-black/55 hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.24)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.98] sm:w-auto"
            >
              {secondary.label}
            </a>
          </motion.div>

          <ul ref={notesRef} className="mt-auto grid w-full max-w-4xl gap-2 pt-36 sm:pt-24 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55 sm:grid-cols-3 sm:gap-6">
            {notes.map((n, k) => (
              <motion.li
                key={n}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.8 }}
                transition={{ duration: 0.6, ease, delay: 0.5 + k * 0.08 }}
                className="flex items-center justify-center gap-2.5 [text-shadow:0_1px_12px_rgba(0,0,0,0.8)]"
              >
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
/* Dither sunrise: ordered (Bayer 8×8) dithering of a light field      */
/* ------------------------------------------------------------------ */

const BAYER = (() => {
  // Classic recursive Bayer matrix, normalised to (0, 1).
  const m = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
  ];
  return Float32Array.from(m.flat(), (v) => (v + 0.5) / 64);
})();

function hex(c: string): [number, number, number] {
  const h = c.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (x) => x + x) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function DitherSunrise({
  glow,
  cell,
  reduce,
  anchorRef,
}: {
  glow: [string, string, string];
  cell: number;
  reduce: boolean;
  /** The horizon sits just above this element (the notes), so copy never lands on the sun. */
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorKey = glow.join(",");

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d")!;
    // Levels from dark to hot. Level 1 is the outer colour pulled toward the panel.
    const base: [number, number, number] = [9, 9, 11];
    const [core, mid, outer] = colorKey.split(",").map(hex);
    const dimOuter = outer.map((v, k) => Math.round(base[k] + (v - base[k]) * 0.45)) as [number, number, number];
    const levels = [base, dimOuter, outer, mid, core];
    const L = levels.length - 1;

    let w = 0;
    let h = 0;
    let scale = 1;
    let horizon = 0;
    let img: ImageData | null = null;
    // One dither cell = `cell` CSS px. The canvas covers whole cells and the
    // host clips the overhang, so cells stay square at every size.
    const resize = () => {
      const r = canvas.parentElement!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.ceil(r.width / cell));
      h = Math.max(1, Math.ceil(r.height / cell));
      scale = cell * dpr;
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.style.width = `${w * cell}px`;
      canvas.style.height = `${h * cell}px`;
      off.width = w;
      off.height = h;
      img = octx.createImageData(w, h);
    };
    // Re-measured every frame: fonts and copy can move the notes without
    // resizing anything an observer would see.
    const place = () => {
      const r = canvas.parentElement!.getBoundingClientRect();
      const anchor = anchorRef?.current;
      const a = (anchor?.firstElementChild ?? anchor)?.getBoundingClientRect();
      horizon = a ? Math.max(Math.round(h * 0.5), Math.min(h - 4, Math.floor((a.top - r.top - 40) / cell))) : Math.round(h * 0.8);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    let visible = false;
    let shownAt = 0;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !shownAt) shownAt = performance.now();
    });
    io.observe(canvas);

    // The light leans a little toward the pointer, smoothed.
    let lean = 0;
    let leanTarget = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = canvas.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) return;
      leanTarget = ((e.clientX - r.left) / r.width - 0.5) * 0.12;
    };
    const onLeave = () => (leanTarget = 0);
    const host = canvas.parentElement!.parentElement!;
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);

    const draw = (now: number) => {
      if (!img) return;
      place();
      const data = img.data;
      const t = now / 1000;
      // Rise: 0 → 1 over 1.8s after first view, ease-out expo.
      const k = reduce ? 1 : shownAt ? Math.min(1, (now - shownAt) / 1800) : 0;
      const rise = k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);
      lean += (leanTarget - lean) * 0.06;

      const sx = w * (0.5 + lean);
      const sy = horizon + h * (0.28 - 0.18 * rise); // the sun sits just below the line
      const rx = w * 0.5; // a wide, flat glow: light along the horizon, not up into the copy
      const ry = Math.min(h * 0.36, w * 0.26);
      const shimmer = reduce ? 0 : 0.14;

      for (let y = 0; y < h; y++) {
        const ground = y > horizon;
        // Below the line the light is a mirrored, broken, much fainter reflection.
        const depth = y - horizon;
        const my = ground ? horizon - depth * 1.8 : y;
        const scan = ground ? (depth % 3 === 0 ? 0.1 : 0.42) * Math.max(0, 1 - depth / (h - horizon + 1)) ** 1.5 : 1;
        const band = Math.exp(-Math.abs(my - horizon) / (h * 0.045)); // haze hugging the horizon
        for (let x = 0; x < w; x++) {
          const dx = (x - sx) / rx;
          const dy = (my - sy) / ry;
          const d = Math.sqrt(dx * dx + dy * dy);
          let v = Math.max(0, 1 - d) ** 2.2 * 1.6 + band * 0.6 * Math.max(0, 1 - Math.abs(x - sx) / (w * 0.62)) ** 1.4;
          // Shimmer scales existing light only, so dark areas stay clean black.
          v *= 1 + shimmer * Math.sin(x * 0.21 + t * 1.3) * Math.sin(y * 0.17 - t * 0.9);
          v = Math.min(1, Math.max(0, v * rise * scan));
          // Multi-level ordered dither between adjacent palette levels.
          const q = v * L;
          const lo = Math.floor(q);
          const lvl = Math.min(L, lo + (q - lo > BAYER[(y & 7) * 8 + (x & 7)] ? 1 : 0));
          const c = levels[lvl];
          const o = (y * w + x) * 4;
          data[o] = c[0];
          data[o + 1] = c[1];
          data[o + 2] = c[2];
          data[o + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
      // A crisp hairline on the horizon, brightest under the sun.
      const cx = sx / w;
      const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(Math.min(0.97, Math.max(0.01, cx - 0.38)), "rgba(255,255,255,0)");
      grad.addColorStop(Math.min(0.98, Math.max(0.02, cx)), `rgba(255,255,255,${(0.7 * rise).toFixed(3)})`);
      grad.addColorStop(Math.min(0.99, Math.max(0.03, cx + 0.38)), "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, Math.round((horizon + 1) * scale), canvas.width, Math.max(1, Math.round(scale / cell)));
    };

    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      // 30fps is plenty for drifting light and halves the work.
      if (now - last < 32) return;
      last = now;
      draw(now);
    };
    if (reduce) {
      shownAt = 1;
      const once = () => draw(performance.now());
      const ro2 = new ResizeObserver(once);
      ro2.observe(canvas.parentElement!);
      once();
      return () => {
        ro.disconnect();
        ro2.disconnect();
        io.disconnect();
        host.removeEventListener("pointermove", onMove);
        host.removeEventListener("pointerleave", onLeave);
      };
    }
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [colorKey, cell, reduce]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <canvas ref={canvasRef} className="absolute left-0 top-0 block [image-rendering:pixelated]" />
      {/* Fade the top of the field into the panel so the copy sits on near-black. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#09090b_0%,rgba(9,9,11,0.92)_42%,rgba(9,9,11,0)_72%)]" />
    </div>
  );
}

export default CtaHorizon;
