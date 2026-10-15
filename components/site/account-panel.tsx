"use client";

import { SiteLink as Link } from "@/components/site/site-link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from "react";
import { AccountSignIn } from "./account-sign-in";
import { MeasuredHeight } from "./measured-height";
import { CopyButton } from "./copy-button";
import { planById } from "@/lib/pricing";

type Licence = { id: string; plan: string; seats: number; status: string; expiresAt: number | null; owner: boolean; active: boolean; token: string | null; members: { email: string; invitation_sent_at: number | null }[] };
type Account = { user: { email: string }; hasBilling: boolean; pendingCheckout: boolean; licences: Licence[] };
type State = { status: "loading" | "signed-out" | "unavailable" } | { status: "signed-in"; account: Account } | { status: "key"; email: string; licence: Licence };
const names: Record<string, string> = { "pro-yearly": "Pro yearly", "pro-lifetime": "Pro lifetime", "team-yearly": "Team yearly", "team-lifetime": "Team lifetime" };
const field = "w-full rounded-xl border border-white/[0.12] bg-site-bg px-4 py-3 text-base text-site-fg outline-none transition-colors placeholder:text-site-fg-3 focus:border-site-accent";

async function post(path: string, body: unknown = {}, method = "POST") {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Couldn't complete that request. Please try again.");
  return data;
}

export function AccountLoading() {
  return <div className="site-surface h-72 rounded-[24px] p-8" aria-busy="true" aria-label="Loading your account"><div className="h-6 w-3/5 rounded bg-white/[0.05]" /><div className="mt-5 h-3 w-4/5 rounded bg-white/[0.04]" /></div>;
}

