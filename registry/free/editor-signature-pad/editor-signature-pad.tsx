"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Download, Eraser, RotateCcw, Undo2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** A point of a stroke, normalized to the plate (0–1) with a timestamp in ms. */
export type InkPoint = { x: number; y: number; t: number };

export type InkStroke = { points: InkPoint[] };

export type Signatory = {
  id: string;
  name: string;
  role: string;
  org: string;
  /** Shown as written, for example "11 Oct 2026". */
  date: string;
  strokes: InkStroke[];
};

export type EditorSignaturePadProps = {
  /** Document name in the header. */
  title?: string;
  /** Mono eyebrow above the title. */
  kicker?: string;
  /** The clause above the plates. */
  clause?: string;
  /** Everyone on the agreement. The open plate is the one that still accepts ink. */
  parties?: Signatory[];
  /** Which plate accepts ink, undo, replay and export. Defaults to the last party. */
  openId?: string;
  /** Fine is a note in the margin. Mark is a signature. */
  weight?: "fine" | "mark";
  /** The rule the ink sits on. */
  showBaseline?: boolean;
  /** Pen colour. Near-black by default, so the mark reads as ink on paper. */
  accent?: string;
  theme?: "dark" | "light";
  /** Called with the open party's strokes after a draw, undo or clear. */
  onChange?: (partyId: string, strokes: InkStroke[]) => void;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const EASE = [0.22, 1, 0.36, 1] as const;

const PALETTE = {
  dark: {
    shell: "#0c0c0e",
    ink: "#f4f4f5",
    muted: "#a1a1aa",
    faint: "#9a9aa3",
    line: "rgba(255,255,255,0.08)",
    raise: "#16161a",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px -36px rgba(0,0,0,0.9)",
    paper: "#f4f0e6",
    paperInk: "#6b6459",
    paperLine: "rgba(28,25,23,0.16)",
    paperShadow: "inset 0 0 0 1px rgba(28,25,23,0.08), inset 0 1px 0 rgba(255,255,255,0.65), 0 18px 36px -28px rgba(0,0,0,0.8)",
  },
  light: {
    shell: "#ffffff",
    ink: "#18181b",
    muted: "#52525b",
    faint: "#71717a",
    line: "rgba(24,24,27,0.10)",
    raise: "#f4f4f5",
    shadow: "inset 0 0 0 1px rgba(24,24,27,0.08), 0 1px 2px rgba(24,24,27,0.04), 0 40px 80px -40px rgba(24,24,27,0.28)",
    paper: "#fffdf8",
    paperInk: "#6b6459",
    paperLine: "rgba(28,25,23,0.14)",
    paperShadow: "inset 0 0 0 1px rgba(28,25,23,0.10), 0 16px 32px -26px rgba(24,24,27,0.4)",
  },
} as const;

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--esp-ink)";
const PRESS = "active:scale-[0.97] active:duration-100 motion-reduce:active:scale-100";

const VW = 640;
const VH = 220;
const REPLAY_MS = 2300;

const GAUGE = {
  fine: { min: 0.7, max: 3.4, speed: 2.2 },
  mark: { min: 0.85, max: 7.4, speed: 2.2 },
} as const;

/* ------------------------------------------------------------------ */
/* Ink                                                                 */
/* ------------------------------------------------------------------ */

type PenSeg = { x1: number; y1: number; x2: number; y2: number; w: number };

function trace(verts: [number, number, number][]): InkPoint[] {
  let t = 0;
  return verts.map(([x, y, dt]) => {
    t += dt;
    return { x, y: Math.min(0.96, y + 0.06), t };
  });
}

