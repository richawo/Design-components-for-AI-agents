"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { memo, useEffect, useId, useRef, useState } from "react";
import { fetchFreeSource, fetchProSource, type SourcePayload } from "@/lib/pro-source-client";
import { CopyButton } from "./copy-button";

export type { SourcePayload };

type Tab = "code" | "prompt" | "json" | "install";

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: "code", label: "Code", hint: "Paste into your project" },
  { key: "prompt", label: "Prompt", hint: "Give to your agent to rebuild it in your style" },
  { key: "json", label: "JSON prompt", hint: "Structured brief for agents that like structure" },
  { key: "install", label: "Install", hint: "shadcn CLI, MCP or by hand" },
];

export function SourceTabs({
  slug,
  name,
  tier,
  fileName,
  initial,
  installText,
  installHtml,
}: {
  slug: string;
  name: string;
  tier: "free" | "pro";
  fileName: string;
  initial: SourcePayload | null;
  installText: string;
  installHtml: string;
}) {
  const uid = useId();
  const container = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(!!initial);
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(["code"]));
  const selectTab = (next: Tab) => { setTab(next); setVisited(current => current.has(next) ? current : new Set([...current, next])); };
  const [tab, setTab] = useState<Tab>("code");
  const [source, setSource] = useState<SourcePayload | null>(initial);
  const [status, setStatus] = useState<"ready" | "loading" | "locked" | "error">(initial ? "ready" : "loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); observer.disconnect(); }
    }, { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (initial || !near) return;
    let live = true;
    setStatus("loading");
    (tier === "free" ? fetchFreeSource(slug) : fetchProSource(slug)).then((data) => {
      if (!live) return;
      if (!data) return setStatus("locked");
      setSource(data);
      setStatus("ready");
    }).catch(() => { if (live) setStatus("error"); });
    return () => {
      live = false;
    };
  }, [initial, slug, tier, near, attempt]);

  const agentBrief = source
    ? `Add the "${name}" component from Design for AI to this project.\n\n## Install\n${installText}\n\n## Design brief\n${source.prompt.trim()}\n\n## Source (${fileName})\n\`\`\`tsx\n${source.code.trim()}\n\`\`\`\n`
    : "";

  return (
    <div ref={container} className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-site-raised text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div role="tablist" aria-label="Component source" aria-orientation="horizontal" className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`${uid}-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`${uid}-panel-${t.key}`}
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => selectTab(t.key)}
              onKeyDown={(event) => {
                if (event.altKey || event.ctrlKey || event.metaKey) return;
                const index = TABS.indexOf(t);
                const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
                const direction = event.key === "ArrowRight" ? (rtl ? -1 : 1) : event.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
                const next = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : direction ? (index + direction + TABS.length) % TABS.length : null;
                if (next === null) return;
                event.preventDefault();
                selectTab(TABS[next].key);
                const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']");
                buttons?.[next]?.focus();
              }}
              className={`group relative min-h-11 shrink-0 px-3.5 pb-3 pt-2.5 text-[13px] font-medium transition-colors duration-150 ${tab === t.key ? "text-site-fg" : "text-site-fg-3 hover:text-site-fg-2"}`}
            >
              <span className="relative inline-block transition-transform duration-150 group-active:scale-[0.95]">{t.label}</span>
              {tab === t.key && (
                <motion.span
                  layoutId={`source-tab-${slug}`}
                  className="absolute inset-x-3 -bottom-px h-px bg-site-accent"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-2.5">
          {status === "ready" && source && tab !== "install" && (
            <CopyButton
              text={tab === "code" ? source.code : tab === "prompt" ? source.prompt : source.promptJson}
              label={tab === "code" ? "Copy code" : tab === "prompt" ? "Copy prompt" : "Copy JSON"}
            />
          )}
          {tab === "install" && <CopyButton text={installText} label="Copy command" />}
          {status === "ready" && source && <CopyButton text={agentBrief} label="Copy for agent" variant="accent" />}
        </div>
      </div>

      <p className="px-4 pt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3 sm:px-5">
        {tab === "code" ? fileName : TABS.find((t) => t.key === tab)!.hint}
      </p>

      {TABS.map((item) => <div key={item.key} role="tabpanel" id={`${uid}-panel-${item.key}`} aria-labelledby={`${uid}-tab-${item.key}`} hidden={tab !== item.key} tabIndex={tab === item.key ? 0 : -1} className="relative">
        {!visited.has(item.key) ? null : item.key === "install" ? (
          <Scroll html={installHtml} />
        ) : status === "loading" ? (
          <div className="flex h-64 items-center justify-center">
            <span role="status" className="size-5 animate-spin rounded-full border-2 border-white/10 border-t-white/50" aria-label="Loading source" />
          </div>
        ) : status === "error" ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center">
            <p role="status" className="text-sm text-site-fg-2">We couldn't load the source. Please try again.</p>
            <button type="button" className="site-btn site-btn-secondary min-h-11 px-5" onClick={() => setAttempt((value) => value + 1)}>Retry source</button>
          </div>
        ) : status === "locked" || !source ? (
          <Locked name={name} tab={item.key} />
        ) : item.key === "code" ? (
          <Scroll html={source.codeHtml} />
        ) : item.key === "json" ? (
          <Scroll html={source.promptJsonHtml} />
        ) : (
          <div className="max-h-[560px] overflow-auto px-4 pb-6 pt-3 sm:px-5">
            <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.75] text-site-fg-2">{source.prompt}</pre>
          </div>
        )}
      </div>)}
      {tier === "pro" && status === "ready" && (
        <p className="flex items-center gap-2 border-t border-white/[0.06] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-site-accent" />
          Pro licence active
        </p>
      )}
    </div>
  );
}

const Scroll = memo(function Scroll({ html }: { html: string }) {
  return (
    <div
      className="max-h-[560px] overflow-auto px-4 pb-6 pt-3 font-mono text-[13px] leading-[1.7] sm:px-5 [&_pre]:!bg-transparent [&_pre]:outline-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

const FAKE = [
  "export function Component({ items = defaults }: Props) {",
  "  const reduce = useReducedMotion();",
  "  const [active, setActive] = useState(0);",
  "  return (",
  '    <section className="relative isolate overflow-hidden">',
  '      <div className="mx-auto grid max-w-7xl gap-10 px-6">',
  "        {items.map((item, i) => (",
  "          <motion.article key={item.id} layout>",
  "  …",
];

function Locked({ name, tab }: { name: string; tab: Tab }) {
  return (
    <div className="relative h-[420px] overflow-hidden">
      <pre aria-hidden="true" className="select-none px-5 pt-3 font-mono text-[13px] leading-[1.7] text-site-fg-2 blur-[5px]">
        {FAKE.join("\n")}
        {"\n"}
        {FAKE.join("\n")}
      </pre>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-site-raised/40 via-site-raised/85 to-site-raised p-6">
        <div className="site-rise max-w-sm text-center">
          <span className="site-surface mx-auto flex size-11 items-center justify-center rounded-xl text-site-fg">
            <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
              <rect x="4" y="9" width="12" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <p className="mt-5 text-xl font-semibold tracking-[-0.03em]">
            The {tab === "code" ? "code" : tab === "json" ? "JSON prompt" : "prompt"} for {name} is Pro
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-site-fg-2">
            Pro includes every Pro component and block, its code and both briefs, plus the private registry. Choose yearly or lifetime access.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/pricing" className="site-btn site-btn-accent h-10 px-5 text-[14px]">
              Get Pro
            </Link>
            <Link href="/account" className="site-btn site-btn-secondary h-10 px-5 text-[14px]">
              I have a licence
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