export function AccountPanel({ welcome, pending, plan }: { welcome: boolean; pending: boolean; plan?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const running = useRef<string | null>(null);
  const actionFocus = useRef<HTMLElement | null>(null);
  const returnField = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const owner = actionFocus.current, doc = root.current?.ownerDocument;
    if (!owner || !doc?.hasFocus() || doc.activeElement !== doc.body || (owner.isConnected && !owner.matches(":disabled"))) return;
    const field = returnField.current;
    const target = field?.isConnected && !field.matches(":disabled") ? field : root.current?.querySelector<HTMLElement>("h2");
    if (target) { if (/^H[23]$/.test(target.tagName)) target.tabIndex = -1; target.focus(); }
    actionFocus.current = null;
  });
  useEffect(() => {
    const doc = root.current?.ownerDocument;
    if (!doc) return;
    const release = (event: Event) => {
      const owner = actionFocus.current;
      if (owner && event.target !== owner && !owner.contains(event.target as Node)) actionFocus.current = null;
    };
    doc.addEventListener("focusin", release, true);
    doc.addEventListener("pointerdown", release, true);
    return () => { doc.removeEventListener("focusin", release, true); doc.removeEventListener("pointerdown", release, true); };
  }, []);
  const selected = plan ? planById(plan) : undefined;
  const [state, setState] = useState<State>({ status: "loading" });
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [feedbackScope, setFeedbackScope] = useState("general");

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

  useEffect(() => { load().catch((e) => { setState({ status: "unavailable" }); setError(e.message); }); }, [load]);
  const awaiting = (welcome || pending) && state.status === "signed-in" && !state.account.licences.some((l) => l.active)
    && (state.account.pendingCheckout || state.account.licences.length === 0);
  useEffect(() => {
    if (!awaiting) return;
    // Payment events may arrive after Stripe redirects. Refresh for one minute, then offer a manual retry.
    let attempts = 0;
    const interval = setInterval(() => { if (++attempts >= 20) clearInterval(interval); load().catch(() => {}); }, 3000);
    return () => clearInterval(interval);
  }, [awaiting, load]);

  async function action(id: string, fn: () => Promise<void>, scope = id) {
    if (running.current || busy !== null) return;
    running.current = id;
    const owner = root.current?.ownerDocument.activeElement;
    actionFocus.current = owner instanceof HTMLElement && root.current?.contains(owner) ? owner : null;
    returnField.current = actionFocus.current?.closest("form")?.querySelector<HTMLElement>("input,textarea") ?? actionFocus.current?.closest("[data-account-action-scope]")?.querySelector<HTMLElement>("h3") ?? null;
    setBusy(id); setFeedbackScope(scope); setError(null); setNotice(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { running.current = null; setBusy(null); }
  }
  async function checkout() {
    if (!selected) return;
    const data = await post("/api/checkout", { plan: selected.id });
    if (data.url) window.location.assign(data.url);
  }
  async function logout() {
    await action("logout", async () => {
      await post("/api/auth/logout"); setState({ status: "signed-out" });
    }, "identity");
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

  function feedback(scope: string) {
    const content = feedbackScope === scope ? error || notice : null;
    return <MeasuredHeight><div className={content ? "pt-4 break-words text-sm leading-relaxed" : undefined}>
      {content && <p role={error ? "alert" : "status"} className={error ? "rounded-xl border border-site-danger/30 bg-site-danger/10 px-5 py-4 text-site-danger" : "text-site-fg-2"}>{content}</p>}
    </div></MeasuredHeight>;
  }

  const licences = state.status === "signed-in" ? state.account.licences : state.status === "key" ? [state.licence] : [];
  const signedIn = state.status === "signed-in";
  const identified = signedIn || state.status === "key";

  return (
    <div ref={root} className="space-y-6">
      {state.status === "loading" ? (
        <AccountLoading />
      ) : state.status === "unavailable" ? (
        <div className="site-surface rounded-[24px] p-7 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Your account couldn't load.</h2>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-site-fg-2">We couldn't check your session. Try again to see your licence and billing details.</p>
          <AccountActionButton busy={busy} actionId="refresh" type="button" onClick={() => action("refresh", load)} className="site-btn site-btn-primary mt-6 h-11 px-5 text-sm"><AccountActionLabel idle="Try again" pending="Loading…" busy={busy === "refresh"} /></AccountActionButton>{feedback("refresh")}{feedback("general")}
        </div>
      ) : (
        <>
          {!signedIn && <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-14">
            <AccountSignIn onSignedIn={async () => {
              const origin = root.current?.ownerDocument.activeElement;
              actionFocus.current = origin instanceof HTMLElement && origin.closest('form[aria-label="Sign in to your account"]') ? origin : null;
              returnField.current = null;
              await load();
            }} onBusyChange={(pending) => { setBusy(pending ? "signin" : null); if (pending) setError(null); }} />
            <div className="site-in min-w-0 px-1 py-3 lg:py-8">
              <h2 className="text-2xl font-semibold tracking-[-0.035em]">{selected ? names[selected.id] : "Make something worth shipping."}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-site-fg-2">{selected ? `$${selected.price} USD ${selected.cadence === "year" ? "per year, renewed annually" : "once, with lifetime access"}. ${selected.seats === 1 ? "One person" : "Up to 10 people"}. Sign in, then continue to secure checkout.` : "Your components, prompts and agent connections, together in one place. Sign in with your purchase email to pick up where you left off."}</p>
              <Link href="/pricing" className="site-btn site-btn-secondary mt-6 h-11 px-5 text-sm">{selected ? "Change plan" : "Explore Pro"}</Link>
              <details className="mt-8 border-t border-white/[0.08] pt-5"><summary className="min-h-11 cursor-pointer text-sm leading-[44px] text-site-fg-2">Or use an existing licence key</summary><form onSubmit={activate} className="mt-4"><label htmlFor="licence-key" className="mb-2 block text-sm text-site-fg-2">Licence key</label><textarea id="licence-key" rows={3} spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder="dfa_…" className={`${field} resize-none break-all font-mono text-base sm:text-[12px]`} /><AccountActionButton busy={busy} actionId="activate" type="submit" disabled={!key.trim()} className="site-btn site-btn-primary mt-3 h-11 px-5 text-sm"><AccountActionLabel idle="Activate key" pending="Checking…" busy={busy === "activate"} /></AccountActionButton></form>{feedback("activate")}</details>
            </div>
          </div>}

          {identified && <div><div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-5"><p className="break-all text-[15px] text-site-fg-2">{state.status === "signed-in" ? state.account.user.email : state.status === "key" ? state.email : ""}</p><div className="flex flex-wrap gap-3">{state.status === "signed-in" && state.account.hasBilling && <AccountActionButton busy={busy} actionId="portal" type="button" onClick={() => action("portal", async () => { const data = await post("/api/billing/portal"); window.location.assign(data.url); }, "identity")} className="site-btn site-btn-secondary h-11 px-4 text-sm"><AccountActionLabel idle="Manage billing" pending="Opening…" busy={busy === "portal"} /></AccountActionButton>}<AccountActionButton busy={busy} actionId="logout" type="button" onClick={logout} className="site-btn site-btn-secondary h-11 px-4 text-sm">Sign out</AccountActionButton></div></div>{feedback("identity")}</div>}

          {awaiting && <div className="site-surface rounded-[24px] p-7"><h2 className="text-xl font-semibold">Your payment is being confirmed.</h2><p className="mt-2 text-sm leading-relaxed text-site-fg-2">Your licence will appear here after payment clears. You can also return from the email we send when it is ready.</p><AccountActionButton busy={busy} actionId="refresh" type="button" onClick={() => action("refresh", load)} className="site-btn site-btn-secondary mt-4 h-11 px-4 text-sm">Refresh account</AccountActionButton>{feedback("refresh")}</div>}
          {signedIn && !awaiting && !licences.some((l) => l.active) && <div className="site-surface rounded-[24px] p-7 sm:p-8"><h2 className="text-2xl font-semibold tracking-[-0.035em]">{selected ? `Continue with ${names[selected.id]}.` : "Your account is ready."}</h2><p className="mt-3 text-[15px] leading-relaxed text-site-fg-2">{selected ? `$${selected.price} USD ${selected.cadence === "year" ? "per year" : "once"}. Your licence will be linked to this email address.` : "Choose Pro to unlock the full library, prompts and private registry. Team invitations appear here when you sign in with the invited email."}</p>{selected ? <AccountActionButton busy={busy} actionId="checkout" onClick={() => action("checkout", checkout)} className="site-btn site-btn-accent mt-5 h-11 px-6 text-sm"><AccountActionLabel idle="Continue to checkout" pending="Opening checkout…" busy={busy === "checkout"} /></AccountActionButton> : <Link href="/pricing" className="site-btn site-btn-accent mt-5 h-11 px-6 text-sm">Choose a plan</Link>}{feedback("checkout")}</div>}
          {welcome && licences.some((l) => l.active) && <p role="status" className="text-lg text-site-fg">Your library is ready. Copy your key below to connect your agents.</p>}
          {licences.map((licence) => <div key={licence.id} className="site-surface site-in min-w-0 rounded-[24px] p-7 sm:p-8">
            <div className="flex flex-wrap justify-between gap-4"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-site-fg-3">{licence.owner ? "Your licence" : "Library access"}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{names[licence.plan] || licence.plan}</h2><p className="mt-2 text-[15px] text-site-fg-2">{licence.active ? licence.expiresAt ? `Access through ${new Date(licence.expiresAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : "Lifetime access" : licence.status === "past_due" ? "Payment needs attention. Open billing to update your payment method." : licence.status === "refunded" ? "This payment was refunded." : licence.status === "disputed" ? "Access is suspended while the payment dispute is reviewed." : "This licence is no longer active."}</p></div></div>
            {licence.token && <LicenceKey token={licence.token} />}
            {licence.owner && licence.seats > 1 && <TeamSeats licence={licence} busy={busy?.startsWith(`team:${licence.id}:`) ? busy.slice(`team:${licence.id}:`.length) : busy === null ? null : "other"} action={(id, fn, slot = "form") => action(`team:${licence.id}:${id}`, fn, `team:${licence.id}:${slot}`)} reload={load} feedback={(slot) => feedback(`team:${licence.id}:${slot}`)} />}
          </div>)}
          {licences.some((l) => l.active) && <div className="grid gap-6 md:grid-cols-3">{[
            { title: "CLI", code: "npx https://design.yaps.ai/cli.tgz login <your key>", text: "Then add any Pro component with npx https://design.yaps.ai/cli.tgz add <slug>." },
            { title: "MCP server", code: "claude mcp add --transport http design-for-ai https://design.yaps.ai/mcp --header \"Authorization: Bearer $DESIGN_FOR_AI_LICENSE\"", text: "Use the same URL and authorization header in Cursor or Windsurf." },
            { title: "shadcn", code: "npx shadcn@latest add @design-for-ai-pro/<slug>", text: "Add the Pro registry to components.json first. The installation guide has the full example." },
          ].map((item) => <div key={item.title} className="site-surface min-w-0 rounded-[20px] p-5"><h3 className="font-mono text-xs uppercase tracking-[0.14em] text-site-fg-3">{item.title}</h3><p className="mt-3 overflow-x-auto rounded-xl bg-white/[0.04] p-3 font-mono text-[12px] leading-relaxed">{item.code}</p><p className="mt-3 text-sm leading-relaxed text-site-fg-2">{item.text}</p></div>)}</div>}
          {identified && <Link href="/docs/installation" className="inline-block text-sm text-site-fg-2 underline decoration-white/20 underline-offset-4">Read the installation guide</Link>}
        </>
      )}
    </div>
  );
}

/** Keep busy labels from moving adjacent account actions. */
function AccountActionLabel({ idle, pending, busy }: { idle: string; pending: string; busy: boolean }) {
  return <span className="grid">
    <span aria-hidden="true" className="invisible col-start-1 row-start-1">{idle}</span>
    <span aria-hidden="true" className="invisible col-start-1 row-start-1">{pending}</span>
    <span className="col-start-1 row-start-1">{busy ? pending : idle}</span>
  </span>;
}

/** Keep the owned pending action focusable while a synchronous guard prevents repeat requests. */
function AccountActionButton({ busy, actionId, disabled, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { busy: string | null; actionId: string }) {
  const pending = busy === actionId;
  return <button {...props} disabled={pending ? false : !!disabled || busy !== null} aria-disabled={pending || undefined} aria-busy={pending || undefined} className={`${className}${pending ? " cursor-wait opacity-60" : ""}`} />;
}

function LicenceKey({ token }: { token: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="mt-6 min-w-0 rounded-2xl border border-white/[0.08] bg-site-bg/60 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-2">Your licence key</p><div className="flex items-center gap-4"><button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible} className="min-h-11 text-xs text-site-fg-2 underline decoration-white/20 underline-offset-4">{visible ? "Hide key" : "Show key"}</button><CopyButton text={token} label="Copy key" /></div></div><p className="mt-3 break-all font-mono text-[12px] leading-relaxed text-site-fg-2">{visible ? token : "dfa_••••••••••••••••••••••••"}</p><p className="mt-3 text-xs text-site-fg-3">Keep this key private. Each Team member signs in to get their own.</p></div>;
}

function TeamSeats({ licence, busy, action, reload, feedback }: { licence: Licence; busy: string | null; action: (id: string, fn: () => Promise<void>, slot?: string) => Promise<void>; reload: () => Promise<void>; feedback: (slot: string) => ReactNode }) {
  const [email, setEmail] = useState("");
  async function invite(e: FormEvent) {
    e.preventDefault();
    await action("invite", async () => { try { await post("/api/account/team", { licenceId: licence.id, email }); setEmail(""); } finally { await reload(); } });
  }
  return <div data-account-action-scope="" className="mt-7 border-t border-white/[0.08] pt-6"><h3 className="text-xl font-semibold tracking-[-0.025em]">Team seats</h3><p className="mt-2 text-sm text-site-fg-2">{licence.members.length + 1} of {licence.seats} seats in use, including your owner seat. Members receive an email invitation and sign in to get a personal key.</p>
    {licence.members.length > 0 && <ul className="mt-4 divide-y divide-white/[0.07]">{licence.members.map((member) => <li key={member.email} className="py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm text-site-fg-2">{member.email}</p>{!member.invitation_sent_at && <p className="mt-1 text-xs text-site-fg-3">Invitation email needs to be sent.</p>}</div><div className="flex gap-4">{!member.invitation_sent_at && licence.active && <AccountActionButton busy={busy} actionId={`invite:${member.email}`} onClick={() => action(`invite:${member.email}`, async () => { await post("/api/account/team", { licenceId: licence.id, email: member.email }); await reload(); }, member.email)} className="min-h-11 text-sm text-site-fg-2 underline underline-offset-4">Send invitation</AccountActionButton>}<AccountActionButton busy={busy} actionId={`remove:${member.email}`} onClick={() => action(`remove:${member.email}`, async () => { await post("/api/account/team", { licenceId: licence.id, email: member.email }, "DELETE"); await reload(); }, member.email)} className="min-h-11 text-sm text-site-fg-2 underline underline-offset-4">Remove</AccountActionButton></div></div>{feedback(member.email)}</li>)}</ul>}
    {licence.active && licence.members.length < licence.seats - 1 && <form onSubmit={invite} className="mt-5"><label htmlFor={`invite-${licence.id}`} className="mb-2 block text-sm text-site-fg-2">Invite by email</label><div className="flex flex-col gap-3 sm:flex-row"><input id={`invite-${licence.id}`} type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" className={`${field} min-w-0 flex-1`} /><AccountActionButton busy={busy} actionId="invite" type="submit" className="site-btn site-btn-primary h-12 shrink-0 px-6 text-sm"><AccountActionLabel idle="Invite member" pending="Sending…" busy={busy === "invite"} /></AccountActionButton></div>{feedback("form")}</form>}
  </div>;
}