function curve(points: InkPoint[]): InkPoint[] {
  if (points.length < 3) return points;
  const out: InkPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const steps = 10;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        t: p1.t + (p2.t - p1.t) * t,
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Short round-capped segments. Loops stay loops; a fast pen goes thin. */
function penPath(points: InkPoint[], gauge: (typeof GAUGE)[keyof typeof GAUGE]): PenSeg[] {
  if (points.length === 0) return [];
  points = curve(points);
  if (points.length === 1) {
    const p = points[0];
    const w = gauge.max * 0.55;
    return [{ x1: p.x * VW, y1: p.y * VH, x2: p.x * VW, y2: p.y * VH, w }];
  }
  const dense: InkPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dist = Math.hypot((b.x - a.x) * VW, (b.y - a.y) * VH);
    const n = Math.max(1, Math.ceil(dist / 2.4));
    for (let k = 0; k < n; k++) {
      const u = k / n;
      dense.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, t: a.t + (b.t - a.t) * u });
    }
  }
  dense.push(points[points.length - 1]);
  const widths = dense.map((p, i) => {
    const a = dense[Math.max(0, i - 1)];
    const b = dense[Math.min(dense.length - 1, i + 1)];
    const dist = Math.hypot((b.x - a.x) * VW, (b.y - a.y) * VH);
    const dt = Math.max(1, b.t - a.t);
    const u = Math.min(1, dist / dt / gauge.speed);
    const eased = u * u * (3 - 2 * u);
    let w = gauge.max - (gauge.max - gauge.min) * eased;
    const along = i / (dense.length - 1);
    const taper = Math.min(1, along / 0.06, (1 - along) / 0.08);
    return w * (0.18 + 0.82 * taper);
  });
  for (let pass = 0; pass < 2; pass++) {
    const next = widths.slice();
    for (let i = 1; i < widths.length - 1; i++) next[i] = widths[i - 1] * 0.2 + widths[i] * 0.6 + widths[i + 1] * 0.2;
    for (let i = 0; i < widths.length; i++) widths[i] = next[i];
  }
  const segs: PenSeg[] = [];
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i];
    segs.push({ x1: a.x * VW, y1: a.y * VH, x2: b.x * VW, y2: b.y * VH, w: (widths[i - 1] + widths[i]) / 2 });
  }
  return segs;
}

function span(stroke: InkStroke) {
  const pts = stroke.points;
  if (pts.length < 2) return 80;
  return Math.max(80, pts[pts.length - 1].t - pts[0].t);
}

/** Reveal strokes in order. A short gap sits between them so the underline waits. */
function reveal(strokes: InkStroke[], progress: number): InkStroke[] {
  const gap = 110;
  const total = strokes.reduce((sum, stroke) => sum + span(stroke) + gap, 0) || 1;
  let budget = progress * total;
  const out: InkStroke[] = [];
  for (const stroke of strokes) {
    const dur = span(stroke);
    if (budget <= 0) break;
    if (budget >= dur) {
      out.push(stroke);
      budget -= dur + gap;
      continue;
    }
    const t0 = stroke.points[0]?.t ?? 0;
    const pts = stroke.points.filter((p) => p.t - t0 <= budget);
    if (pts.length) out.push({ points: pts });
    break;
  }
  return out;
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "signature";
}

/* ------------------------------------------------------------------ */
/* The two marks                                                       */
/* ------------------------------------------------------------------ */

const MIRA: InkStroke[] = [
  {
    points: trace([
      [0.12, 0.7, 0],
      [0.16, 0.34, 80],
      [0.2, 0.22, 50],
      [0.26, 0.46, 40],
      [0.3, 0.24, 46],
      [0.34, 0.68, 55],
      [0.4, 0.5, 28],
      [0.42, 0.7, 32],
      [0.48, 0.46, 22],
      [0.52, 0.36, 24],
      [0.56, 0.58, 26],
      [0.6, 0.48, 20],
      [0.66, 0.42, 22],
      [0.68, 0.62, 24],
      [0.62, 0.7, 22],
      [0.58, 0.56, 18],
      [0.74, 0.58, 16],
      [0.86, 0.5, 12],
      [0.95, 0.54, 10],
    ]),
  },
  { points: trace([[0.4, 0.28, 0], [0.415, 0.3, 36]]) },
];

