"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { previews } from "@/registry/__generated__/previews";
import { DemoAborted, DemoPlayer, whenSmooth, type CursorHandle } from "@/lib/demo/player";
import { PREVIEW_CHANNEL, parseToPreview, type Body, type FromPreview } from "@/lib/demo/protocol";
import { parseSteps } from "@/lib/demo/schema.mjs";
import type { ControlValue, DemoScript } from "@/lib/registry-types";
import { DemoCursor } from "./demo-cursor";

/** Pause between loops of a looping demo. */
const LOOP_GAP_MS = 1600;
/** Let a remounted component paint before the script starts. */
const MOUNT_SETTLE_MS = 120;

type AnyComponent = ComponentType<Record<string, ControlValue>>;

/**
 * Renders one registry component on a bare page. The component page embeds
 * this in an iframe so breakpoints respond to the frame width, not the window.
 * Mobile (React Native) components render inside a phone-sized viewport.
 *
 * Embedded, it speaks a small postMessage protocol with its same-origin parent
 * (lib/demo/protocol.ts): props from the Customize panel are merged over the
 * demo's own, and the parent can play, stop or replay the demo script. Opened
 * on its own (screenshots, a new tab) nothing autoplays.
 */
export function PreviewRenderer({ slug, platform, theme, demo }: { slug: string; platform: "web" | "mobile"; theme: "light" | "dark"; demo?: DemoScript }) {
  const [Comp, setComp] = useState<AnyComponent | null>(null);
  const [overrides, setOverrides] = useState<Record<string, ControlValue>>({});
  const [mount, setMount] = useState(0);
  const cursor = useRef<CursorHandle>(null);
  const run = useRef<AbortController | null>(null);
  const steps = useMemo(() => (demo ? parseSteps(demo.steps) : null), [demo]);

  useEffect(() => {
    let live = true;
    previews[slug]?.().then((m) => live && setComp(() => m.default as AnyComponent));
    return () => {
      live = false;
    };
  }, [slug]);

  const post = useCallback((msg: Body<FromPreview>) => {
    if (window.parent !== window) window.parent.postMessage({ channel: PREVIEW_CHANNEL, ...msg }, window.location.origin);
  }, []);

  const stop = useCallback(
    (reason: "user" | "stopped") => {
      if (!run.current) return;
      run.current.abort();
      run.current = null;
      post({ type: "demo-state", playing: false, reason });
    },
    [post],
  );

  const play = useCallback(
    async (fresh: boolean) => {
      if (!steps || !cursor.current) return;
      run.current?.abort();
      const ctl = new AbortController();
      run.current = ctl;
      post({ type: "demo-state", playing: true });
      const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
      try {
        for (let pass = 0; ; pass++) {
          if (fresh || pass > 0) {
            // Start from the component's first state, as a visitor would.
            setMount((m) => m + 1);
            await wait(MOUNT_SETTLE_MS);
          }
          await whenSmooth(window);
          if (ctl.signal.aborted) return;
          await new DemoPlayer(window, cursor.current!, ctl.signal).play(steps);
          if (!demo?.loop || ctl.signal.aborted) break;
          await wait(LOOP_GAP_MS);
          if (ctl.signal.aborted) return;
        }
        if (run.current === ctl) {
          run.current = null;
          post({ type: "demo-state", playing: false, reason: "finished" });
        }
      } catch (e) {
        if (!(e instanceof DemoAborted)) throw e;
      }
    },
    [steps, demo?.loop, post],
  );

  // Messages from the component page.
  useEffect(() => {
    if (window.parent === window) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const msg = parseToPreview(e.data);
      if (!msg) return;
      if (msg.type === "hello") post({ type: "ready", hasDemo: !!steps });
      else if (msg.type === "props") {
        setOverrides(msg.props);
        if (msg.remount) setMount((m) => m + 1);
      } else if (msg.action === "stop") stop("stopped");
      // Autoplay never runs with reduced motion; an explicit replay always does.
      else if (msg.action === "play") {
        if (!reduce.matches && !run.current) void play(false);
      } else void play(true);
    };
    window.addEventListener("message", onMessage);
    post({ type: "ready", hasDemo: !!steps });
    return () => window.removeEventListener("message", onMessage);
  }, [play, stop, post, steps]);

  // Any real input hands control back to the visitor at once. Capture phase,
  // so the demo has stopped before the component sees the event.
  useEffect(() => {
    const takeOver = (e: Event) => {
      if (!e.isTrusted || !run.current) return;
      if (e.type === "pointermove" && (e as PointerEvent).movementX === 0 && (e as PointerEvent).movementY === 0) return;
      stop("user");
    };
    const types = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
    for (const t of types) window.addEventListener(t, takeOver, { capture: true, passive: true });
    return () => {
      for (const t of types) window.removeEventListener(t, takeOver, { capture: true });
    };
  }, [stop]);

  useEffect(() => () => run.current?.abort(), []);

  const node = Comp ? <Comp key={mount} {...overrides} /> : null;

  if (platform === "mobile") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black p-0 sm:p-8">
        <div className="relative h-dvh w-full overflow-hidden bg-white sm:h-[844px] sm:w-[390px] sm:rounded-[54px] sm:shadow-[0_0_0_10px_#1a1a1c,0_0_0_11px_#2e2e33,0_40px_120px_-20px_rgba(0,0,0,0.9)]">
          <div className="flex h-full w-full flex-col">{node}</div>
          <div className="pointer-events-none absolute left-1/2 top-[11px] hidden h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black sm:block" />
        </div>
        {steps && <DemoCursor ref={cursor} />}
      </div>
    );
  }

  return (
    <div className={theme === "dark" ? "min-h-dvh bg-black" : "min-h-dvh bg-white"}>
      {node}
      {steps && <DemoCursor ref={cursor} />}
    </div>
  );
}
