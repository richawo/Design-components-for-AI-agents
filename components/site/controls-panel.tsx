"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { configuredPrompt, configuredSnippet, diffValues, isReplay } from "@/lib/demo/protocol";
import { optionOf } from "@/lib/demo/schema.mjs";
import { fetchProSource } from "@/lib/pro-source-client";
import type { ComponentControl, ControlValue, PropDoc } from "@/lib/registry-types";
import { CopyButton } from "./copy-button";

const SURFACE = "rounded-[10px] bg-white/[0.025] ring-1 ring-inset ring-white/[0.07] transition-[box-shadow,background-color] duration-150 ease-site";
const ROW = `${SURFACE} flex min-h-10 items-center justify-between gap-3 px-3.5 [@media(hover:hover)]:hover:ring-white/[0.12]`;
const LABEL = "truncate text-[13px] text-site-fg-2";
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

export type ControlsPanelProps = {
  slug: string;
  name: string;
  tier: "free" | "pro";
  controls: ComponentControl[];
  values: Record<string, ControlValue>;
  actions: Record<string, ControlValue>;
  onChange: (c: ComponentControl, v: ControlValue) => void;
  onAction: (c: ComponentControl, v: ControlValue | null) => void;
  onReset: () => void;
  usage: string;
  props: PropDoc[];
  /** Free components pass their prompt; Pro fetches it only for a licensed visitor. */
  prompt: string | null;
};

/**
 * "Customize": the props worth tuning, under the live preview. Every change
 * goes straight to the preview; the tuned values live in the URL hash and in
 * the copied snippet and prompt.
 */
