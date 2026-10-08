"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CopyButton } from "./copy-button";

type License = { email: string; plan: string; seats: number; exp: number | null; id: string };
type State = { status: "loading" } | { status: "none" } | { status: "active"; license: License; token: string };

const PLAN_NAMES: Record<string, string> = {
  "pro-yearly": "Pro · yearly",
  "pro-lifetime": "Pro · lifetime",
  "team-yearly": "Team · yearly",
  "team-lifetime": "Team · lifetime",
};

export function AccountPanel({ welcome }: { welcome: boolean }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/license/me", { cache: "no-store" });
    const j = await r.json();
    setState(j.active ? { status: "active", license: j.license, token: j.token } : { status: "none" });
  }

  useEffect(() => {
    load().catch(() => setState({ status: "none" }));
  }, []);

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/license/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: key.trim() }) });
      if (r.ok) {
        setKey("");
        await load();
      } else {
        const j = await r.json().catch(() => ({}));
        setError(j.reason === "expired" ? "That licence has expired. Renew from the pricing page to get a fresh key." : "That doesn't look like a valid licence key. Check you copied all of it.");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/license/logout", { method: "POST" });
    setState({ status: "none" });
  }

  if (state.status === "loading") {
    return <div className="h-72 animate-pulse rounded-[28px] bg-white/[0.04]" />;
  }

  if (state.status === "none") {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={activate} className="rounded-[28px] border border-white/[0.08] bg-[#0a0a0b] p-7 sm:p-8">
          <h2 className="text-2xl font-bold tracking-[-0.03em]">Activate a licence on this device</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-site-fg-2">Paste the key from your account page on the device you bought on. It starts with <code className="rounded bg-white/[0.04] px-1.5 font-mono text-[13px]">dfa_</code>.</p>
          <label htmlFor="licence" className="sr-only">
            Licence key
          </label>
          <textarea
            id="licence"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder="dfa_eyJ2IjoxLCJpZCI6…"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "licence-error" : undefined}
            className={`mt-5 w-full resize-none rounded-2xl border bg-black px-4 py-3 font-mono text-[13px] outline-none transition duration-200 placeholder:text-site-fg-3 hover:border-white/[0.14] focus:border-white/20 focus:shadow-[0_0_0_4px_rgba(255,122,69,0.12)] ${error ? "border-[#ff7a45]/50" : "border-white/[0.08]"}`}
          />
          {error && (
            <p id="licence-error" role="alert" className="site-rise mt-2 text-sm text-[#ff9a7a]">
              {error}
            </p>
          )}
          <button type="submit" disabled={!key.trim() || busy} aria-busy={busy} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[14px] font-medium text-black transition duration-200 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_14px_36px_-10px_rgba(255,179,138,0.6)] active:translate-y-0 active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-40">
            {busy && <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent opacity-70" />}
            {busy ? "Checking…" : "Activate"}
          </button>
        </form>
        <div className="site-surface flex flex-col justify-between rounded-[24px] p-7 sm:p-8">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.03em]">No licence yet?</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-site-fg-2">Pro unlocks every component, the Pro prompts and the private registry. Pay once and keep it forever.</p>
          </div>
          <Link href="/pricing" className="mt-8 inline-flex h-12 w-fit items-center rounded-full bg-white px-6 font-semibold text-black transition duration-200 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_14px_36px_-10px_rgba(255,179,138,0.6)] active:translate-y-0 active:scale-[0.97] active:duration-75">
            See pricing
          </Link>
        </div>
      </div>
    );
  }

  const { license, token } = state;
  return (
    <div className="space-y-6">
      {welcome && (
        <div className="rounded-[28px] bg-[linear-gradient(135deg,rgba(255,122,69,0.18),rgba(255,77,109,0.08))] ring-1 ring-inset ring-white/10 p-7 sm:p-8">
          <p className="text-3xl font-semibold tracking-[-0.04em]">You have taste. Officially.</p>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-site-fg-2">Your Pro licence is active on this device. Your key is below; keep it somewhere safe and give it to your agents.</p>
        </div>
      )}
      <div className="rounded-[28px] border border-white/[0.08] bg-[#0a0a0b] p-7 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">Licence</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{PLAN_NAMES[license.plan] ?? license.plan}</p>
            <p className="mt-1 text-[15px] text-site-fg-2">
              {license.email || "No email on file"} · {license.seats} {license.seats === 1 ? "seat" : "seats"} ·{" "}
              {license.exp ? `renews ${new Date(license.exp * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : "never expires"}
            </p>
          </div>
          <button onClick={logout} className="h-10 rounded-full border border-white/[0.08] px-4 text-sm font-semibold transition duration-200 hover:border-white/20 hover:bg-white/[0.04] active:scale-[0.97] active:duration-75">
            Sign out of this device
          </button>
        </div>
        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-2">Your licence key</p>
            <CopyButton text={token} label="Copy key" />
          </div>
          <p className="mt-3 break-all font-mono text-[12px] leading-relaxed text-site-fg-2">{token}</p>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {[
          { t: "Environment", c: `export DESIGN_FOR_AI_LICENSE="${token.slice(0, 18)}…"`, d: "The MCP server, shadcn registry and API read this variable." },
          { t: "MCP server", c: "npx -y design-for-ai-mcp", d: "Add it to Claude Code, Cursor or Windsurf. Pro tools unlock automatically." },
          { t: "shadcn", c: "npx shadcn@latest add @design-for-ai-pro/<slug>", d: "After adding the Pro registry to components.json (see Docs)." },
        ].map((x) => (
          <div key={x.t} className="rounded-[22px] border border-white/[0.08] bg-[#0a0a0b] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">{x.t}</p>
            <p className="mt-3 overflow-x-auto whitespace-nowrap rounded-xl bg-white/[0.04] px-3 py-2 font-mono text-[12px]">{x.c}</p>
            <p className="mt-3 text-sm leading-relaxed text-site-fg-2">{x.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
