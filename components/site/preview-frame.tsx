"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const VIEWPORTS = [
  { key: "desktop", label: "Desktop", width: "100%", icon: "M2 3h12v8H2zM6 14h4" },
  { key: "tablet", label: "Tablet", width: "820px", icon: "M4 1.5h8v13H4zM7.5 12.5h1" },
  { key: "mobile", label: "Mobile", width: "390px", icon: "M5 1.5h6v13H5zM7.5 12.5h1" },
] as const;

export function PreviewFrame({
  slug,
  name,
  height,
  platform,
  theme,
}: {
  slug: string;
  name: string;
  height: number;
  platform: "web" | "mobile";
  theme: "light" | "dark";
}) {
  const [vp, setVp] = useState<(typeof VIEWPORTS)[number]["key"]>("desktop");
  const [key, setKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLIFrameElement>(null);
  const width = platform === "mobile" ? "100%" : VIEWPORTS.find((v) => v.key === vp)!.width;
  const frameHeight = platform === "mobile" ? 940 : height;

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
          <span className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">
            {platform === "mobile" ? "Live · React Native via react-native-web" : "Live preview"}
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
          <button
            type="button"
            onClick={() => {
              setLoaded(false);
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
      <div className="site-dots relative flex justify-center bg-site-sunken">
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
    </div>
  );
}
