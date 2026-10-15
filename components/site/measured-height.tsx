"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/** Resize the surrounding layout without scaling or remounting its contents. */
export function MeasuredHeight({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const reduced = useRef(reduce);
  reduced.current = reduce;
  const inner = useRef<HTMLDivElement>(null);
  const measured = useRef<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);

  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    const measure = () => {
      const next = node.getBoundingClientRect().height;
      if (measured.current !== null && Math.abs(next - measured.current) < 0.25) return;
      setMoving(measured.current !== null && !reduced.current);
      measured.current = next;
      setHeight(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (reduce) setMoving(false);
  }, [reduce]);

  return (
    <div
      data-measured-height=""
      data-height-moving={moving || undefined}
      style={{
        height: height ?? "auto",
        overflow: moving && !reduce ? "hidden" : "visible",
        transition: height === null || reduce ? "none" : "height 240ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      onTransitionEnd={(event) => {
        if (event.target !== event.currentTarget || event.propertyName !== "height") return;
        if (measured.current !== null && Math.abs(event.currentTarget.getBoundingClientRect().height - measured.current) < 1) setMoving(false);
      }}
    >
      <div ref={inner} style={{ display: "flow-root" }}>{children}</div>
    </div>
  );
}
