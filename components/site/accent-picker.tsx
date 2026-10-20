"use client";
import { useSiteI18n } from "@/components/site/site-i18n";

import { useEffect, useId, useRef, useState } from "react";
import { DEFAULT_ACCENT, parseAccent } from "@/lib/accent";
import { setAccent, useAccent } from "@/lib/accent-client";

const SWATCHES = ["#ff7a45", "#e85d8c", "#a78bfa", "#60a5fa", "#4ade80", "#facc15"];
export function AccentPicker({ defaultColor = DEFAULT_ACCENT }: { defaultColor?: string }) {
  const { localize } = useSiteI18n();

  const accent = useAccent();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(accent ?? defaultColor);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => setDraft(accent ?? defaultColor), [accent, defaultColor]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); };
  }, [open]);
  const invalid = parseAccent(draft) === null;
  return localize(<div data-accent-picker ref={box} className="relative" onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button ref={trigger} type="button" aria-label="Component accent" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="site-btn site-btn-ghost h-11 gap-2 px-2.5 text-xs" title="Accent across live component previews">
      <span aria-hidden="true" className="size-3.5 rounded-full ring-1 ring-inset ring-white/30" style={{ background: accent ?? defaultColor }} />
      Accent
    </button>
    {open && <div id={id} className="absolute right-0 top-full z-50 mt-3 w-72 max-w-[calc(100vw-4rem)] rounded-2xl border border-white/15 bg-site-raised p-5 text-site-fg shadow-2xl" role="region" aria-label="Component accent settings">
      <p className="text-sm font-medium">Component accent</p>
      <p className="mt-1 text-xs leading-relaxed text-site-fg-2">Use one colour for accents across live component previews.</p>
      <div className="mt-4 flex justify-between gap-1" aria-label="Suggested colours">
        {SWATCHES.map(hex => <button key={hex} type="button" aria-label={`Use ${hex}`} aria-pressed={accent === hex} onClick={() => setAccent(hex)} className="flex size-8 items-center justify-center rounded-full border border-white/15 transition-transform active:scale-90 motion-reduce:!scale-100" style={{background:hex}}>
          {accent === hex && <span aria-hidden="true" className="size-1.5 rounded-full bg-black" />}
        </button>)}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <input type="color" aria-label="Custom accent colour" value={accent ?? defaultColor} onChange={e => setAccent(e.target.value)} className="size-10 shrink-0 cursor-pointer rounded-lg border border-white/15 bg-transparent p-1" />
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-hex`} className="text-xs text-site-fg-2">Hex colour</label>
          <input id={`${id}-hex`} value={draft} spellCheck={false} maxLength={7} aria-invalid={invalid} onChange={e => { setDraft(e.target.value); if (/^#[\da-f]{6}$/i.test(e.target.value)) setAccent(e.target.value); }} onBlur={() => { const hex = parseAccent(draft); if (hex) setAccent(hex); else setDraft(accent ?? defaultColor); }} onKeyDown={e => { if (e.key === "Enter") { const hex = parseAccent(draft); if (hex) setAccent(hex); } }} className="mt-1 h-9 w-full rounded-lg border border-white/15 bg-black px-3 font-mono text-sm uppercase" />
        </div>
      </div>
      <button type="button" onClick={() => setAccent(null)} disabled={accent === null} className="site-btn site-btn-secondary mt-4 h-10 w-full text-xs">Use template defaults</button>
      <p className="mt-3 text-[11px] leading-relaxed text-site-fg-3">Saved in this browser. Individual component colours can override it.</p>
    </div>}
  </div>);
}
