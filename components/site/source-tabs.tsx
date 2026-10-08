"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CopyButton } from "./copy-button";

export type SourcePayload = {
  code: string;
  codeHtml: string;
  prompt: string;
  promptJson: string;
  promptJsonHtml: string;
};

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
  const [tab, setTab] = useState<Tab>("code");
  const [source, setSource] = useState<SourcePayload | null>(initial);
  const [status, setStatus] = useState<"ready" | "loading" | "locked">(initial ? "ready" : "loading");

  useEffect(() => {
    if (initial) return;
    let live = true;
    fetch(`/api/pro/source/${slug}`, { credentials: "same-origin" })
      .then(async (r) => {
        if (!live) return;
        const data = r.ok ? ((await r.json()) as SourcePayload | { locked: true }) : null;
        if (!live) return;
        if (!data || "locked" in data) return setStatus("locked");
        setSource(data);
        setStatus("ready");
      })
      .catch(() => live && setStatus("locked"));
    return () => {
      live = false;
    };
  }, [initial, slug]);

  const agentBrief = source
    ? `Add the "${name}" component from Design for AI to this project.\n\n## Install\n${installText}\n\n## Design brief\n${source.prompt.trim()}\n\n## Source (${fileName})\n\`\`\`tsx\n${source.code.trim()}\n\`\`\`\n`
    : "";

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#0a0a0b] text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div role="tablist" aria-label="Component source" className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`relative shrink-0 px-3.5 pb-3 pt-2.5 text-[13px] font-medium transition-colors ${tab === t.key ? "text-site-fg" : "text-site-fg-3 hover:text-site-fg-2"}`}
            >
              {t.label}
              {tab === t.key && <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-[#ffb38a] via-[#ff7a45] to-[#ff4d6d] shadow-[0_0_12px_#ff7a45]" />}
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

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="relative">
        {tab === "install" ? (
          <Scroll html={installHtml} />
        ) : status === "loading" ? (
          <div className="flex h-64 items-center justify-center">
            <span className="size-5 animate-spin rounded-full border-2 border-white/10 border-t-white/50" aria-label="Loading source" />
          </div>
        ) : status === "locked" || !source ? (
          <Locked name={name} tab={tab} />
        ) : tab === "code" ? (
          <Scroll html={source.codeHtml} />
        ) : tab === "json" ? (
          <Scroll html={source.promptJsonHtml} />
        ) : (
          <div className="max-h-[560px] overflow-auto px-4 pb-6 pt-3 sm:px-5">
            <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.75] text-site-fg-2">{source.prompt}</pre>
          </div>
        )}
      </div>
      {tier === "pro" && status === "ready" && (
        <p className="border-t border-white/[0.06] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-site-glow/80">Pro licence active</p>
      )}
    </div>
  );
}

function Scroll({ html }: { html: string }) {
  return (
    <div
      className="max-h-[560px] overflow-auto px-4 pb-6 pt-3 font-mono text-[13px] leading-[1.7] sm:px-5 [&_pre]:!bg-transparent [&_pre]:outline-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

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
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#0a0a0b]/40 via-[#0a0a0b]/85 to-[#0a0a0b] p-6">
        <div className="max-w-sm text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-gradient-to-b from-[#ffb38a] to-[#ff6a3d] text-black shadow-[0_0_30px_-4px_#ff7a45]">
            <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
              <rect x="4" y="9" width="12" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <p className="mt-5 text-xl font-semibold tracking-[-0.03em]">
            The {tab === "code" ? "code" : tab === "json" ? "JSON prompt" : "prompt"} for {name} is Pro
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-site-fg-2">
            One licence unlocks every Pro component, its prompts and the private registry, for good. Every new component is included too.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/pricing" className="inline-flex h-10 items-center rounded-full bg-white px-5 text-[14px] font-medium text-black">
              Get Pro
            </Link>
            <Link href="/account" className="inline-flex h-10 items-center rounded-full border border-white/12 px-5 text-[14px] font-medium">
              I have a licence
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
