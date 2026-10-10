"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type SceneKey = "marquee" | "clock" | "equalizer" | "pulse" | "orbit";

export type PixelMatrixDisplayProps = {
  /** Text for the marquee scene. A–Z, 0–9 and : . - / % + are supported. */
  text?: string;
  /** Scenes to cycle through, in order. */
  scenes?: SceneKey[];
  /** Lit-dot colour: the display’s one accent. Also tints the bloom. */
  color?: string;
  /** Matrix size. 16 rows renders type at 2× scale. */
  cols?: number;
  rows?: number;
  /** Milliseconds per scene. */
  interval?: number;
  /** Show the caption bar and controls. */
  chrome?: boolean;
  /** Offer a microphone toggle that drives the equaliser from live audio. */
  microphone?: boolean;
  /** Show this scene (it must be one of `scenes`): jumps there when the value changes and pauses auto-advance, so the pause control reads Resume. Resume continues cycling; prev and next still step. */
  scene?: SceneKey;
  /** Called whenever the shown scene changes (auto-advance, prev/next, the mic or `scene`). */
  onSceneChange?: (scene: SceneKey) => void;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  panel: "#070707",
  line: "rgba(255,255,255,0.08)",
  off: "rgba(255,255,255,0.055)", // unlit dots
  caption: "rgba(255,255,255,0.45)",
  control: "rgba(255,255,255,0.6)",
  controlHover: "rgba(255,255,255,0.06)",
  track: "rgba(255,255,255,0.1)",
  blocked: "#f87171",
} as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  rise: 12, // px
  blur: 8, // px
  panel: 0.5,
  sweepAt: 0.22, // the dots power on once the panel has nearly landed…
  sweep: 0.75, // …in a bright column that crosses left to right
  sweepBand: 0.05, // width of the bright front, as a share of the panel
  sweepJitter: 0.035, // per-dot noise so the front is ragged, like real LEDs warming up
  captionAt: 0.5,
  captionStep: 0.06,
  dissolveMs: 700, // scene change: each dot switches as progress passes its own threshold
  pointerEase: 0.12, // per frame
  fade: 0.15, // reduced motion
} as const;

const DOT = { radius: 0.34, levels: 5, reach: 4.2, bloom: 0.4, bloomStep: 0.18, nearLevels: 3 } as const;
const MARQUEE_SPEED = 14; // dots per second

function cssVars(): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(PALETTE)) vars[`--pmd-${k}`] = v;
  return vars as CSSProperties;
}

/** Scene time (s) for the reduced-motion still of each scene. */
const STILL_TIME: Record<SceneKey, number> = { marquee: 0, clock: 0, equalizer: 2, pulse: 2, orbit: 2 };

const SCENE_LABELS: Record<SceneKey, string> = { marquee: "Marquee", clock: "Clock", equalizer: "Equaliser", pulse: "Pulse", orbit: "Orbit" };

/* ------------------------------------------------------------------ */
/* Font and scenes                                                      */
/* ------------------------------------------------------------------ */

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

type AudioState = { live: boolean; levels: Uint8Array; peaks: number[]; shown: number[]; lastT: number };

