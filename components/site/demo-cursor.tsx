"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { CURSOR_CSS, CURSOR_HTML } from "@/lib/demo/cursor.mjs";
import type { CursorHandle } from "@/lib/demo/player";

/**
 * The drawn pointer the live demo moves. Positioned by transform from the
 * player (no React render per frame), invisible to hit-testing, and hidden
 * from assistive tech: it's a picture of a pointer, not a control.
 */
export const DemoCursor = forwardRef<CursorHandle>(function DemoCursor(_props, ref) {
  const el = useRef<HTMLDivElement>(null);
  useImperativeHandle(
    ref,
    () => ({
      move(x, y) {
        if (el.current) el.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      },
      show(on) {
        if (el.current) el.current.dataset.on = on ? "1" : "0";
      },
      press(down) {
        if (el.current) el.current.dataset.down = down ? "1" : "0";
      },
      pulse() {
        const ring = el.current?.firstElementChild as HTMLElement | null;
        if (!ring) return;
        ring.dataset.pulse = "0";
        void ring.offsetWidth; // restart the animation
        ring.dataset.pulse = "1";
      },
    }),
    [],
  );
  return (
    <>
      <style>{CURSOR_CSS}</style>
      <div ref={el} className="dfa-cursor" aria-hidden="true" data-on="0" dangerouslySetInnerHTML={{ __html: CURSOR_HTML }} />
    </>
  );
});
