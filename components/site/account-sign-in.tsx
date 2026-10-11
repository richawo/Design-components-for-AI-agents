"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, Mail } from "lucide-react";
import { accountPost, AccountRequestError, codeDigits, pasteCode } from "@/lib/account-client";

/**
 * Site adaptation of the auth-otp and auth-magic-link briefs retrieved through MCP.
 * One native field keeps autofill, paste and keyboard selection intact. Six visual
 * cells make progress legible. Verification never waits for decorative animation.
 */
export function AccountSignIn({ onSignedIn, onBusyChange }: { onSignedIn: () => Promise<void>; onBusyChange: (busy: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [verified, setVerified] = useState(false);
  const running = useRef(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const returned = useRef(false);

  useEffect(() => {
    if (sent) codeInput.current?.focus();
    else if (returned.current) { emailInput.current?.focus(); emailInput.current?.select(); }
  }, [sent]);

  useEffect(() => {
    if (!resendAt) return;
    const tick = () => setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(() => { tick(); if (Date.now() >= resendAt) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  async function run(kind: "send" | "verify", task: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(kind); onBusyChange(true); setError(null); setNotice("");
    try { await task(); }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : "Please try again.");
      if (kind === "verify" && reason instanceof AccountRequestError && reason.status === 401) {
        setCode(""); setActive(0);
      }
      if (kind === "verify") codeInput.current?.focus();
    } finally { running.current = false; setBusy(null); onBusyChange(false); }
  }

  async function send() {
    await run("send", async () => {
      const address = email.trim();
      await accountPost("/api/auth/request", { email: address });
      setEmail(address); setSent(true); setCode(""); setActive(0);
      setSeconds(30); setResendAt(Date.now() + 30_000);
      setNotice("Code sent. Check your inbox and spam folder.");
      codeInput.current?.focus();
    });
  }

  async function verify(value: string) {
    if (!verified && value.length !== 6) return;
    await run("verify", async () => {
      if (!verified) {
        await accountPost("/api/auth/verify", { email, code: value });
        // Account loading can be retried without consuming the same code twice.
        setVerified(true);
      }
      await onSignedIn();
    });
  }

  function changeCode(value: string) {
    const digits = codeDigits(value);
    setCode(digits); setActive(Math.min(digits.length, 5)); setError(null); setNotice("");
    if (digits.length === 6) void verify(digits);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (sent) void verify(code); else void send();
  }

  return (
    <form onSubmit={submit} className="site-surface site-in min-w-0 rounded-[24px] p-6 sm:p-8" aria-label="Sign in to your account">
      <div className="flex items-center justify-between gap-4">
        <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]" aria-hidden="true">{verified ? <Check className="size-5 text-site-ok" /> : <Mail className="size-5" />}</span>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-site-fg-3">{sent ? "02 / Verify" : "01 / Your email"}</p>
      </div>
      <div key={sent ? "code" : "email"} className="site-rise">
        <h2 className="mt-6 text-[28px] font-semibold leading-tight tracking-[-0.04em]">{verified ? "You're signed in." : sent ? "Check your inbox." : "Welcome to your library."}</h2>
        <p id="signin-description" className="mt-3 text-[15px] leading-relaxed text-site-fg-2">
          {verified ? "Your email is verified. Open your account to continue." : sent ? <>We sent a six-digit code to<span className="mt-1 block break-words font-medium text-site-fg">{email}</span></> : "Enter your email to access your licence and connect your agents. No password to remember."}
        </p>
        {!sent ? <div className="mt-7">
          <label htmlFor="account-email" className="mb-2 block text-sm text-site-fg-2">Email address</label>
          <input ref={emailInput} id="account-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required readOnly={!!busy} value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="you@example.com" aria-describedby="signin-description signin-feedback" className="h-12 w-full rounded-xl border border-white/15 bg-site-bg px-4 text-base outline-none transition-colors placeholder:text-site-fg-3 focus:border-site-accent" />
        </div> : !verified && <div className="mt-7">
          <label htmlFor="account-code" className="mb-3 block text-sm text-site-fg-2">Six-digit code</label>
          <div className="relative">
            <div aria-hidden="true" className="pointer-events-none grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }, (_, index) => <span key={index} className={`flex h-14 min-w-0 items-center justify-center rounded-xl border bg-white/[0.025] font-mono text-2xl tabular-nums transition-colors duration-150 ${error ? "border-site-danger/60" : focused && active === index ? "border-site-accent ring-2 ring-site-accent/15" : code[index] ? "border-white/25" : "border-white/10"}`}>
                {code[index] || (focused && active === index ? <span className="h-5 w-px bg-site-accent" /> : <span className="size-1 rounded-full bg-white/20" />)}
              </span>)}
            </div>
            <input ref={codeInput} id="account-code" name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required readOnly={!!busy} value={code} aria-invalid={!!error || undefined} aria-describedby="signin-description signin-feedback" onChange={(e) => changeCode(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onSelect={(e) => setActive(Math.min(e.currentTarget.selectionStart ?? code.length, 5))}
              onPointerDown={(e) => {
                if (busy) return;
                e.preventDefault();
                const field = e.currentTarget;
                const index = Math.min(code.length, 5, Math.max(0, Math.floor((e.clientX - field.getBoundingClientRect().left) / (field.clientWidth / 6))));
                field.focus(); field.setSelectionRange(index, index < code.length ? index + 1 : index); setActive(index);
              }}
              onPaste={(e) => { e.preventDefault(); changeCode(pasteCode(code, e.clipboardData.getData("text"), e.currentTarget.selectionStart ?? 0, e.currentTarget.selectionEnd ?? 0)); }}
              className="absolute inset-0 h-full w-full rounded-xl bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent focus-visible:!outline-none" />
          </div>
        </div>}
      </div>
      <div id="signin-feedback" className="mt-3 min-h-12 text-[13px] leading-relaxed">
        {error ? <p role="alert" className="text-site-danger">{error}</p> : <p role="status" className="text-site-fg-3">{busy === "verify" ? "Checking your code…" : notice || (sent ? "Paste the whole code. We'll check it automatically." : "New here? We'll create your account with the same email.")}</p>}
      </div>
      <button type="submit" disabled={!!busy || (sent && !verified && code.length !== 6)} aria-busy={!!busy} className="site-btn site-btn-primary mt-2 h-12 w-full px-5 text-sm">
        {busy ? <span aria-hidden="true" className="size-4 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" /> : null}
        {busy === "send" ? "Sending code…" : busy === "verify" ? "Signing in…" : verified ? "Open your account" : sent ? "Verify and sign in" : "Continue with email"}
        {!busy && <ArrowRight aria-hidden="true" className="size-4" />}
      </button>
      {sent && !verified && <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 border-t border-white/10 pt-3 text-[13px]">
        <button type="button" disabled={!!busy} onClick={() => { returned.current = true; setSent(false); setCode(""); setError(null); setNotice(""); }} className="min-h-11 text-site-fg-2 transition-colors hover:text-site-fg disabled:opacity-40">Change email</button>
        <button type="button" disabled={!!busy || seconds > 0} onClick={() => void send()} className="min-h-11 text-site-fg transition-colors disabled:opacity-40"><span className="tabular-nums">{seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}</span></button>
      </div>}
      {sent && <p className="mt-3 text-[13px] leading-relaxed text-site-fg-3">Codes expire after 15 minutes. Only your newest code will work.</p>}
    </form>
  );
}
