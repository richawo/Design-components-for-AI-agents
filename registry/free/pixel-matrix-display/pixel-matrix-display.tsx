"use client";

import { useEffect, useRef, useState } from "react";

export type SceneKey = "marquee" | "clock" | "equalizer" | "pulse" | "orbit";

export type PixelMatrixDisplayProps = {
  /** Text for the marquee scene. A–Z, 0–9 and : . - / % + are supported. */
  text?: string;
  /** Scenes to cycle through, in order. */
  scenes?: SceneKey[];
  /** Lit-dot colour. */
  color?: string;
  /** Matrix size. 16 rows renders type at 2× scale. */
  cols?: number;
  rows?: number;
  /** Milliseconds per scene. */
  interval?: number;
  /** Show the caption bar and controls. */
  chrome?: boolean;
  className?: string;
};

/* 5×7 bitmap font. Each glyph is 7 rows; width is the row length. */
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["111", "010", "010", "010", "010", "010", "111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "10001", "11001", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  ":": ["00", "11", "11", "00", "11", "11", "00"],
  ".": ["00", "00", "00", "00", "00", "11", "11"],
  "-": ["0000", "0000", "0000", "1111", "0000", "0000", "0000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
};

/** Rasterise a string into a bitmap (1px gap between glyphs). */
function rasterise(text: string) {
  const glyphs = [...text.toUpperCase()].map((ch) => FONT[ch] ?? FONT[" "]);
  const width = glyphs.reduce((w, g) => w + g[0].length + 1, 0) - 1;
  const bits: number[][] = Array.from({ length: 7 }, () => new Array(Math.max(1, width)).fill(0));
  let x = 0;
  for (const g of glyphs) {
    for (let r = 0; r < 7; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] === "1") bits[r][x + c] = 1;
    x += g[0].length + 1;
  }
  return { bits, width };
}

type Field = (x: number, y: number) => number;
type Scene = (t: number, cols: number, rows: number) => Field;

function textField(bits: number[][], width: number, ox: number, oy: number, s: number): Field {
  return (x, y) => {
    const bx = Math.floor((x - ox) / s);
    const by = Math.floor((y - oy) / s);
    return bx >= 0 && bx < width && by >= 0 && by < 7 ? bits[by][bx] : 0;
  };
}

function makeScenes(text: string): Record<SceneKey, { label: string; scene: Scene }> {
  const msg = rasterise(text);
  return {
    marquee: {
      label: "Marquee",
      scene: (t, cols, rows) => {
        const s = rows >= 16 ? 2 : 1;
        const total = msg.width * s + cols;
        const ox = cols - ((t * 14) % total);
        return textField(msg.bits, msg.width, Math.round(ox), Math.floor((rows - 7 * s) / 2), s);
      },
    },
    clock: {
      label: "Clock",
      scene: (t, cols, rows) => {
        const d = new Date();
        const blink = Math.floor(t * 2) % 2 === 0;
        const str = `${String(d.getHours()).padStart(2, "0")}${blink ? ":" : " "}${String(d.getMinutes()).padStart(2, "0")}`;
        const r = rasterise(str);
        const s = rows >= 16 ? 2 : 1;
        // Colon and space share a width so the digits never jump.
        const w = rasterise(str.replace(" ", ":")).width;
        return textField(r.bits, r.width, Math.floor((cols - w * s) / 2), Math.floor((rows - 7 * s) / 2), s);
      },
    },
    equalizer: {
      label: "Equaliser",
      scene: (t, cols, rows) => {
        const bars = Math.floor(cols / 3);
        const heights = Array.from({ length: bars }, (_, i) => {
          const v = 0.55 + 0.45 * Math.sin(t * 3.1 + i * 0.7) * Math.sin(t * 1.3 + i * 0.23) + 0.2 * Math.sin(t * 7 + i * 1.9);
          return Math.max(1, Math.round(Math.min(1, Math.max(0, v)) * rows));
        });
        return (x, y) => {
          const b = Math.floor(x / 3);
          if (x % 3 === 2 || b >= bars) return 0;
          const h = heights[b];
          const fromBottom = rows - 1 - y;
          if (fromBottom < h - 1) return 0.55 + 0.45 * (fromBottom / rows);
          return fromBottom === h - 1 ? 1 : 0;
        };
      },
    },
    pulse: {
      label: "Pulse",
      scene: (t, cols, rows) => {
        const head = (t * 26) % (cols + 12);
        const mid = Math.floor(rows / 2);
        const ecg = (x: number) => {
          const p = ((x % 28) + 28) % 28;
          if (p === 10) return -2;
          if (p === 11) return -Math.floor(rows * 0.42);
          if (p === 12) return Math.floor(rows * 0.3);
          if (p === 13) return -1;
          if (p >= 18 && p <= 20) return -1;
          return 0;
        };
        return (x, y) => {
          const age = head - x;
          if (age < 0 || age > cols * 0.7) return 0;
          const fade = 1 - age / (cols * 0.7);
          const yy = mid + ecg(x);
          const prev = mid + ecg(x - 1);
          const lo = Math.min(yy, prev);
          const hi = Math.max(yy, prev);
          return y >= lo && y <= hi ? fade : 0;
        };
      },
    },
    orbit: {
      label: "Orbit",
      scene: (t, cols, rows) => {
        const cx = cols / 2 - 0.5;
        const cy = rows / 2 - 0.5;
        const r = rows * 0.38;
        const a = t * 4.2;
        return (x, y) => {
          const dx = (x - cx) / 1.0;
          const dy = y - cy;
          const d = Math.hypot(dx, dy);
          if (Math.abs(d - r) > 0.75) return d < 1.2 ? 0.35 + 0.35 * Math.sin(t * 6) : 0;
          let ang = a - Math.atan2(dy, dx);
          ang = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          return ang < 2.4 ? 1 - ang / 2.4 : 0.06;
        };
      },
    },
  };
}