/** Every scene, closed over the marquee text and the shared audio meter state. */
function makeScenes(text: string, audio: AudioState): Record<SceneKey, Scene> {
  const msg = rasterise(text);
  return {
    marquee: (t, cols, rows) => {
      const s = rows >= 16 ? 2 : 1;
      const total = msg.width * s + cols;
      // Starts with the text at the left edge, so the power-on sweep writes it in; then scrolls and wraps in from the right.
      const ox = cols - ((t * MARQUEE_SPEED + cols) % total);
      return textField(msg.bits, msg.width, Math.round(ox), Math.floor((rows - 7 * s) / 2), s);
    },
    clock: (t, cols, rows) => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      // The colon is always rasterised, so the minutes never move. It
      // breathes instead of blinking: a soft 1 Hz fade, never fully off.
      const r = rasterise(`${hh}:${mm}`);
      const s = rows >= 16 ? 2 : 1;
      const ox = Math.floor((cols - r.width * s) / 2);
      const oy = Math.floor((rows - 7 * s) / 2);
      const colonFrom = ox + (FONT[hh[0]][0].length + 1 + FONT[hh[1]][0].length + 1) * s;
      const colonTo = colonFrom + FONT[":"][0].length * s;
      const colon = 0.22 + 0.78 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2));
      const field = textField(r.bits, r.width, ox, oy, s);
      return (x, y) => {
        const v = field(x, y);
        return v && x >= colonFrom && x < colonTo ? v * colon : v;
      };
    },
    equalizer: (t, cols, rows) => {
      const bars = Math.floor(cols / 3);
      const live = audio.live && audio.levels.length > 0;
      if (audio.peaks.length !== bars) {
        audio.peaks = new Array(bars).fill(0);
        audio.shown = new Array(bars).fill(0);
      }
      const dt = Math.min(0.05, Math.max(0, t - audio.lastT));
      audio.lastT = t;
      const heights = Array.from({ length: bars }, (_, i) => {
        let v: number;
        if (live) {
          // Log-spaced bands: low bars get the voice's fundamentals,
          // high bars its sibilance.
          const n = audio.levels.length;
          const a = Math.floor(Math.pow(n, i / bars));
          const b = Math.max(a + 1, Math.floor(Math.pow(n, (i + 1) / bars)));
          let sum = 0;
          for (let k = a; k < b && k < n; k++) sum += audio.levels[k];
          v = Math.min(1, Math.pow((sum / (b - a)) / 255, 1.4) * 1.6);
        } else {
          v = 0.55 + 0.45 * Math.sin(t * 3.1 + i * 0.7) * Math.sin(t * 1.3 + i * 0.23) + 0.2 * Math.sin(t * 7 + i * 1.9);
        }
        v = Math.min(1, Math.max(0, v));
        // Fast attack, slower release, like a real meter.
        const prev = audio.shown[i];
        const shown = v > prev ? prev + (v - prev) * 0.6 : prev + (v - prev) * Math.min(1, dt * 7);
        audio.shown[i] = shown;
        // Peak dots hold, then fall.
        audio.peaks[i] = shown >= audio.peaks[i] ? shown : Math.max(shown, audio.peaks[i] - dt * 0.45);
        return Math.max(1, Math.round(shown * rows));
      });
      return (x, y) => {
        const b = Math.floor(x / 3);
        if (x % 3 === 2 || b >= bars) return 0;
        const h = heights[b];
        const fromBottom = rows - 1 - y;
        const peak = Math.min(rows - 1, Math.round(audio.peaks[b] * rows));
        if (fromBottom < h - 1) return 0.55 + 0.45 * (fromBottom / rows);
        if (fromBottom === h - 1) return 1;
        return fromBottom === peak && peak > h ? 0.7 : 0;
      };
    },
    pulse: (t, cols, rows) => {
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
    orbit: (t, cols, rows) => {
      const cx = cols / 2 - 0.5;
      const cy = rows / 2 - 0.5;
      const r = rows * 0.38;
      const a = t * 4.2;
      return (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (Math.abs(d - r) > 0.75) return d < 1.2 ? 0.35 + 0.35 * Math.sin(t * 6) : 0;
        let ang = a - Math.atan2(dy, dx);
        ang = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        return ang < 2.4 ? 1 - ang / 2.4 : 0.06;
      };
    },
  };
}


/* ------------------------------------------------------------------ */
/* Runtime state shared with the draw loop (refs, never React state)    */
/* ------------------------------------------------------------------ */

type Live = {
  index: number;
  from: number;
  changedAt: number;
  /** performance.now() when the power-on sweep began; null until the display has arrived. */
  sweepStart: number | null;
  pointer: { x: number; y: number; on: boolean; k: number };
};

type Mic = { stream: MediaStream; ctx: AudioContext; analyser: AnalyserNode };

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/**
 * Advances scenes on a progress motion value: the same value fills the caption’s progress
 * line, so pausing stops both together and resuming continues from where it was.
 */
function useSceneCycle(count: number, interval: number, running: boolean) {
  const [index, setIndex] = useState(0);
  const progress = useMotionValue(0);

  useEffect(() => {
    progress.set(0);
  }, [index, progress]);

  useEffect(() => {
    if (!running || count < 2) return;
    const run = animate(progress, 1, {
      duration: ((1 - progress.get()) * interval) / 1000,
      ease: "linear",
      onComplete: () => setIndex((i) => (i + 1) % count),
    });
    return () => run.stop();
  }, [running, index, interval, count, progress]);

  return { index, setIndex, progress };
}

