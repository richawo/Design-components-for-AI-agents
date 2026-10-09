"use client";

import { useEffect, useRef } from "react";

/**
 * The site's signature texture: a soft light falling from above, drawn in
 * ordered (Bayer 8×8) dither instead of a smooth gradient. Rendered once per
 * size at cell resolution and scaled up without smoothing, so it costs nothing
 * after the first frame.
 */
const BAYER = Float32Array.from(
  [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21],
  (v) => (v + 0.5) / 64,
);

// Dark → light: four steps of white light. Alphas keep it a whisper; the
// texture is in the dither, not in colour.
const LEVELS: [number, number, number, number][] = [
  [255, 255, 255, 0],
  [255, 255, 255, 0.035],
  [255, 255, 255, 0.07],
  [255, 255, 255, 0.115],
];

export function DitherGlow({ cell = 3, className = "" }: { cell?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const off = document.createElement("canvas");
    const octx = off.getContext("2d")!;
    const L = LEVELS.length - 1;

    const draw = () => {
      const r = canvas.parentElement!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.ceil(r.width / cell));
      const h = Math.max(1, Math.ceil(r.height / cell));
      canvas.width = Math.round(w * cell * dpr);
      canvas.height = Math.round(h * cell * dpr);
      canvas.style.width = `${w * cell}px`;
      canvas.style.height = `${h * cell}px`;
      off.width = w;
      off.height = h;
      const img = octx.createImageData(w, h);
      const d = img.data;
      // A wide ellipse of light whose source sits just above the top edge.
      const cx = w / 2;
      const rx = Math.min(w * 0.42, 620 / cell);
      const ry = Math.min(h * 0.62, 520 / cell);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = (x - cx) / rx;
          const dy = (y + h * 0.06) / ry;
          const v = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy)) ** 1.8;
          const q = v * L;
          const lo = Math.floor(q);
          const lvl = Math.min(L, lo + (q - lo > BAYER[(y & 7) * 8 + (x & 7)] ? 1 : 0));
          const [cr, cg, cb, ca] = LEVELS[lvl];
          const o = (y * w + x) * 4;
          d[o] = cr;
          d[o + 1] = cg;
          d[o + 2] = cb;
          d[o + 3] = Math.round(ca * 255);
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    };

    draw();
    // The light comes up once it exists, rather than snapping on at hydration.
    canvas.style.opacity = "1";
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    });
    ro.observe(canvas.parentElement!);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [cell]);

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <canvas ref={ref} className="absolute left-0 top-0 opacity-0 transition-opacity duration-[1200ms] ease-site [image-rendering:pixelated] motion-reduce:duration-150" />
    </div>
  );
}
