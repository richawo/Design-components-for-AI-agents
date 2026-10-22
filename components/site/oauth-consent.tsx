"use client";
import { useSiteI18n } from "@/components/site/site-i18n";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, ShieldCheck } from "lucide-react";
import { accountPost } from "@/lib/account-client";
import { AccountSignIn } from "./account-sign-in";

/**
 * The browser half of MCP sign-in. The agent opened this page; the user signs
 * in with their email code if needed, then approves. The server re-validates
 * the whole request on approval, so nothing shown here is trusted.
 */
export function OAuthConsent({ query, client, destination, email, pro }: { query: string; client: string; destination: string; email: string | null; pro: boolean }) {
  const { localize } = useSiteI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "deny" | "switch" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function decide(approve: boolean) {
    if (busy) return;
    setBusy(approve ? "approve" : "deny"); setError(null);
    try {
      const { redirect } = await accountPost("/api/oauth/approve", { query, approve }) as { redirect: string };
      if (approve) setDone(true);
      window.location.assign(redirect);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
    } finally { setBusy(null); }
  }

  async function switchAccount() {
    setBusy("switch"); setError(null);
    try { await accountPost("/api/auth/logout", {}); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Please try again."); }
    finally { setBusy(null); }
  }

  return localize(<div>
    <p className="site-in font-mono text-[11px] uppercase tracking-[0.18em] text-site-fg-3">Connect your agent</p>
    <h1 className="site-in mt-4 text-[clamp(2rem,1.5rem+2.4vw,3.25rem)] font-semibold leading-[1] tracking-[-0.05em] [--i:1]">
      <span className="site-silver-text">Connect {client}</span> <span className="text-site-fg-3">to Design for AI.</span>
    </h1>
    {!email ? <>
      <p className="site-in mt-4 max-w-prose text-[15px] leading-relaxed text-site-fg-2 [--i:2]">Sign in with the email you used for Design for AI. There's no key to copy: your agent receives its own access, which you can remove from your account at any time.</p>
      <div className="mt-8"><AccountSignIn onSignedIn={async () => router.refresh()} onBusyChange={() => {}} /></div>
    </> : done ? <div className="site-surface site-in mt-8 rounded-[24px] p-7 sm:p-8">
      <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]" aria-hidden="true"><Check className="size-5 text-site-ok" /></span>
      <h2 className="mt-6 text-[26px] font-semibold leading-tight tracking-[-0.04em]">{client} is connected.</h2>
      <p role="status" className="mt-3 text-[15px] leading-relaxed text-site-fg-2">Return to your agent to continue. You can close this tab.</p>
    </div> : <div className="site-surface site-in mt-8 min-w-0 rounded-[24px] p-7 sm:p-8 [--i:2]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 break-words text-sm text-site-fg-2">Signed in as <span className="font-medium text-site-fg">{email}</span></p>
        <button type="button" disabled={!!busy} onClick={() => void switchAccount()} className="min-h-11 text-sm text-site-fg-2 underline decoration-white/20 underline-offset-4 hover:text-site-fg disabled:opacity-40">Use another email</button>
      </div>
      <div className={`mt-5 flex gap-3 rounded-2xl border p-4 ${pro ? "border-white/[0.1] bg-white/[0.03]" : "border-white/[0.08] bg-transparent"}`}>
        <KeyRound aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${pro ? "text-site-ok" : "text-site-fg-3"}`} />
        <p className="text-sm leading-relaxed text-site-fg-2">{pro ? "Your Pro licence is active. Your agent can install every Pro component." : "This account has no active Pro licence, so your agent will get the free components. If you upgrade later, this connection picks it up automatically."}</p>
      </div>
      <h2 className="mt-7 text-lg font-semibold tracking-[-0.02em]">{client} will be able to</h2>
      <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-site-fg-2">
        <li className="flex gap-3"><Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-site-fg-3" />Search the library and read design prompts and install commands</li>
        <li className="flex gap-3"><Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-site-fg-3" />Read the source of components your plan includes</li>
        <li className="flex gap-3"><ShieldCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-site-fg-3" />It can't see billing details or change your account</li>
      </ul>
      <p className="mt-6 border-t border-white/[0.08] pt-5 text-[13px] leading-relaxed text-site-fg-3">After you approve, you'll return to <span className="break-all text-site-fg-2">{destination}</span>. Only continue if you started this from your own agent.</p>
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" disabled={!!busy} onClick={() => void decide(false)} className="site-btn site-btn-secondary h-12 px-6 text-sm disabled:opacity-50">{busy === "deny" ? "Cancelling…" : "Cancel"}</button>
        <button type="button" disabled={!!busy} aria-busy={busy === "approve"} onClick={() => void decide(true)} className="site-btn site-btn-primary h-12 px-6 text-sm disabled:opacity-60">{busy === "approve" ? "Connecting…" : "Approve and connect"}</button>
      </div>
      <div className="min-h-6 pt-3 text-[13px]">{error && <p role="alert" className="text-site-danger">{error}</p>}</div>
    </div>}
  </div>);
}

export function OAuthProblem({ message }: { message: string }) {
  const { localize } = useSiteI18n();
  return localize(<div>
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-site-fg-3">Connect your agent</p>
    <h1 className="mt-4 text-[clamp(2rem,1.5rem+2.4vw,3.25rem)] font-semibold leading-[1] tracking-[-0.05em]"><span className="site-silver-text">We couldn't start sign-in.</span></h1>
    <p role="alert" className="mt-4 max-w-prose text-[15px] leading-relaxed text-site-fg-2">{message}</p>
    <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-site-fg-2">Nothing was shared. Start again from your agent, or read <a href="/docs/agents" className="text-site-fg underline decoration-white/20 underline-offset-4">the setup guide</a>.</p>
  </div>);
}