/** Opt-in microphone → AnalyserNode. Stops every track on toggle-off and on unmount. */
function useMicrophone(audio: RefObject<AudioState>) {
  const [state, setState] = useState<"off" | "asking" | "on" | "blocked">("off");
  const mic = useRef<Mic | null>(null);

  const stop = useCallback(() => {
    const m = mic.current;
    mic.current = null;
    audio.current.live = false;
    m?.stream.getTracks().forEach((tr) => tr.stop());
    m?.ctx.close().catch(() => {});
    setState((s) => (s === "on" ? "off" : s));
  }, [audio]);

  useEffect(() => stop, [stop]);

  const toggle = async () => {
    if (state === "on") return stop();
    setState("asking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.55;
      ctx.createMediaStreamSource(stream).connect(analyser);
      mic.current = { stream, ctx, analyser };
      audio.current.levels = new Uint8Array(analyser.frequencyBinCount);
      audio.current.peaks = [];
      audio.current.live = true;
      setState("on");
    } catch {
      setState("blocked");
    }
  };

  return { state, toggle, stop, mic };
}

/**
 * The canvas: sizes itself to its wrapper, then draws every frame while on screen. Lit dots
 * are batched into one Path2D per brightness level (bloom via shadowBlur per level, never per dot).
 */
function useMatrixCanvas({
  canvas: canvasRef,
  wrap: wrapRef,
  live: liveRef,
  audio: audioRef,
  mic: micRef,
  text,
  sceneKey,
  color,
  cols,
  rows,
  reduce,
}: {
  canvas: RefObject<HTMLCanvasElement | null>;
  wrap: RefObject<HTMLDivElement | null>;
  live: RefObject<Live>;
  audio: RefObject<AudioState>;
  mic: RefObject<Mic | null>;
  text: string;
  sceneKey: string;
  color: string;
  cols: number;
  rows: number;
  reduce: boolean;
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !wrap || !ctx) return;
    const defs = makeScenes(text, audioRef.current);
    const list = sceneKey.split(",") as SceneKey[];
    // A stable random threshold per dot drives the dissolve between scenes and the ragged sweep front.
    const noise = new Float32Array(cols * rows).map((_, i) => Math.abs((Math.sin(i * 91.17 + 1.7) * 43758.5453) % 1));
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

    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      const live = liveRef.current;
      // Scene time starts once the sweep has passed, so the marquee holds still while it is written in.
      const t = live.sweepStart === null ? 0 : Math.max(0, now - live.sweepStart - MOTION.sweep * 1000) / 1000;
      // Reduced motion freezes each scene on a representative still.
      const at = (k: SceneKey) => (reduce ? STILL_TIME[k] : t);
      const m = micRef.current;
      if (m) m.analyser.getByteFrequencyData(audioRef.current.levels as Uint8Array<ArrayBuffer>);

      const power = live.sweepStart === null ? 0 : reduce ? Infinity : ((now - live.sweepStart) / (MOTION.sweep * 1000)) * (1 + MOTION.sweepBand + MOTION.sweepJitter);
      const mix = Math.min(1, (now - live.changedAt) / MOTION.dissolveMs);
      const curKey = list[live.index] ?? "marquee";
      const prevKey = list[live.from] ?? "marquee";
      const cur = defs[curKey](at(curKey), cols, rows);
      const prev = mix < 1 ? defs[prevKey](at(prevKey), cols, rows) : null;

      const pt = live.pointer;
      pt.k += ((pt.on && !reduce ? 1 : 0) - pt.k) * MOTION.pointerEase;

      const r = pitch * DOT.radius;
      const off = new Path2D();
      const near = Array.from({ length: DOT.nearLevels }, () => new Path2D());
      const lit = Array.from({ length: DOT.levels }, () => new Path2D());
      const dotAt = (p: Path2D, cx: number, cy: number) => {
        p.moveTo(cx + r, cy);
        p.arc(cx, cy, r, 0, Math.PI * 2);
      };

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const n = noise[y * cols + x];
          const cx = (x + 0.5) * pitch;
          const cy = (y + 0.5) * pitch;
          // Power-on: dark until the front reaches this dot, full bright while it passes.
          const front = (x / cols) * (1 - MOTION.sweepJitter) + n * MOTION.sweepJitter;
          if (power < front) continue;
          if (power < front + MOTION.sweepBand) {
            dotAt(lit[DOT.levels - 1], cx, cy);
            continue;
          }
          let v = prev && n > mix ? prev(x, y) : cur(x, y);
          // Pointer glow: unlit dots near the cursor warm up, lit ones step up a level.
          const d = pt.k > 0.01 ? Math.hypot(x + 0.5 - pt.x, y + 0.5 - pt.y) : 99;
          const heat = d < DOT.reach ? (1 - d / DOT.reach) * pt.k : 0;
          if (v <= 0.02) {
            if (heat > 0.08) dotAt(near[Math.min(DOT.nearLevels - 1, Math.floor(heat * DOT.nearLevels))], cx, cy);
            else dotAt(off, cx, cy);
          } else {
            v = Math.min(1, v + heat * 0.35);
            dotAt(lit[Math.min(DOT.levels - 1, Math.floor(v * DOT.levels))], cx, cy);
          }
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cols * pitch, rows * pitch);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = PALETTE.off;
      ctx.fill(off);
      ctx.fillStyle = color;
      near.forEach((p, l) => {
        ctx.globalAlpha = 0.18 + l * 0.15;
        ctx.fill(p);
      });
      ctx.shadowColor = color;
      lit.forEach((p, l) => {
        ctx.globalAlpha = 0.25 + (0.75 * (l + 1)) / DOT.levels;
        ctx.shadowBlur = pitch * (DOT.bloom + l * DOT.bloomStep);
        ctx.fill(p);
      });
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [canvasRef, wrapRef, liveRef, audioRef, micRef, text, sceneKey, color, cols, rows, reduce]);
}