export function ControlsPanel(p: ControlsPanelProps) {
  const uid = useId();
  const [proPrompt, setProPrompt] = useState<string | null | "locked">(null);
  useEffect(() => {
    if (p.tier !== "pro" || p.prompt) return;
    let live = true;
    fetchProSource(p.slug).then((s) => live && setProPrompt(s ? s.prompt : "locked"));
    return () => {
      live = false;
    };
  }, [p.tier, p.prompt, p.slug]);

  const prompt = p.prompt ?? (typeof proPrompt === "string" && proPrompt !== "locked" ? proPrompt : null);
  const tuned = Object.keys(diffValues(p.controls, p.values)).length;
  const groups = groupControls(p.controls);

  return (
    <section aria-labelledby={`${uid}-h`} className="border-t border-white/[0.06] px-3 pb-4 pt-3.5 sm:px-4 sm:pb-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div className="flex items-center gap-2.5">
          <h2 id={`${uid}-h`} className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">
            Customize
          </h2>
          <span aria-live="polite" className={`font-mono text-[11px] tabular-nums text-site-fg-3 transition-opacity duration-150 ${tuned ? "opacity-100" : "opacity-0"}`}>
            {tuned ? `· ${tuned} changed` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={p.onReset}
            disabled={!tuned}
            aria-label="Reset controls"
            className="site-btn site-btn-ghost h-8 px-2.5 text-xs font-medium sm:px-3"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
              <path d="M2.75 8a5.25 5.25 0 1 0 1.6-3.78M2.5 2.75v2.9h2.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Reset</span>
          </button>
          <CopyButton text={configuredSnippet(p.usage, p.controls, p.values, p.props)} label="Copy configured" shortLabel="Copy code" />
          {prompt ? (
            <CopyButton text={configuredPrompt(prompt, p.name, p.controls, p.values)} label="Copy configured prompt" shortLabel="Copy prompt" />
          ) : p.tier === "pro" && proPrompt === "locked" ? (
            <Link href="/pricing" className="site-btn site-btn-secondary h-8 gap-1.5 px-3.5 text-xs font-semibold" title="The configured prompt needs a Pro licence">
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              Configured prompt
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-3.5 space-y-4">
        {groups.map(([group, list]) => (
          <div key={group ?? "_"} role="group" aria-label={group ?? undefined}>
            {group && <p className="mb-2 px-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-site-fg-3">{group}</p>}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((c) => (
                <Control key={`${c.kind}:${c.prop}`} c={c} value={c.kind === "action" ? p.actions[c.prop] : p.values[c.prop]} onChange={p.onChange} onAction={p.onAction} uid={uid} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function groupControls(controls: ComponentControl[]): [string | null, ComponentControl[]][] {
  const out = new Map<string | null, ComponentControl[]>();
  for (const c of controls) out.set(c.group ?? null, [...(out.get(c.group ?? null) ?? []), c]);
  return [...out.entries()];
}

function Control({
  c,
  value,
  onChange,
  onAction,
  uid,
}: {
  c: ComponentControl;
  value: ControlValue | undefined;
  onChange: (c: ComponentControl, v: ControlValue) => void;
  onAction: (c: ComponentControl, v: ControlValue | null) => void;
  uid: string;
}) {
  const id = `${uid}-${c.prop.replace(/[^a-zA-Z0-9]/g, "")}-${c.kind}`;
  switch (c.kind) {
    case "slider":
      return <Slider id={id} c={c} value={Number(value ?? c.default)} onChange={(v) => onChange(c, v)} />;
    case "toggle":
      return (
        <div className={ROW}>
          <span id={`${id}-l`} className={LABEL}>
            {c.label}
          </span>
          <Switch labelledBy={`${id}-l`} on={value === true} onChange={(v) => onChange(c, v)} />
        </div>
      );
    case "segmented":
      return (
        <Wide options={(c.options ?? []).map(optionOf)}>
          <span id={`${id}-l`} className={LABEL}>
            {c.label}
          </span>
          <Segmented id={id} labelledBy={`${id}-l`} options={(c.options ?? []).map(optionOf)} value={value} onChange={(v) => onChange(c, v)} />
        </Wide>
      );
    case "select":
      return (
        <label className={`${ROW} relative cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-site-accent`}>
          <span className={LABEL}>{c.label}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-site-fg">
            <span className="truncate">{(c.options ?? []).map(optionOf).find((o) => o.value === value)?.label ?? String(value)}</span>
            <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-site-fg-3" fill="none" aria-hidden="true">
              <path d="M4.5 6.25 8 9.75l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {/* The native select does the work (keyboard, screen readers, mobile pickers); it sits invisibly over the row. */}
          <select
            aria-label={c.label}
            value={String(value)}
            onChange={(e) => {
              const o = (c.options ?? []).map(optionOf).find((x) => String(x.value) === e.target.value);
              if (o) onChange(c, o.value);
            }}
            className="absolute inset-0 cursor-pointer appearance-none opacity-0 focus:outline-none"
          >
            {(c.options ?? []).map(optionOf).map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );
    case "color":
      return <ColorControl id={id} c={c} value={String(value ?? c.default)} onChange={(v) => onChange(c, v)} />;
    case "text":
      return (
        <label className={`${ROW} cursor-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-site-accent`}>
          <span className={`${LABEL} shrink-0`}>{c.label}</span>
          <input
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(c, e.target.value)}
            spellCheck={false}
            className="h-9 min-w-0 flex-1 bg-transparent text-right text-[13px] text-site-fg outline-none placeholder:text-site-fg-3"
          />
        </label>
      );
    case "action": {
      if (isReplay(c))
        return (
          <div className={ROW}>
            <span className={LABEL}>{c.label}</span>
            <ActionButton pressed={false} onClick={() => onAction(c, null)}>
              Replay
            </ActionButton>
          </div>
        );
      const opts = c.options ? c.options.map(optionOf) : [{ value: c.value as ControlValue, label: c.label }];
      return (
        <Wide options={opts}>
          <span className={LABEL}>{c.label}</span>
          <div className="flex flex-wrap justify-end gap-1">
            {opts.map((o) => (
              <ActionButton key={String(o.value)} pressed={value === o.value} onClick={() => onAction(c, o.value)}>
                {o.label}
              </ActionButton>
            ))}
          </div>
        </Wide>
      );
    }
  }
}

/**
 * A row of choices (segmented options, action buttons). Short sets fit one
 * column; longer ones span two on wide grids. Either way it wraps when narrow.
 */
function Wide({ children, options }: { children: ReactNode; options: { label: string }[] }) {
  const wide = options.length > 3 || options.reduce((n, o) => n + o.label.length, 0) > 18;
  return <div className={`${SURFACE} flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-1 pl-3.5 pr-1 [@media(hover:hover)]:hover:ring-white/[0.12] ${wide ? "sm:col-span-2" : ""}`}>{children}</div>;
}

function Slider({ id, c, value, onChange }: { id: string; c: ComponentControl; value: number; onChange: (v: number) => void }) {
  const min = c.min ?? 0;
  const max = c.max ?? 100;
  const pct = ((value - min) / (max - min)) * 100;
  const decimals = String(c.step ?? 1).split(".")[1]?.length ?? 0;
  const shown = `${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${c.unit ? ` ${c.unit}` : ""}`;
  return (
    <div className={`${SURFACE} group relative h-10 overflow-hidden has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-site-accent [@media(hover:hover)]:hover:ring-white/[0.12]`}>
      {/* The fill is the value. Its leading edge only shows while the slider is in use, so it never cuts through the label at rest. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-white/[0.07] transition-[width] duration-100 ease-site" style={{ width: `${pct}%` }}>
        <span className="absolute inset-y-0 right-0 w-px bg-white/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100" />
      </span>
      <span aria-hidden="true" className="pointer-events-none relative flex h-full items-center justify-between gap-3 px-3.5">
        <span className={LABEL}>{c.label}</span>
        <span className="font-mono text-[12px] tabular-nums text-site-fg">{shown}</span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={c.step ?? 1}
        value={value}
        aria-label={c.label}
        aria-valuetext={shown}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 size-full cursor-ew-resize appearance-none opacity-0 focus:outline-none"
      />
    </div>
  );
}

function Switch({ on, onChange, labelledBy }: { on: boolean; onChange: (v: boolean) => void; labelledBy: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ease-site before:absolute before:-inset-2.5 before:content-[''] active:scale-[0.96] ${on ? "bg-site-fg" : "bg-white/[0.12]"}`}
    >
      <motion.span
        aria-hidden="true"
        className={`absolute left-0 top-0.5 size-4 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.4)] ${on ? "bg-black" : "bg-site-fg-2"}`}
        animate={{ x: on ? 18 : 2 }}
        initial={false}
        transition={SPRING_UI}
      />
    </button>
  );
}

function Segmented({ id, labelledBy, options, value, onChange }: { id: string; labelledBy: string; options: { value: ControlValue; label: string }[]; value: ControlValue | undefined; onChange: (v: ControlValue) => void }) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={(e) => {
        const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const n = (i + d + options.length) % options.length;
        onChange(options[n].value);
        e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[n]?.focus();
      }}
      className="flex rounded-[8px] bg-black/40 p-0.5 ring-1 ring-inset ring-white/[0.06]"
    >
      {options.map((o, k) => {
        const on = k === i;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`relative h-7 rounded-[6px] px-2.5 text-[12px] font-medium transition-colors duration-150 active:scale-[0.97] ${on ? "text-site-fg" : "text-site-fg-3 [@media(hover:hover)]:hover:text-site-fg-2"}`}
          >
            {on && <motion.span layoutId={`${id}-thumb`} className="absolute inset-0 rounded-[6px] bg-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" transition={SPRING_UI} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ColorControl({ id, c, value, onChange }: { id: string; c: ComponentControl; value: string; onChange: (v: string) => void }) {
  const swatches = (c.options ?? []).map(optionOf).map((o) => String(o.value).toLowerCase());
  const all = swatches.includes(String(c.default).toLowerCase()) ? swatches : [String(c.default).toLowerCase(), ...swatches];
  const custom = !all.includes(value.toLowerCase());
  return (
    <div className={`${ROW} pr-2`}>
      <span id={`${id}-l`} className={LABEL}>
        {c.label}
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-l`} className="flex items-center gap-1.5">
        <span className="mr-1 hidden font-mono text-[11px] uppercase tabular-nums text-site-fg-3 min-[420px]:inline">{value}</span>
        {all.map((hex) => {
          const on = hex === value.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={hex}
              onClick={() => onChange(hex)}
              className="relative grid size-6 place-items-center rounded-full before:absolute before:-inset-1 before:content-[''] active:scale-[0.92]"
            >
              <span className={`size-4 rounded-full ring-1 ring-inset ring-white/20 transition-transform duration-150 ${on ? "scale-100" : "scale-[0.8]"}`} style={{ background: hex }} />
              {on && <motion.span layoutId={`${id}-ring`} className="absolute inset-0 rounded-full ring-1 ring-white/70" transition={SPRING_UI} />}
            </button>
          );
        })}
        {/* Any colour: the native picker behind a small dashed swatch. */}
        <label className="relative grid size-6 cursor-pointer place-items-center rounded-full has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-site-accent" title="Custom colour">
          <span
            className={`size-4 rounded-full ${custom ? "ring-1 ring-inset ring-white/20" : "border border-dashed border-white/30"}`}
            style={custom ? { background: value } : undefined}
            aria-hidden="true"
          />
          {custom && <span aria-hidden="true" className="absolute inset-0 rounded-full ring-1 ring-white/70" />}
          <input type="color" value={value} aria-label={`${c.label}: custom colour`} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}

function ActionButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-7 rounded-[7px] px-2.5 text-[12px] font-medium transition-[background-color,color,box-shadow,scale] duration-150 active:scale-[0.97] ${
        pressed ? "bg-white/[0.1] text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "text-site-fg-2 ring-1 ring-inset ring-white/[0.08] [@media(hover:hover)]:hover:bg-white/[0.05] [@media(hover:hover)]:hover:text-site-fg"
      }`}
    >
      {children}
    </button>
  );
}