const JORDAN: InkStroke[] = [
  {
    points: trace([
      [0.1, 0.2, 0],
      [0.095, 0.4, 70],
      [0.09, 0.58, 60],
      [0.12, 0.72, 50],
      [0.18, 0.76, 40],
      [0.22, 0.6, 36],
      [0.26, 0.48, 32],
      [0.32, 0.42, 28],
      [0.36, 0.52, 26],
      [0.34, 0.68, 28],
      [0.28, 0.7, 24],
      [0.26, 0.56, 22],
      [0.34, 0.5, 18],
      [0.38, 0.4, 22],
      [0.42, 0.58, 20],
      [0.44, 0.72, 22],
      [0.48, 0.46, 20],
      [0.49, 0.26, 40],
      [0.5, 0.14, 36],
      [0.52, 0.34, 30],
      [0.53, 0.56, 28],
      [0.5, 0.72, 26],
      [0.45, 0.64, 20],
      [0.48, 0.52, 18],
      [0.56, 0.48, 18],
      [0.6, 0.42, 20],
      [0.64, 0.56, 20],
      [0.62, 0.72, 22],
      [0.56, 0.66, 18],
      [0.66, 0.58, 16],
      [0.7, 0.4, 22],
      [0.76, 0.46, 18],
      [0.78, 0.66, 20],
      [0.86, 0.6, 12],
      [0.94, 0.52, 10],
      [0.99, 0.46, 8],
    ]),
  },
];

