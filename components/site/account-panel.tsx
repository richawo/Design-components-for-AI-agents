"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CopyButton } from "./copy-button";
import { planById } from "@/lib/pricing";

type Licence = { id: string; plan: string; seats: number; status: string; expiresAt: number | null; owner: boolean; active: boolean; token: string | null; members: { email: string; invitation_sent_at: number | null }[] };
type Account = { user: { email: string }; hasBilling: boolean; licences: Licence[] };
type State = { status: "loading" | "signed-out" } | { status: "signed-in"; account: Account } | { status: "key"; email: string; licence: Licence };
const names: Record<string, string> = { "pro-yearly": "Pro yearly", "pro-lifetime": "Pro lifetime", "team-yearly": "Team yearly", "team-lifetime": "Team lifetime" };
const field = "w-full rounded-xl border border-white/[0.12] bg-site-bg px-4 py-3 text-[15px] text-site-fg outline-none transition-colors placeholder:text-site-fg-3 focus:border-site-accent";

async function post(path: string, body: unknown = {}, method = "POST") {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Couldn't complete that request. Please try again.");
  return data;
}

export function AccountPanel({ welcome, pending, plan }: { welcome: boolean; pending: boolean; plan?: string }) {
  const selected = plan ? planById(plan) : undefined;
  const [state, setState] = useState<State>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (response.ok) {
      const account = await response.json();
      if (account.user) { setState({ status: "signed-in", account }); return; }
    } else if (response.status !== 401) {
      const data = await response.json();
      throw new Error(data.error || "Couldn't load your account. Please try again.");
    }
    const legacy = await fetch("/api/license/me", { cache: "no-store" });
    if (!legacy.ok) throw new Error("Couldn't check your licence. Please try again.");
    const result = await legacy.json();
    if (result.active) {
      setState({ status: "key", email: result.license.email, licence: { id: result.license.id, plan: result.license.plan, seats: result.license.seats,
        status: "active", expiresAt: result.license.exp, owner: false, active: true, token: result.token, members: [] } });
    } else setState({ status: "signed-out" });
  }, []);

  useEffect(() => { load().catch((e) => { setState({ status: "signed-out" }); setError(e.message); }); }, [load]);
  useEffect(() => {
    if (!codeSent) return;
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [codeSent]);
  const awaiting = (welcome || pending) && state.status === "signed-in" && !state.account.licences.some((l) => l.active);
  useEffect(() => {
    if (!awaiting) return;
    // Payment events may arrive after Stripe redirects. Refresh for one minute, then offer a manual retry.
    let attempts = 0;
    const interval = setInterval(() => { if (++attempts >= 20) clearInterval(interval); load().catch(() => {}); }, 3000);
    return () => clearInterval(interval);
  }, [awaiting, load]);

  async function action(id: string, fn: () => Promise<void>) {
    setBusy(id); setError(null); setNotice(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(null); }
  }
  async function checkout() {
    if (!selected) return;
    const data = await post("/api/checkout", { plan: selected.id });
    if (data.url) window.location.assign(data.url);
  }
  async function requestCode() {
    await post("/api/auth/request", { email });
    setCodeSent(true); setResendAt(Date.now() + 30_000); setClock(Date.now()); setCode("");
    setNotice("A six-digit code has been sent to your email. It expires in 15 minutes.");
  }
  async function signin(e: FormEvent) {
    e.preventDefault();
    await action("signin", async () => {
      if (!codeSent) { await requestCode(); return; }
      await post("/api/auth/verify", { email, code });
      setCode(""); await load();
    });
  }
  async function logout() {
    await action("logout", async () => {
      await post("/api/auth/logout"); setState({ status: "signed-out" }); setCodeSent(false); setCode(""); setEmail("");
    });
  }
  async function activate(e: FormEvent) {
    e.preventDefault();
    await action("activate", async () => {
      const response = await fetch("/api/license/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: key.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (data.reason === "expired" ? "That key has expired. Sign in with your purchase email to check your licence." : "That key is invalid or no longer active. Check you copied the whole key."));
      setKey(""); await load();
    });
  }

  const licences = state.status === "signed-in" ? state.account.licences : state.status === "key" ? [state.licence] : [];
  const signedIn = state.status === "signed-in";
  const identified = signedIn || state.status === "key";
  const resendSeconds = Math.max(0, Math.ceil((resendAt - clock) / 1000));

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-xl border border-site-danger/30 bg-site-danger/10 px-5 py-4 text-sm text-site-danger">{error}</p>}
      {notice && <p role="status" className="text-sm leading-relaxed text-site-fg-2">{notice}</p>}
      {state.status === "loading" ? (
        <div className="site-surface h-72 rounded-[24px] p-8" aria-busy="true" aria-label="Loading your account"><div className="h-6 w-3/5 rounded bg-white/[0.05]" /><div className="mt-5 h-3 w-4/5 rounded bg-white/[0.04]" /></div>
      ) : (
        <>
          {!signedIn && <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
            <form onSubmit={signin} className="site-surface site-in rounded-[24px] p-7 sm:p-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">Your account</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{codeSent ? "Check your inbox." : "Sign in with your email."}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-site-fg-2">{codeSent ? `Enter the code sent to ${email}.` : "Use the email address you bought with to recover your licence and manage billing. New here? This also creates your account."}</p>
              {!codeSent ? <div className="mt-6"><label htmlFor="account-email" className="mb-2 block text-sm text-site-fg-2">Email address</label><input id="account-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={field} /></div>
                : <div className="mt-6"><label htmlFor="account-code" className="mb-2 block text-sm text-site-fg-2">Six-digit code</label><input id="account-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoFocus required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${field} font-mono text-2xl tracking-[0.4em]`} /></div>}
              <button type="submit" disabled={busy !== null} aria-busy={busy === "signin"} className="site-btn site-btn-accent mt-5 h-11 w-full px-6 text-[14px]">{busy === "signin" ? "Please wait…" : codeSent ? "Sign in" : "Send sign-in code"}</button>
              {codeSent && <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm"><button type="button" disabled={busy !== null || resendSeconds > 0} onClick={() => action("resend", requestCode)} className="text-site-fg-2 underline decoration-white/20 underline-offset-4 disabled:opacity-40">{resendSeconds ? `Resend in ${resendSeconds}s` : "Resend code"}</button><button type="button" disabled={busy !== null} onClick={() => { setCodeSent(false); setCode(""); setNotice(null); }} className="text-site-fg-2 underline decoration-white/20 underline-offset-4">Use another email</button></div>}
            </form>
            <div className="site-surface site-in rounded-[24px] p-7 sm:p-8">
              <h2 className="text-2xl font-semibold tracking-[-0.035em]">{selected ? names[selected.id] : "Keep your library close."}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-site-fg-2">{selected ? `$${selected.price} USD ${selected.cadence === "year" ? "per year, renewed annually" : "once, with lifetime access"}. ${selected.seats === 1 ? "One person" : "Up to 10 people"}. Sign in, then continue to secure checkout.` : "Your licence follows your account across devices. Sign in to copy your key, connect your coding agents, or manage a Team licence."}</p>
              <Link href="/pricing" className="site-btn site-btn-secondary mt-6 h-10 px-5 text-sm">{selected ? "Change plan" : "Explore Pro"}</Link>
              <details className="mt-8 border-t border-white/[0.08] pt-5"><summary className="cursor-pointer text-sm text-site-fg-2">Have an existing licence key?</summary><form onSubmit={activate} className="mt-4"><label htmlFor="licence-key" className="mb-2 block text-sm text-site-fg-2">Licence key</label><textarea id="licence-key" rows={3} spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder="dfa_…" className={`${field} resize-none break-all font-mono text-[12px]`} /><button type="submit" disabled={busy !== null || !key.trim()} className="site-btn site-btn-primary mt-3 h-10 px-5 text-sm">{busy === "activate" ? "Checking…" : "Activate key"}</button></form></details>
            </div>
          </div>}

          {identified && <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5"><p className="break-all text-[15px] text-site-fg-2">{state.status === "signed-in" ? state.account.user.email : state.status === "key" ? state.email : ""}</p><div className="flex flex-wrap gap-3">{state.status === "signed-in" && state.account.hasBilling && <button type="button" disabled={busy !== null} onClick={() => action("portal", async () => { const data = await post("/api/billing/portal"); window.location.assign(data.url); })} className="site-btn site-btn-secondary h-10 px-4 text-sm">{busy === "portal" ? "Opening…" : "Manage billing"}</button>}<button type="button" disabled={busy !== null} onClick={logout} className="site-btn site-btn-secondary h-10 px-4 text-sm">Sign out</button></div></div>}

          {awaiting && <div className="site-surface rounded-[24px] p-7"><h2 className="text-xl font-semibold">Your payment is being confirmed.</h2><p className="mt-2 text-sm leading-relaxed text-site-fg-2">Your licence will appear here after payment clears. You can also return from the email we send when it is ready.</p><button type="button" disabled={busy !== null} onClick={() => action("refresh", load)} className="site-btn site-btn-secondary mt-4 h-10 px-4 text-sm">Refresh account</button></div>}
          {signedIn && !awaiting && !licences.some((l) => l.active) && <div className="site-surface rounded-[24px] p-7 sm:p-8"><h2 className="text-2xl font-semibold tracking-[-0.035em]">{selected ? `Continue with ${names[selected.id]}.` : "Your account is ready."}</h2><p className="mt-3 text-[15px] leading-relaxed text-site-fg-2">{selected ? `$${selected.price} USD ${selected.cadence === "year" ? "per year" : "once"}. Your licence will be linked to this email address.` : "Choose Pro to unlock the full library, prompts and private registry. Team invitations appear here when you sign in with the invited email."}</p>{selected ? <button disabled={busy !== null} onClick={() => action("checkout", checkout)} className="site-btn site-btn-accent mt-5 h-11 px-6 text-sm">{busy === "checkout" ? "Opening checkout…" : "Continue to checkout"}</button> : <Link href="/pricing" className="site-btn site-btn-accent mt-5 h-11 px-6 text-sm">Choose a plan</Link>}</div>}
          {welcome && licences.some((l) => l.active) && <p role="status" className="text-lg text-site-fg">Your library is ready. Copy your key below to connect your agents.</p>}
          {licences.map((licence) => <div key={licence.id} className="site-surface site-in min-w-0 rounded-[24px] p-7 sm:p-8">
            <div className="flex flex-wrap justify-between gap-4"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">{licence.owner ? "Your licence" : "Library access"}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{names[licence.plan] || licence.plan}</h2><p className="mt-2 text-[15px] text-site-fg-2">{licence.active ? licence.expiresAt ? `Access through ${new Date(licence.expiresAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : "Lifetime access" : licence.status === "past_due" ? "Payment needs attention. Open billing to update your payment method." : licence.status === "refunded" ? "This payment was refunded." : licence.status === "disputed" ? "Access is suspended while the payment dispute is reviewed." : "This licence is no longer active."}</p></div></div>
            {licence.token && <LicenceKey token={licence.token} />}
            {licence.owner && licence.seats > 1 && <TeamSeats licence={licence} busy={busy} action={action} reload={load} />}
          </div>)}
          {licences.some((l) => l.active) && <div className="grid gap-6 md:grid-cols-3">{[
            { title: "CLI", code: "npx design-for-ai login <your key>", text: "Then add any Pro component with npx design-for-ai add <slug>." },
            { title: "MCP server", code: "claude mcp add --transport http design-for-ai https://design.yaps.ai/mcp --header \"Authorization: Bearer $DESIGN_FOR_AI_LICENSE\"", text: "Use the same URL and authorization header in Cursor or Windsurf." },
            { title: "shadcn", code: "npx shadcn@latest add @design-for-ai-pro/<slug>", text: "Add the Pro registry to components.json first. The installation guide has the full example." },
          ].map((item) => <div key={item.title} className="site-surface min-w-0 rounded-[20px] p-5"><h3 className="font-mono text-xs uppercase tracking-[0.14em] text-site-fg-3">{item.title}</h3><p className="mt-3 overflow-x-auto rounded-xl bg-white/[0.04] p-3 font-mono text-[12px] leading-relaxed">{item.code}</p><p className="mt-3 text-sm leading-relaxed text-site-fg-2">{item.text}</p></div>)}</div>}
          {identified && <Link href="/docs/installation" className="inline-block text-sm text-site-fg-2 underline decoration-white/20 underline-offset-4">Read the installation guide</Link>}
        </>
      )}
    </div>
  );
}

function LicenceKey({ token }: { token: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="mt-6 min-w-0 rounded-2xl border border-white/[0.08] bg-site-bg/60 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-2">Your licence key</p><div className="flex items-center gap-4"><button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible} className="text-xs text-site-fg-2 underline decoration-white/20 underline-offset-4">{visible ? "Hide key" : "Show key"}</button><CopyButton text={token} label="Copy key" /></div></div><p className="mt-3 break-all font-mono text-[12px] leading-relaxed text-site-fg-2">{visible ? token : "dfa_••••••••••••••••••••••••"}</p><p className="mt-3 text-xs text-site-fg-3">Keep this key private. Each Team member signs in to get their own.</p></div>;
}

function TeamSeats({ licence, busy, action, reload }: { licence: Licence; busy: string | null; action: (id: string, fn: () => Promise<void>) => Promise<void>; reload: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  async function invite(e: FormEvent) {
    e.preventDefault();
    await action("invite", async () => { try { await post("/api/account/team", { licenceId: licence.id, email }); setEmail(""); } finally { await reload(); } });
  }
  return <div className="mt-7 border-t border-white/[0.08] pt-6"><h3 className="text-xl font-semibold tracking-[-0.025em]">Team seats</h3><p className="mt-2 text-sm text-site-fg-2">{licence.members.length + 1} of {licence.seats} seats in use, including your owner seat. Members receive an email invitation and sign in to get a personal key.</p>
    {licence.members.length > 0 && <ul className="mt-4 divide-y divide-white/[0.07]">{licence.members.map((member) => <li key={member.email} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-all text-sm text-site-fg-2">{member.email}</p>{!member.invitation_sent_at && <p className="mt-1 text-xs text-site-fg-3">Invitation email needs to be sent.</p>}</div><div className="flex gap-4">{!member.invitation_sent_at && licence.active && <button disabled={busy !== null} onClick={() => action("invite", async () => { await post("/api/account/team", { licenceId: licence.id, email: member.email }); await reload(); })} className="text-sm text-site-fg-2 underline underline-offset-4">Send invitation</button>}<button disabled={busy !== null} onClick={() => action("remove", async () => { await post("/api/account/team", { licenceId: licence.id, email: member.email }, "DELETE"); await reload(); })} className="text-sm text-site-fg-2 underline underline-offset-4">Remove</button></div></li>)}</ul>}
    {licence.active && licence.members.length < licence.seats - 1 && <form onSubmit={invite} className="mt-5"><label htmlFor={`invite-${licence.id}`} className="mb-2 block text-sm text-site-fg-2">Invite by email</label><div className="flex flex-col gap-3 sm:flex-row"><input id={`invite-${licence.id}`} type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" className={`${field} min-w-0 flex-1`} /><button type="submit" disabled={busy !== null} className="site-btn site-btn-primary h-12 shrink-0 px-6 text-sm">{busy === "invite" ? "Sending…" : "Invite member"}</button></div></form>}
  </div>;
}