function enter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: MOTION.panel, ease: EASE_OUT, delay },
  };
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function PixelMatrixDisplay({
  text = "DESIGN FOR AI   ",
  scenes = ["marquee", "clock", "equalizer", "pulse", "orbit"],
  color = "#f5f5f0",
  cols = 72,
  rows = 16,
  interval = 4800,
  chrome = true,
  microphone = true,
  scene,
  onSceneChange,
  className = "",
}: PixelMatrixDisplayProps) {
  const reduce = useReducedMotion() ?? false;
  const root = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const play = useInView(root, { once: true, amount: 0.3 });
  const liveRef = useRef<Live>({ index: 0, from: 0, changedAt: 0, sweepStart: null, pointer: { x: -99, y: -99, on: false, k: 0 } });
  const audioRef = useRef<AudioState>({ live: false, levels: new Uint8Array(0), peaks: [], shown: [], lastT: 0 });
  const sceneKey = scenes.join(",");

  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false); // hovering holds the current scene so it can be watched
  const [poweredOn, setPoweredOn] = useState(false);
  const mic = useMicrophone(audioRef);
  // Reduced motion: no autoplay; the controls still step through scenes.
  const running = poweredOn && !reduce && !paused && !hovering && mic.state !== "on";
  const cycle = useSceneCycle(scenes.length, interval, running);

  // Listening holds the equaliser on screen.
  const { setIndex } = cycle;
  useEffect(() => {
    if (mic.state !== "on") return;
    const eq = sceneKey.split(",").indexOf("equalizer");
    if (eq >= 0) setIndex(eq);
  }, [mic.state, sceneKey, setIndex]);

  // A host can jump to a scene by changing `scene`: it jumps there and pauses, so the pause
  // control reads Resume and resuming carries on cycling. A value that names the scene already
  // on screen (a host echoing onSceneChange back) changes nothing, except on mount, where it holds.
  const stopMic = mic.stop;
  const shownRef = useRef(cycle.index);
  shownRef.current = cycle.index;
  const sceneMounted = useRef(false);
  useEffect(() => {
    const first = !sceneMounted.current;
    sceneMounted.current = true;
    if (!scene) return;
    const to = sceneKey.split(",").indexOf(scene);
    if (to < 0 || (!first && to === shownRef.current)) return;
    stopMic();
    setIndex(to);
    setPaused(true);
  }, [scene, sceneKey, setIndex, stopMic]);

  // Report every change of the shown scene.
  const reportRef = useRef(onSceneChange);
  reportRef.current = onSceneChange;
  const reported = useRef(cycle.index);
  useEffect(() => {
    if (reported.current === cycle.index) return;
    reported.current = cycle.index;
    const shown = sceneKey.split(",")[cycle.index] as SceneKey | undefined;
    if (shown) reportRef.current?.(shown);
  }, [cycle.index, sceneKey]);

  useMatrixCanvas({ canvas: canvasRef, wrap: wrapRef, live: liveRef, audio: audioRef, mic: mic.mic, text, sceneKey, color, cols, rows, reduce });

  // Arrival: the panel lands, then the dots power on in a sweep, then scenes begin to cycle.
  useEffect(() => {
    if (!play) return;
    const delay = reduce ? 0 : MOTION.sweepAt;
    const begin = setTimeout(() => (liveRef.current.sweepStart = performance.now()), delay * 1000);
    const done = setTimeout(() => setPoweredOn(true), (reduce ? 0 : delay + MOTION.sweep) * 1000);
    return () => {
      clearTimeout(begin);
      clearTimeout(done);
    };
  }, [play, reduce]);

  useEffect(() => {
    const live = liveRef.current;
    live.from = live.index;
    live.index = cycle.index;
    live.changedAt = performance.now();
  }, [cycle.index]);

  const step = (by: number) => {
    mic.stop();
    cycle.setIndex((i) => (i + by + scenes.length) % scenes.length);
  };

  const current = scenes[cycle.index] ?? scenes[0];
  const label = SCENE_LABELS[current];

  return (
    <div ref={root} className={`@container w-full font-sans ${className}`} style={cssVars()}>
      <motion.div
        {...enter(play, 0, reduce)}
        className="relative overflow-hidden rounded-[20px] border p-[clamp(12px,2.6cqi,22px)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_40px_rgba(0,0,0,0.9),0_30px_80px_-30px_rgba(0,0,0,0.9)]"
        style={{ background: PALETTE.panel, borderColor: PALETTE.line }}
      >
        <div
          ref={wrapRef}
          data-demo="display"
          className="w-full"
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse") return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pt = liveRef.current.pointer;
            pt.x = ((e.clientX - rect.left) / rect.width) * cols;
            pt.y = ((e.clientY - rect.top) / rect.height) * rows;
            pt.on = true;
          }}
          onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
          onPointerLeave={() => {
            liveRef.current.pointer.on = false;
            setHovering(false);
          }}
        >
          <canvas ref={canvasRef} role="img" aria-label={`Dot-matrix display showing ${label.toLowerCase()}${current === "marquee" ? `: ${text.trim()}` : ""}`} className="block" />
        </div>
        {/* A faint glass sheen over the dots. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_38%)]" />
      </motion.div>

      {chrome && (
        <Caption
          play={play}
          reduce={reduce}
          index={cycle.index}
          count={scenes.length}
          label={label}
          live={mic.state === "on" && current === "equalizer"}
          progress={cycle.progress}
          color={color}
          showProgress={!reduce && scenes.length > 1}
        >
          {microphone && scenes.includes("equalizer") && <MicButton state={mic.state} color={color} onToggle={() => void mic.toggle()} />}
          <IconButton demo="prev" label="Previous scene" onClick={() => step(-1)}>
            <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </IconButton>
          <IconButton demo="pause" label={paused ? "Resume" : "Pause"} pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? (
              <path d="M5 3.5v9l7-4.5z" fill="currentColor" />
            ) : (
              <>
                <rect x="4" y="3.5" width="2.6" height="9" rx="0.8" fill="currentColor" />
                <rect x="9.4" y="3.5" width="2.6" height="9" rx="0.8" fill="currentColor" />
              </>
            )}
          </IconButton>
          <IconButton demo="next" label="Next scene" onClick={() => step(1)}>
            <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </IconButton>
        </Caption>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Caption and controls                                                 */
/* ------------------------------------------------------------------ */

function Caption({
  play,
  reduce,
  index,
  count,
  label,
  live,
  progress,
  color,
  showProgress,
  children,
}: {
  play: boolean;
  reduce: boolean;
  index: number;
  count: number;
  label: string;
  live: boolean;
  progress: MotionValue<number>;
  color: string;
  showProgress: boolean;
  children: ReactNode;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="mt-3 flex items-center justify-between gap-2 px-1 @md:gap-4 font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: PALETTE.caption }}>
      <motion.span {...enter(play, MOTION.captionAt, reduce)} className="flex min-w-0 items-center gap-3 tabular-nums">
        {showProgress && (
          <span className="relative block h-px w-10 shrink-0 overflow-hidden" style={{ background: PALETTE.track }} aria-hidden="true">
            {/* Fills over the scene’s duration; holds while the scene is held. */}
            <motion.span className="absolute inset-0 origin-left" style={{ scaleX: progress, background: `color-mix(in srgb, ${color} 70%, transparent)` }} />
          </span>
        )}
        <span className="relative min-w-0 truncate" aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={index}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)", transition: { duration: 0.16, ease: EASE_IN } }}
              transition={{ duration: 0.32, ease: EASE_OUT }}
              className="block truncate"
            >
              {pad(index + 1)} / {pad(count)} · {label}
              {live ? " · live" : ""}
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.span>
      <motion.div {...enter(play, MOTION.captionAt + MOTION.captionStep, reduce)} className="flex items-center gap-1">
        {children}
      </motion.div>
    </div>
  );
}

