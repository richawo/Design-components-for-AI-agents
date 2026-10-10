"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PREVIEW_CHANNEL, decodeHash, defaultValues, diffValues, encodeHash, parseFromPreview, type Body, type ToPreview } from "@/lib/demo/protocol";
import type { ComponentControl, ControlValue, PropDoc } from "@/lib/registry-types";
import { ControlsPanel } from "./controls-panel";

const VIEWPORTS = [
  { key: "desktop", label: "Desktop", width: "100%", icon: "M2 3h12v8H2zM6 14h4" },
  { key: "tablet", label: "Tablet", width: "820px", icon: "M4 1.5h8v13H4zM7.5 12.5h1" },
  { key: "mobile", label: "Mobile", width: "390px", icon: "M5 1.5h6v13H5zM7.5 12.5h1" },
] as const;

/** How much of the preview must be on screen before its demo plays. */
const AUTOPLAY_AT = 0.45;

export function PreviewFrame({
  slug,
  name,
  height,
  platform,
  theme,
  tier = "free",
  hasDemo = false,
  controls = [],
  usage = "",
  props = [],
  prompt = null,
}: {
  slug: string;
  name: string;
  height: number;
  platform: "web" | "mobile";
  theme: "light" | "dark";
  tier?: "free" | "pro";
  /** The component has a demo script: autoplay it when visible and offer Replay. */
  hasDemo?: boolean;
  controls?: ComponentControl[];
  usage?: string;
  props?: PropDoc[];
  /** The free design prompt, for "Copy configured prompt". Pro passes null and fetches it with a licence. */
  prompt?: string | null;
}) {
  const [vp, setVp] = useState<(typeof VIEWPORTS)[number]["key"]>("desktop");
  const [key, setKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const width = platform === "mobile" ? "100%" : VIEWPORTS.find((v) => v.key === vp)!.width;
  const frameHeight = platform === "mobile" ? 940 : height;

  /* -------------------------------------------------------------- */
  /* Tuned values and the demo, over the preview protocol            */
  /* -------------------------------------------------------------- */
  const [values, setValues] = useState<Record<string, ControlValue>>(() => defaultValues(controls));
  const [actions, setActions] = useState<Record<string, ControlValue>>({});
  const [playing, setPlaying] = useState(false);
  const ready = useRef(false);
  const visible = useRef(false);
  // Once a visitor takes over (or asks for reduced motion), the demo only runs on Replay.
  const autoplay = useRef(true);
  const remountNext = useRef(false);
  // Latest values for the "ready" handshake, which runs outside React's render.
  const valuesRef = useRef(values);
  const actionsRef = useRef(actions);
  useEffect(() => {
    valuesRef.current = values;
    actionsRef.current = actions;
  }, [values, actions]);

  const send = useCallback((msg: Body<ToPreview>) => {
    const win = ref.current?.contentWindow;
    if (win && ready.current) win.postMessage({ channel: PREVIEW_CHANNEL, ...msg }, window.location.origin);
  }, []);

  // Values from a shared link (#c=…) win over the defaults.
  useEffect(() => {
    if (!controls.length) return;
    const fromHash = decodeHash(controls, window.location.hash);
    if (Object.keys(fromHash).length) setValues((v) => ({ ...v, ...fromHash }));
    // Only on first load; later edits write the hash themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push tuned values to the preview and into the URL (diff only, so a clean page has a clean URL).
  useEffect(() => {
    if (!controls.length) return;
    send({ type: "props", props: { ...diffValues(controls, values), ...actions }, remount: remountNext.current });
    remountNext.current = false;
    const hash = encodeHash(controls, values);
    const url = `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ""}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, "", url);
  }, [values, actions, controls, send]);

  const tryAutoplay = useCallback(() => {
    if (hasDemo && autoplay.current && visible.current && ready.current) send({ type: "demo", action: "play" });
  }, [hasDemo, send]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== ref.current?.contentWindow) return;
      const msg = parseFromPreview(e.data);
      if (!msg) return;
      if (msg.type === "ready") {
        ready.current = true;
        if (controls.length) send({ type: "props", props: { ...diffValues(controls, valuesRef.current), ...actionsRef.current } });
        tryAutoplay();
      } else {
        setPlaying(msg.playing);
        if (msg.reason === "user") autoplay.current = false;
      }
    };
    window.addEventListener("message", onMessage);
    // The frame may have loaded (and said "ready") before we were listening.
    try {
      const win = ref.current?.contentWindow;
      if (win && win.location.origin === window.location.origin) win.postMessage({ channel: PREVIEW_CHANNEL, type: "hello" }, window.location.origin);
    } catch {
      // Not ours yet (still navigating); it will announce itself when it loads.
    }
    return () => window.removeEventListener("message", onMessage);
  }, [controls, send, tryAutoplay]);

  // Play when the preview is mostly on screen; stop when it leaves.
  useEffect(() => {
    if (!hasDemo || !box.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) autoplay.current = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.intersectionRatio >= AUTOPLAY_AT;
        if (visible.current) tryAutoplay();
        else send({ type: "demo", action: "stop" });
      },
      { threshold: [0, AUTOPLAY_AT] },
    );
    io.observe(box.current);
    return () => io.disconnect();
  }, [hasDemo, send, tryAutoplay]);

  const replay = () => {
    setActions({});
    send({ type: "demo", action: "replay" });
  };

  const onChange = (c: ComponentControl, v: ControlValue) => {
    if (c.remount) remountNext.current = true;
    setValues((cur) => ({ ...cur, [c.prop]: v }));
  };
  const onAction = (c: ComponentControl, v: ControlValue | null) => {
    if (v === null) return replay();
    send({ type: "demo", action: "stop" });
    autoplay.current = false;
    setActions((cur) => ({ ...cur, [c.prop]: v }));
  };
  const onReset = () => {
    remountNext.current = controls.some((c) => c.remount && values[c.prop] !== c.default);
    setValues(defaultValues(controls));
    setActions({});
  };

  // The iframe is in the server HTML, so it often finishes loading before
  // React hydrates and attaches onLoad. Check its document after mount (and
  // after every reload) so the preview never stays hidden behind the spinner.
  useEffect(() => {
    const frame = ref.current;
    try {
      const doc = frame?.contentDocument;
      if (doc && doc.readyState === "complete" && frame.contentWindow?.location.href !== "about:blank") setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [key]);

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-site-raised shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_40px_100px_-40px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex size-2" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-site-ok opacity-50 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-site-ok" />
          </span>
          <span className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3" aria-live="polite">
            {playing ? (
              <span key="demo" className="site-rise inline-block">
                Demo<span className="text-site-fg-3/70 normal-case tracking-normal"> · move to take over</span>
              </span>
            ) : platform === "mobile" ? (
              "Live · React Native via react-native-web"
            ) : (
              "Live preview"
            )}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {platform === "web" && (
            <div role="radiogroup" aria-label="Preview width" className="hidden rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5 md:flex">
              {VIEWPORTS.map((v) => (
                <button
                  key={v.key}
                  role="radio"
                  aria-checked={vp === v.key}
                  aria-label={v.label}
                  title={v.label}
                  onClick={() => setVp(v.key)}
                  className={`relative flex h-7 w-8 items-center justify-center rounded-md transition-colors duration-150 ${vp === v.key ? "text-site-fg" : "text-site-fg-3 hover:text-site-fg-2"}`}
                >
                  {vp === v.key && (
                    <motion.span
                      layoutId={`preview-vp-${slug}`}
                      className="absolute inset-0 rounded-md bg-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <svg viewBox="0 0 16 16" className="relative size-4 transition-transform duration-150 active:scale-90" fill="none" aria-hidden="true">
                    <path d={v.icon} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                </button>
              ))}
            </div>
          )}
          {hasDemo && (
            <button
              type="button"
              onClick={replay}
              aria-label="Replay demo"
              title="Replay demo"
              className="group/replay flex h-8 items-center gap-1.5 rounded-md px-2 text-site-fg-3 transition duration-150 hover:bg-white/[0.05] hover:text-site-fg active:scale-95"
            >
              <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
                <path d="M5.25 3.9v8.2a.6.6 0 0 0 .92.5l6.3-4.1a.6.6 0 0 0 0-1l-6.3-4.1a.6.6 0 0 0-.92.5Z" fill="currentColor" className={playing ? "opacity-40" : ""} />
              </svg>
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] sm:inline">Replay</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setLoaded(false);
              ready.current = false;
              setPlaying(false);
              setKey((k) => k + 1);
            }}
            aria-label="Reload preview"
            title="Reload"
            className="flex size-8 items-center justify-center rounded-md text-site-fg-3 transition duration-150 hover:bg-white/[0.05] hover:text-site-fg active:scale-95"
          >
            <svg
              viewBox="0 0 16 16"
              className="size-4 transition-transform duration-700 ease-site motion-reduce:transition-none"
              style={{ transform: `rotate(${key * 360}deg)` }}
              fill="none"
              aria-hidden="true"
            >
              <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <a
            href={`/preview/${slug}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Open preview in a new tab"
            title="Open in new tab"
            className="group/open flex size-8 items-center justify-center rounded-md text-site-fg-3 transition duration-150 hover:bg-white/[0.05] hover:text-site-fg active:scale-95"
          >
            <svg viewBox="0 0 16 16" className="size-4 transition-transform duration-150 ease-site group-hover/open:-translate-y-px group-hover/open:translate-x-px" fill="none" aria-hidden="true">
              <path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
      <div ref={box} className="site-dots relative flex justify-center bg-site-sunken">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="size-5 animate-spin rounded-full border-2 border-white/10 border-t-white/50" aria-label="Loading preview" />
          </div>
        )}
        <iframe
          key={key}
          ref={ref}
          src={`/preview/${slug}`}
          title={`${name} live preview`}
          allow="microphone; clipboard-write"
          onLoad={() => setLoaded(true)}
          style={{ width, height: frameHeight, maxWidth: "100%" }}
          className={`block transition-[width,opacity] duration-500 ease-site ${theme === "dark" ? "bg-black" : "bg-white"} ${loaded ? "opacity-100" : "opacity-0"} ${vp !== "desktop" && platform === "web" ? "border-x border-white/10" : ""}`}
        />
      </div>
      {controls.length > 0 && (
        <ControlsPanel
          slug={slug}
          name={name}
          tier={tier}
          controls={controls}
          values={values}
          actions={actions}
          onChange={onChange}
          onAction={onAction}
          onReset={onReset}
          usage={usage}
          props={props}
          prompt={prompt}
        />
      )}
    </div>
  );
}