export function PixelMatrixDisplay({
  text = "DESIGN FOR AI   ",
  scenes = ["marquee", "clock", "equalizer", "pulse", "orbit"],
  color = "#f5f5f0",
  cols = 72,
  rows = 16,
  interval = 4800,
  chrome = true,
  className = "",
}: PixelMatrixDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const stateRef = useRef({ index: 0, from: 0, changedAt: 0 });
  const sceneKey = scenes.join(",");

  useEffect(() => {
    const st = stateRef.current;
    st.from = st.index;
    st.index = index;
    st.changedAt = performance.now();
  }, [index]);

  useEffect(() => {
    if (paused || scenes.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % scenes.length), interval);
    return () => clearInterval(id);
  }, [paused, interval, scenes.length]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const defs = makeScenes(text);
    const list = sceneKey.split(",") as SceneKey[];
    // A stable random threshold per dot drives the dissolve between scenes.
    const noise = new Float32Array(cols * rows).map((_, i) => (Math.sin(i * 91.17) * 43758.5453) % 1).map(Math.abs);
    let pitch = 10;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      pitch = wrap.clientWidth / cols;
      canvas.width = Math.round(cols * pitch * dpr);
      canvas.height = Math.round(rows * pitch * dpr);
      canvas.style.width = `${cols * pitch}px`;
      canvas.style.height = `${rows * pitch}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const levels = 5;
    const start = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      const t = (now - start) / 1000;
      const st = stateRef.current;
      const mix = Math.min(1, (now - st.changedAt) / 700);
      const cur = defs[list[st.index] ?? "marquee"].scene(reduce ? 2 : t, cols, rows);
      const prev = mix < 1 ? defs[list[st.from] ?? "marquee"].scene(reduce ? 2 : t, cols, rows) : null;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cols * pitch, rows * pitch);
      const r = pitch * 0.34;
      const off = new Path2D();
      const lit: Path2D[] = Array.from({ length: levels }, () => new Path2D());
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const n = noise[y * cols + x];
          const v = prev && n > mix ? prev(x, y) : cur(x, y);
          const cx = (x + 0.5) * pitch;
          const cy = (y + 0.5) * pitch;
          if (v <= 0.02) {
            off.moveTo(cx + r, cy);
            off.arc(cx, cy, r, 0, Math.PI * 2);
          } else {
            const lv = Math.min(levels - 1, Math.floor(v * levels));
            lit[lv].moveTo(cx + r, cy);
            lit[lv].arc(cx, cy, r, 0, Math.PI * 2);
          }
        }
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.055)";
      ctx.fill(off);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      for (let l = 0; l < levels; l++) {
        ctx.globalAlpha = 0.25 + (0.75 * (l + 1)) / levels;
        ctx.shadowBlur = pitch * (0.4 + l * 0.18);
        ctx.fill(lit[l]);
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [text, sceneKey, color, cols, rows]);

  const defsForLabels = makeScenes("");
  const current = scenes[index] ?? scenes[0];

  return (
    <div className={`w-full ${className}`}>
      <div
        className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#070707] p-[clamp(12px,2.4vw,22px)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_40px_rgba(0,0,0,0.9),0_30px_80px_-30px_rgba(0,0,0,0.9)]"
      >
        <div ref={wrapRef} className="w-full">
          <canvas ref={canvasRef} role="img" aria-label={`Dot-matrix display showing ${defsForLabels[current].label.toLowerCase()}${current === "marquee" ? `: ${text.trim()}` : ""}`} className="block" />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_38%)]" />
      </div>
      {chrome && (
        <div className="mt-3 flex items-center justify-between gap-4 px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
          <span className="tabular-nums">
            {String(index + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")} · {defsForLabels[current].label}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous scene"
              onClick={() => setIndex((i) => (i - 1 + scenes.length) % scenes.length)}
              className="flex size-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/[0.06] hover:text-white"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={paused ? "Resume" : "Pause"}
              onClick={() => setPaused((p) => !p)}
              className="flex size-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/[0.06] hover:text-white"
            >
              {paused ? (
                <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                  <path d="M5 3.5v9l7-4.5z" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                  <rect x="4" y="3.5" width="2.6" height="9" rx="0.8" fill="currentColor" />
                  <rect x="9.4" y="3.5" width="2.6" height="9" rx="0.8" fill="currentColor" />
                </svg>
              )}
            </button>
            <button
              type="button"
              aria-label="Next scene"
              onClick={() => setIndex((i) => (i + 1) % scenes.length)}
              className="flex size-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/[0.06] hover:text-white"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Demo: the display on a black stage. */
export default function PixelMatrixDisplayDemo() {
  return (
    <div className="flex min-h-[440px] w-full items-center justify-center bg-black px-4 py-12 sm:px-10">
      <div className="w-full max-w-3xl">
        <PixelMatrixDisplay />
      </div>
    </div>
  );
}