const controlCls =
  "flex items-center justify-center rounded-full transition-[color,background-color,transform] duration-150 hover:bg-[var(--pmd-controlHover)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/70 active:scale-90";

function IconButton({ label, pressed, demo, onClick, children }: { label: string; pressed?: boolean; demo?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" data-demo={demo} aria-label={label} aria-pressed={pressed} onClick={onClick} className={`size-8 text-[var(--pmd-control)] ${controlCls}`}>
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

function MicButton({ state, color, onToggle }: { state: "off" | "asking" | "on" | "blocked"; color: string; onToggle: () => void }) {
  const on = state === "on";
  return (
    <button
      type="button"
      data-demo="mic"
      aria-pressed={on}
      aria-label={on ? "Stop listening" : "Drive the equaliser with your microphone"}
      title={state === "blocked" ? "Microphone blocked. Allow it in your browser to try again." : undefined}
      onClick={onToggle}
      disabled={state === "asking"}
      className={`mr-1 h-8 min-w-8 gap-2 whitespace-nowrap px-2.5 font-mono @md:px-3 text-[10px] uppercase tracking-[0.16em] disabled:opacity-60 ${controlCls} ${
        on ? "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]" : state === "blocked" ? "text-[var(--pmd-blocked)]" : "text-[var(--pmd-control)]"
      }`}
    >
      <span className="relative flex size-2" aria-hidden="true">
        {/* The one ambient signal while listening: a live dot in the display colour. */}
        {on && <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: color }} />}
        <span className="relative inline-flex size-2 rounded-full" style={{ background: on ? color : "currentColor", opacity: on ? 1 : 0.6 }} />
      </span>
      {/* Narrow containers keep just the dot; the aria-label carries the meaning. */}
      <span className="hidden @md:inline">{on ? "Listening" : state === "asking" ? "Allow mic…" : state === "blocked" ? "Mic blocked" : "Use mic"}</span>
    </button>
  );
}

