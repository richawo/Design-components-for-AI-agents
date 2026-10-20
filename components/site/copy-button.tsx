"use client";
import { useSiteI18n } from "@/components/site/site-i18n";

import { useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";

export function CopyButton({
  text,
  label = "Copy",
  shortLabel,
  copiedLabel = "Copied",
  className = "",
  variant = "dark",
}: {
  text: string;
  label?: string;
  /** Shown instead of label below the sm breakpoint, where the full label won't fit. */
  shortLabel?: string;
  copiedLabel?: string;
  className?: string;
  variant?: "dark" | "light" | "accent";
}) {
  const { localize } = useSiteI18n();

  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const copied = status === "copied";
  const pending = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, []);
  const styles = {
    dark: "bg-white/[0.07] text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-white/[0.11]",
    light: "site-btn-primary",
    accent: "site-btn-accent",
  }[variant];
  return (
    localize(<>
    <button
      type="button"
      onClick={async () => {
        if (pending.current) return;
        pending.current = true;
        setStatus("copying");
        clearTimeout(timer.current);
        const ok = await copyText(text);
        pending.current = false;
        if (!mounted.current) return;
        setStatus(ok ? "copied" : "error");
        if (ok) timer.current = setTimeout(() => setStatus("idle"), 1600);
      }}
      disabled={status === "copying"}
      aria-busy={status === "copying"}
      className={`site-btn h-8 gap-1.5 px-3.5 text-xs font-semibold pointer-coarse:min-h-11 ${styles} ${className}`}
      aria-label={status === "error" ? `Retry ${label.toLowerCase()}` : shortLabel && !copied ? label : undefined}
      title={status === "error" ? "Copy failed. Try again, or select the text and copy it manually." : undefined}
    >
      {copied ? (
        <svg key="check" viewBox="0 0 16 16" className="site-pop size-3.5" fill="none" aria-hidden="true">
          <path className="site-draw" d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg key="copy" viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
          <rect x="5" y="5" width="8.5" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10.5 5V3.8c0-.7-.6-1.3-1.3-1.3H3.8c-.7 0-1.3.6-1.3 1.3v5.4c0 .7.6 1.3 1.3 1.3H5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )}
      {status === "error" ? "Copy failed" : copied ? (
        copiedLabel
      ) : shortLabel ? (
        <>
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </>
      ) : (
        label
      )}
    </button>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {status === "error" ? "Copy failed. Try again, or select the text and copy it manually." : copied ? copiedLabel : ""}
    </span>
    </>)
  );
}