const DEFAULT_PARTIES: Signatory[] = [
  { id: "mira", name: "Mira Chen", role: "General counsel", org: "Harbor", date: "11 Oct 2026", strokes: MIRA },
  { id: "jordan", name: "Jordan Hale", role: "Operations", org: "Northwind", date: "11 Oct 2026", strokes: JORDAN },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function EditorSignaturePad({
  title = "Mutual NDA",
  kicker = "Harbor",
  clause = "Harbor and Northwind will keep each other's pricing, models and customer lists to themselves. The obligation lasts three years from this date. A signature is the whole of the agreement.",
  parties = DEFAULT_PARTIES,
  openId,
  weight = "mark",
  showBaseline = true,
  accent = "#1c1917",
  theme = "dark",
  onChange,
  className,
}: EditorSignaturePadProps) {
  const pal = PALETTE[theme];
  const pen = accent;
  const gauge = GAUGE[weight];
  const grainId = useId().replace(/:/g, "");
  const shellRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const open = openId ?? parties[parties.length - 1]?.id ?? "";
  const [strokes, setStrokes] = useState<InkStroke[]>(() => parties.find((p) => p.id === open)?.strokes.map((s) => ({ points: s.points.map((p) => ({ ...p })) })) ?? []);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [draft, setDraft] = useState<InkPoint[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const rafRef = useRef(0);
  const drawing = useRef(false);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const commit = useCallback(
    (next: InkStroke[]) => {
      strokesRef.current = next;
      setStrokes(next);
      onChangeRef.current?.(open, next);
    },
    [open],
  );

  const stopReplay = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setProgress(null);
  }, []);

  const replay = useCallback(() => {
    stopReplay();
    if (!strokesRef.current.length) {
      setNote("Nothing to replay");
      return;
    }
    if (reduce) {
      setNote("Signature");
      return;
    }
    setNote("Replaying the signature");
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / REPLAY_MS);
      if (p >= 1) {
        setProgress(null);
        setNote("Signed");
        return;
      }
      setProgress(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    setProgress(0);
    rafRef.current = requestAnimationFrame(tick);
  }, [reduce, stopReplay]);

  function undo() {
    stopReplay();
    if (!strokesRef.current.length) return;
    commit(strokesRef.current.slice(0, -1));
    setNote("Removed the last stroke");
  }

  function clear() {
    stopReplay();
    setDraft(null);
    commit([]);
    setNote("Cleared the signature");
  }

  function exportMark() {
    const live = strokesRef.current;
    if (!live.length) {
      setNote("Nothing to export");
      return;
    }
    const party = parties.find((p) => p.id === open);
    const name = slugify(party?.name ?? "signature");
    const lines = live.flatMap((stroke) => penPath(stroke.points, gauge));
    const markup = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" fill="none" stroke="${pen}" stroke-linecap="round">\n<title>${party?.name ?? "Signature"}</title>\n${lines.map((s) => `<line x1="${s.x1.toFixed(2)}" y1="${s.y1.toFixed(2)}" x2="${s.x2.toFixed(2)}" y2="${s.y2.toFixed(2)}" stroke-width="${s.w.toFixed(2)}"/>`).join("\n")}\n</svg>\n`;
    const blob = new Blob([markup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    setNote(`Saved ${name}.svg`);
  }

  function localPoint(e: ReactPointerEvent<SVGSVGElement>): InkPoint {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.width ? (e.clientX - rect.left) / rect.width : 0;
    const y = rect.height ? (e.clientY - rect.top) / rect.height : 0;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)), t: e.timeStamp };
  }

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    stopReplay();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    shellRef.current?.focus();
    setDraft([localPoint(e)]);
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!drawing.current) return;
    const next = localPoint(e);
    setDraft((prev) => {
      if (!prev?.length) return [next];
      const last = prev[prev.length - 1];
      const dist = Math.hypot((next.x - last.x) * VW, (next.y - last.y) * VH);
      if (dist < 0.8) return prev;
      return [...prev, next];
    });
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    const next = localPoint(e);
    setDraft((prev) => {
      const pts = prev?.length ? [...prev, next] : [next];
      const cleaned = pts.filter((p, i) => i === 0 || Math.hypot((p.x - pts[i - 1].x) * VW, (p.y - pts[i - 1].y) * VH) >= 0.6);
      if (cleaned.length) commit([...strokesRef.current, { points: cleaned }]);
      return null;
    });
    setNote("Ink added");
  }

  const shown = progress === null ? strokes : reveal(strokes, progress);
  const liveStrokes = draft?.length ? [...shown, { points: draft }] : shown;
  const signed = parties.filter((p) => (p.id === open ? strokes.length > 0 : p.strokes.length > 0)).length;

  const style = {
    "--esp-shell": pal.shell,
    "--esp-ink": pal.ink,
    "--esp-muted": pal.muted,
    "--esp-faint": pal.faint,
    "--esp-line": pal.line,
    "--esp-raise": pal.raise,
    "--esp-pen": pen,
    background: pal.shell,
    color: pal.ink,
    boxShadow: pal.shadow,
  } as CSSProperties;

  return (
    <section
      ref={shellRef}
      aria-label={title}
      tabIndex={-1}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        }
      }}
      className={`esp-root @container w-full min-w-0 max-w-[960px] rounded-[18px] outline-none ${className ?? ""}`}
      style={style}
    >
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b px-4 py-4 @md:px-6" style={{ borderColor: "var(--esp-line)" }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-(--esp-faint)">{kicker}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-(--esp-muted) shadow-[inset_0_0_0_1px_var(--esp-line)]">
              <span className="size-1.5 rounded-full" style={{ background: "var(--esp-ink)" }} />
              Executed
            </span>
          </div>
          <p className="mt-1.5 truncate font-sans text-[15px] font-medium tracking-[-0.015em]">{title}</p>
        </div>
        <div className="text-left @md:text-right">
          <p className="font-mono text-[12px] text-(--esp-ink)">
            {signed} of {parties.length} signed
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-(--esp-faint)">Northwind · 11 Oct 2026</p>
        </div>
      </header>

      <div className="px-4 py-6 @md:px-6 @md:py-8">
        <p className="mx-auto max-w-[68ch] font-serif text-[17px] leading-[1.45] tracking-[-0.01em] text-pretty text-(--esp-ink) @md:text-[18px]">{clause}</p>

        <div className="mx-auto mt-6 grid max-w-[860px] gap-4 @3xl:grid-cols-2">
          {parties.map((party, index) => {
            const isOpen = party.id === open;
            const ink = isOpen ? liveStrokes : party.strokes;
            const empty = ink.length === 0;
            return (
              <motion.article
                key={party.id}
                aria-label={isOpen ? `Sign for ${party.name}` : `Signed by ${party.name}`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(6px)" }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: reduce ? 0.12 : 0.46, delay: reduce ? 0 : 0.05 + index * 0.06, ease: EASE }}
                className="min-w-0"
              >
                <div className="rounded-[14px] px-3 pt-3 pb-2.5" style={{ background: pal.paper, boxShadow: pal.paperShadow }}>
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: pal.paperInk }}>
                    <span>{party.org}</span>
                    <span>{party.date}</span>
                  </div>
                  <svg
                    viewBox={`0 0 ${VW} ${VH}`}
                    className="mt-1 h-[148px] w-full touch-none @md:h-[168px]"
                    role={isOpen ? "application" : "img"}
                    aria-label={empty ? `Sign here for ${party.name}` : `Signature of ${party.name}`}
                    onPointerDown={isOpen ? onPointerDown : undefined}
                    onPointerMove={isOpen ? onPointerMove : undefined}
                    onPointerUp={isOpen ? onPointerUp : undefined}
                    onPointerCancel={isOpen ? onPointerUp : undefined}
                  >
                    <defs>
                      <filter id={`${grainId}-${party.id}`} x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
                        <feColorMatrix type="saturate" values="0" />
                      </filter>
                    </defs>
                    <rect width={VW} height={VH} fill={pal.paper} />
                    <rect width={VW} height={VH} filter={`url(#${grainId}-${party.id})`} opacity="0.055" style={{ mixBlendMode: "multiply" }} />
                    {showBaseline ? <line x1="36" x2={VW - 36} y1="168" y2="168" stroke={pal.paperLine} strokeWidth="1" /> : null}
                    {empty ? (
                      <text x={VW / 2} y="118" textAnchor="middle" fill={pal.paperInk} fontFamily="var(--font-serif), serif" fontSize="22" fontStyle="italic">
                        Sign here
                      </text>
                    ) : null}
                    {ink.map((stroke, i) => {
                      const segs = penPath(stroke.points, gauge);
                      if (!segs.length) return null;
                      return (
                        <g key={i} stroke={pen} strokeLinecap="round" strokeLinejoin="round" fill="none">
                          {segs.map((seg, k) => (
                            <line key={k} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} strokeWidth={seg.w} />
                          ))}
                        </g>
                      );
                    })}
                  </svg>
                  <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-2" style={{ borderColor: pal.paperLine }}>
                    <div className="min-w-0">
                      <div className="truncate font-sans text-[13.5px] font-medium tracking-[-0.011em]" style={{ color: "#1c1917" }}>
                        {party.name}
                      </div>
                      <div className="font-mono text-[11px]" style={{ color: pal.paperInk }}>
                        {party.role}
                      </div>
                    </div>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <ToolButton label="Undo" onClick={undo}>
                      <Undo2 size={15} strokeWidth={1.75} aria-hidden />
                    </ToolButton>
                    <ToolButton label="Clear" onClick={clear}>
                      <Eraser size={15} strokeWidth={1.75} aria-hidden />
                    </ToolButton>
                    <ToolButton label="Replay" onClick={replay} demo="replay" solid>
                      <RotateCcw size={15} strokeWidth={1.75} aria-hidden />
                    </ToolButton>
                    <ToolButton label="Export" onClick={exportMark}>
                      <Download size={15} strokeWidth={1.75} aria-hidden />
                    </ToolButton>
                  </div>
                ) : null}
              </motion.article>
            );
          })}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-3 font-mono text-[11px] text-(--esp-faint) @md:px-6" style={{ borderColor: "var(--esp-line)" }}>
        <span>Ink thins as the pen speeds up</span>
        <span className="tracking-[0.01em]">⌘Z undoes · export writes an SVG</span>
      </footer>
      <span className="sr-only" aria-live="polite">
        {note}
      </span>
    </section>
  );
}

function ToolButton({ label, onClick, children, demo, solid }: { label: string; onClick: () => void; children: ReactNode; demo?: string; solid?: boolean }) {
  return (
    <button
      type="button"
      data-demo={demo}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-[9px] px-2.5 text-[13px] tracking-[-0.011em] transition-[background-color,transform] duration-150 @md:min-h-9 ${solid ? "bg-(--esp-ink) text-(--esp-shell)" : "text-(--esp-muted) shadow-[inset_0_0_0_1px_var(--esp-line)] hover:text-(--esp-ink)"} ${PRESS} ${FOCUS}`}
    >
      {children}
      {label}
    </button>
  );
}

export default function EditorSignaturePadDemo({ theme: themeOverride, ...overrides }: Partial<EditorSignaturePadProps> = {}) {
  const theme = themeOverride ?? "dark";
  return (
    <div className={`flex min-h-dvh w-full items-center justify-center px-3 py-8 sm:px-8 ${theme === "light" ? "bg-[#f4f4f5]" : "bg-black"}`}>
      <EditorSignaturePad {...overrides} theme={theme} />
    </div>
  );
}