/** The props a re-sent Customize message carries, minus the action itself. */
function sameSettings(a: Partial<PixelMatrixDisplayProps>, b: Partial<PixelMatrixDisplayProps>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete("scene");
  for (const k of keys) {
    const x = a[k as keyof PixelMatrixDisplayProps];
    const y = b[k as keyof PixelMatrixDisplayProps];
    if (x !== y && JSON.stringify(x) !== JSON.stringify(y)) return false;
  }
  return true;
}

/**
 * Demo: the display on a black stage. Overrides are spread on the featured instance. The shown
 * scene lives here (synced through onSceneChange), so a Scene action jumps there even after the
 * visitor has stepped away with prev/next, and editing the marquee text brings the marquee up.
 */
export default function PixelMatrixDisplayDemo(props: Partial<PixelMatrixDisplayProps> = {}) {
  const { scene: forced, onSceneChange, ...overrides } = props;
  const [shown, setShown] = useState<SceneKey | undefined>(forced);
  const last = useRef<Partial<PixelMatrixDisplayProps> | null>(null);

  useEffect(() => {
    const prev = last.current;
    last.current = props;
    if (!prev || prev === props) return;
    // Clicking the same Scene button again re-sends identical props: honour it as a fresh jump.
    if (forced && (forced !== prev.scene || sameSettings(prev, props))) setShown(forced);
    else if (props.text !== prev.text) setShown("marquee");
  }, [props, forced]);

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-black px-4 py-12 sm:px-10">
      <div className="w-full max-w-3xl">
        <PixelMatrixDisplay
          {...overrides}
          scene={shown}
          onSceneChange={(s) => {
            setShown(s);
            onSceneChange?.(s);
          }}
        />
      </div>
    </div>
  );
}
