"use client";

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Download, ImageUp, LoaderCircle, TriangleAlert } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type SettingsValues = {
  /** Object URL or data URL for the avatar, or null for initials. */
  avatar: string | null;
  name: string;
  username: string;
  bio: string;
  pronouns: string;
  timezone: string;
  mentions: boolean;
  replies: boolean;
  digest: boolean;
  product: boolean;
  frequency: "instant" | "hourly" | "daily";
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
  weekStart: "Monday" | "Sunday" | "Saturday";
};

export type SettingsPanelProps = {
  title?: string;
  description?: string;
  /** Shown before the username field, e.g. your app's domain. */
  usernamePrefix?: string;
  email?: string;
  initialValues?: Partial<SettingsValues>;
  pronounOptions?: string[];
  timezoneOptions?: string[];
  /** Called with the new values. Return a promise to show the saving state until it resolves. */
  onSave?: (values: SettingsValues) => Promise<void> | void;
  bioLimit?: number;
};

const DEFAULTS: SettingsValues = {
  avatar: null,
  name: "Mika Korhonen",
  username: "mika",
  bio: "Field researcher. I collect interview notes, bad puns and good coffee.",
  pronouns: "she/her",
  timezone: "Europe/Helsinki (GMT+3)",
  mentions: true,
  replies: true,
  digest: true,
  product: false,
  frequency: "hourly",
  theme: "dark",
  density: "comfortable",
  weekStart: "Monday",
};

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "appearance", label: "Appearance" },
  { id: "danger", label: "Danger zone" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const ease = [0.2, 0.8, 0.2, 1] as const;
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4f25c]";

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function SettingsPanel({
  title = "Settings",
  description = "How you appear to your team, and how much Fieldnote is allowed to interrupt you.",
  usernamePrefix = "fieldnote.app/",
  email = "mika@fieldnote.app",
  initialValues,
  pronounOptions = ["she/her", "he/him", "they/them", "Prefer not to say"],
  timezoneOptions = ["Europe/Helsinki (GMT+3)", "Europe/London (GMT+1)", "America/New_York (GMT−4)", "America/Los_Angeles (GMT−7)", "Asia/Tokyo (GMT+9)"],
  onSave,
  bioLimit = 160,
}: SettingsPanelProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [saved, setSaved] = useState<SettingsValues>(() => ({ ...DEFAULTS, ...initialValues }));
  const [values, setValues] = useState<SettingsValues>(saved);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [active, setActive] = useState<SectionId>("profile");

  const changed = useMemo(() => (Object.keys(values) as (keyof SettingsValues)[]).filter((k) => values[k] !== saved[k]), [values, saved]);
  const dirty = changed.length > 0;

  const set = <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) => {
    setStatus("idle");
    setValues((v) => ({ ...v, [key]: value }));
  };

  const save = async () => {
    if (!dirty || status === "saving") return;
    setStatus("saving");
    await (onSave ? onSave(values) : new Promise<void>((r) => setTimeout(r, 900)));
    setSaved(values);
    setStatus("saved");
  };

  const discard = () => {
    setValues(saved);
    setStatus("idle");
  };

  // ⌘S / Ctrl+S saves.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fade the "Saved" confirmation after a moment.
  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(() => setStatus("idle"), 2200);
    return () => clearTimeout(t);
  }, [status]);

  // Scroll-spy for the section nav.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(`${uid}-${s.id}`)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id.replace(`${uid}-`, "") as SectionId);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [uid]);

  const go = (id: SectionId) => {
    setActive(id);
    document.getElementById(`${uid}-${id}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const initials = values.name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-full bg-[#0e0e10] font-sans text-[#f2f2f0] antialiased [color-scheme:dark]">
      <div className="mx-auto max-w-[1120px] px-4 pb-10 pt-10 sm:px-8 sm:pt-14 lg:px-12 lg:pt-20">
        {/* Header */}
        <header className="max-w-[68ch]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#9a9aa2]">
            Fieldnote <span className="px-1.5 text-[#55555c]">/</span> {saved.name}
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.5rem,1.8rem+3vw,4.25rem)] font-semibold leading-[0.95] tracking-[-0.045em]">{title}</h1>
          <p className="mt-4 text-pretty text-[16px] leading-relaxed text-[#9a9aa2]">{description}</p>
        </header>

        <div className="mt-10 lg:mt-14 lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-14">
          {/* Section nav: sticky list on desktop, scrolling tabs on mobile */}
          <nav aria-label="Settings sections" className="sticky top-0 z-20 -mx-4 border-b border-[#232328] bg-[#0e0e10]/95 px-4 backdrop-blur-sm sm:-mx-8 sm:px-8 lg:top-10 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
            <ul className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible lg:py-0 [&::-webkit-scrollbar]:hidden">
              {SECTIONS.map((s) => {
                const on = active === s.id;
                return (
                  <li key={s.id} className="shrink-0">
                    <a
                      href={`#${uid}-${s.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        go(s.id);
                      }}
                      aria-current={on ? "true" : undefined}
                      className={`relative flex h-10 items-center rounded-lg px-3 text-[14px] transition-[color,background-color,border-color,box-shadow,transform] lg:h-9 duration-150 active:scale-[0.97] ${focusRing} ${
                        on ? "text-[#f2f2f0]" : "text-[#9a9aa2] hover:text-[#f2f2f0]"
                      } ${s.id === "danger" && !on ? "lg:text-[#ff8a7a]/80" : ""}`}
                    >
                      {on && (
                        <motion.span
                          layoutId={`${uid}-nav`}
                          className="absolute inset-0 rounded-lg bg-[#1d1d21] shadow-[inset_0_0_0_1px_#2a2a30]"
                          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                        />
                      )}
                      <span className="relative flex items-center gap-2.5">
                        <span className={`hidden h-3.5 w-[2px] rounded-full lg:block ${on ? "bg-[#d4f25c]" : "bg-transparent"}`} aria-hidden="true" />
                        {s.label}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-8 space-y-14 lg:mt-0">
            {/* Profile */}
            <Section id={`${uid}-profile`} title="Profile" hint="This is what teammates see next to your notes and comments.">
              <Row label="Photo" hint="Square, at least 256px. JPG, PNG or GIF.">
                <AvatarField value={values.avatar} initials={initials} onChange={(v) => set("avatar", v)} />
              </Row>
              <Row label="Display name" htmlFor={`${uid}-name`}>
                <input id={`${uid}-name`} value={values.name} onChange={(e) => set("name", e.target.value)} className={inputCls} autoComplete="name" />
              </Row>
              <Row label="Username" htmlFor={`${uid}-username`} hint="Lowercase letters, numbers and dashes.">
                <div className="flex h-11 items-center rounded-lg border border-[#2a2a30] bg-[#111113] transition-colors focus-within:border-[#d4f25c]/70 focus-within:ring-2 focus-within:ring-[#d4f25c]/15 hover:border-[#36363d]">
                  <span className="select-none pl-3.5 font-mono text-[13px] text-[#6e6e76]">{usernamePrefix}</span>
                  <input
                    id={`${uid}-username`}
                    value={values.username}
                    onChange={(e) => set("username", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="h-full min-w-0 flex-1 bg-transparent pr-3.5 font-mono text-[13px] text-[#f2f2f0] outline-none"
                    spellCheck={false}
                    autoComplete="username"
                  />
                </div>
              </Row>
              <Row label="Bio" htmlFor={`${uid}-bio`}>
                <textarea
                  id={`${uid}-bio`}
                  value={values.bio}
                  maxLength={bioLimit}
                  rows={3}
                  onChange={(e) => set("bio", e.target.value)}
                  className={`${inputCls} h-auto resize-none py-2.5 leading-relaxed`}
                  aria-describedby={`${uid}-bio-count`}
                />
                <p id={`${uid}-bio-count`} className={`mt-1.5 text-right font-mono text-[11px] tabular-nums ${values.bio.length > bioLimit - 15 ? "text-[#d4f25c]" : "text-[#6e6e76]"}`}>
                  {values.bio.length}/{bioLimit}
                </p>
              </Row>
              <Row label="Pronouns" htmlFor={`${uid}-pronouns`}>
                <Select id={`${uid}-pronouns`} value={values.pronouns} options={pronounOptions} onChange={(v) => set("pronouns", v)} />
              </Row>
              <Row label="Time zone" htmlFor={`${uid}-tz`} hint="Used for reminders and your weekly digest.">
                <Select id={`${uid}-tz`} value={values.timezone} options={timezoneOptions} onChange={(v) => set("timezone", v)} />
              </Row>
            </Section>

            {/* Notifications */}
            <Section id={`${uid}-notifications`} title="Notifications" hint={`Sent to ${email}. Fieldnote never emails you about emails.`}>
              <Row label="Mentions" hint="Someone @mentions you in a note or comment." inline>
                <Toggle checked={values.mentions} onChange={(v) => set("mentions", v)} label="Mentions" reduce={reduce} />
              </Row>
              <Row label="Replies to my comments" hint="Threads you started or joined." inline>
                <Toggle checked={values.replies} onChange={(v) => set("replies", v)} label="Replies to my comments" reduce={reduce} />
              </Row>
              <Row label="Weekly digest" hint="Monday morning: what changed in notes you follow." inline>
                <Toggle checked={values.digest} onChange={(v) => set("digest", v)} label="Weekly digest" reduce={reduce} />
              </Row>
              <Row label="Product news" hint="New features, about once a month. No “we miss you”." inline>
                <Toggle checked={values.product} onChange={(v) => set("product", v)} label="Product news" reduce={reduce} />
              </Row>
              <Row label="Delivery" hint="Batching keeps your inbox quieter.">
                <Segmented
                  label="Delivery"
                  value={values.frequency}
                  options={[
                    { value: "instant", label: "Instantly" },
                    { value: "hourly", label: "Hourly" },
                    { value: "daily", label: "Daily" },
                  ]}
                  onChange={(v) => set("frequency", v)}
                  layoutId={`${uid}-freq`}
                  reduce={reduce}
                />
              </Row>
            </Section>

            {/* Appearance */}
            <Section id={`${uid}-appearance`} title="Appearance" hint="Applies on this device only.">
              <Row label="Theme">
                <Segmented
                  label="Theme"
                  value={values.theme}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                    { value: "system", label: "System" },
                  ]}
                  onChange={(v) => set("theme", v)}
                  layoutId={`${uid}-theme`}
                  reduce={reduce}
                />
              </Row>
              <Row label="Density" hint="Compact fits about 30% more notes on screen.">
                <Segmented
                  label="Density"
                  value={values.density}
                  options={[
                    { value: "comfortable", label: "Comfortable" },
                    { value: "compact", label: "Compact" },
                  ]}
                  onChange={(v) => set("density", v)}
                  layoutId={`${uid}-density`}
                  reduce={reduce}
                />
              </Row>
              <Row label="Week starts on" htmlFor={`${uid}-week`}>
                <Select id={`${uid}-week`} value={values.weekStart} options={["Monday", "Sunday", "Saturday"]} onChange={(v) => set("weekStart", v as SettingsValues["weekStart"])} />
              </Row>
            </Section>

            {/* Danger zone */}
            <DangerZone id={`${uid}-danger`} username={saved.username} email={email} reduce={reduce} />

            {/* Unsaved changes bar */}
            <div className="pointer-events-none sticky bottom-4 z-30 flex justify-center sm:bottom-6" aria-live="polite">
              <AnimatePresence>
                {(dirty || status === "saved") && (
                  <motion.div
                    key="bar"
                    initial={reduce ? { opacity: 0 } : { y: 96, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { y: 96, opacity: 0 }}
                    transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 34 }}
                    className="pointer-events-auto flex w-full max-w-[560px] items-center gap-3 rounded-xl border border-[#2f2f36] bg-[#1a1a1e] py-2.5 pl-4 pr-2.5 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.8),0_0_0_1px_rgba(0,0,0,0.4)]"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {status === "saved" && !dirty ? (
                        <motion.p key="saved" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-1 items-center gap-2.5 text-[14px]">
                          <span className="flex size-5 items-center justify-center rounded-full bg-[#d4f25c] text-[#0e0e10]">
                            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                          </span>
                          Changes saved
                        </motion.p>
                      ) : (
                        <motion.p key="dirty" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex min-w-0 flex-1 items-center gap-2.5 text-[14px]">
                          <span className="relative flex size-2 shrink-0" aria-hidden="true">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#d4f25c] opacity-50 motion-reduce:hidden" />
                            <span className="relative inline-flex size-2 rounded-full bg-[#d4f25c]" />
                          </span>
                          <span className="truncate">
                            <span className="tabular-nums">{changed.length}</span> unsaved {changed.length === 1 ? "change" : "changes"}
                          </span>
                        </motion.p>
                      )}
                    </AnimatePresence>
                    {dirty && (
                      <>
                        <button
                          type="button"
                          onClick={discard}
                          disabled={status === "saving"}
                          className={`h-10 shrink-0 rounded-lg px-3.5 text-[14px] text-[#c4c4ca] transition-[color,background-color,border-color,box-shadow,transform] hover:bg-[#25252a] hover:text-[#f2f2f0] disabled:opacity-40 duration-150 active:scale-[0.97] ${focusRing}`}
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          onClick={() => void save()}
                          disabled={status === "saving"}
                          className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[#d4f25c] px-4 text-[14px] font-semibold text-[#0e0e10] transition-[transform,background-color] hover:bg-[#dff77c] active:scale-[0.98] disabled:cursor-progress ${focusRing}`}
                        >
                          {status === "saving" ? (
                            <>
                              <LoaderCircle className="size-4 animate-spin" strokeWidth={2.5} aria-hidden="true" />
                              Saving
                            </>
                          ) : (
                            <>
                              Save<span className="hidden sm:inline"> changes</span>
                              <kbd className="hidden rounded border border-[#0e0e10]/20 px-1 font-mono text-[10px] font-medium sm:inline">⌘S</kbd>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                      */
/* ------------------------------------------------------------------ */

const inputCls =
  "h-11 w-full rounded-lg border border-[#2a2a30] bg-[#111113] px-3.5 text-[14px] text-[#f2f2f0] outline-none transition-colors placeholder:text-[#6e6e76] hover:border-[#36363d] focus:border-[#d4f25c]/70 focus:ring-2 focus:ring-[#d4f25c]/15";

function Section({ id, title, hint, children }: { id: string; title: string; hint: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 lg:scroll-mt-10">
      <h2 id={`${id}-h`} className="font-display text-[22px] font-semibold tracking-[-0.03em]">
        {title}
      </h2>
      <p className="mt-1.5 text-[14px] text-[#9a9aa2]">{hint}</p>
      <div className="mt-5 divide-y divide-[#222227] rounded-xl border border-[#232328] bg-[#151518]">{children}</div>
    </section>
  );
}

function Row({ label, hint, htmlFor, inline = false, children }: { label: string; hint?: string; htmlFor?: string; inline?: boolean; children: ReactNode }) {
  const Label = htmlFor ? "label" : "p";
  return (
    <div className={`px-4 py-5 sm:px-6 ${inline ? "flex items-center justify-between gap-6" : "grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8"}`}>
      <div className="min-w-0">
        <Label {...(htmlFor ? { htmlFor } : {})} className="block text-[14px] font-medium text-[#f2f2f0]">
          {label}
        </Label>
        {hint && <p className="mt-1 text-[13px] leading-snug text-[#9a9aa2]">{hint}</p>}
      </div>
      <div className={inline ? "shrink-0" : "min-w-0"}>{children}</div>
    </div>
  );
}

function Select({ id, value, options, onChange }: { id: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} cursor-pointer appearance-none pr-10`}>
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#151518]">
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9a9aa2]" strokeWidth={1.75} aria-hidden="true" />
    </div>
  );
}

function Toggle({ checked, onChange, label, reduce }: { checked: boolean; onChange: (v: boolean) => void; label: string; reduce: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative flex h-[26px] w-[46px] shrink-0 items-center rounded-full p-[3px] transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.97] ${focusRing} ${
        checked ? "justify-end bg-[#d4f25c]" : "justify-start bg-[#2c2c32] hover:bg-[#35353c]"
      }`}
    >
      {/* 44px touch target */}
      <span className="absolute -inset-2.5" aria-hidden="true" />
      <motion.span
        layout
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 38 }}
        className={`block size-5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.4)] ${checked ? "bg-[#0e0e10]" : "bg-[#9a9aa2]"}`}
      />
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  layoutId,
  reduce,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  layoutId: string;
  reduce: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: ReactKeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="grid w-full auto-cols-fr grid-flow-col rounded-lg border border-[#2a2a30] bg-[#111113] p-1 sm:inline-grid sm:w-auto">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={`relative h-9 rounded-md px-4 text-[13px] font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] ${focusRing} ${on ? "text-[#0e0e10]" : "text-[#9a9aa2] hover:text-[#f2f2f0]"}`}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-md bg-[#f2f2f0]"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function AvatarField({ value, initials, onChange }: { value: string | null; initials: string; onChange: (v: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const read = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && onChange(reader.result);
    reader.readAsDataURL(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    read(e.dataTransfer.files[0]);
  };

  return (
    <div className="flex items-center gap-4" onDragOver={(e) => (e.preventDefault(), setOver(true))} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label="Upload a new photo"
        className={`group relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full transition-[box-shadow,transform] duration-150 active:scale-[0.97] ${focusRing} ${
          over ? "shadow-[0_0_0_2px_#d4f25c]" : "shadow-[0_0_0_1px_#2a2a30]"
        }`}
      >
        {value ? (
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center bg-[#26262c] font-display text-[20px] font-semibold tracking-[-0.02em] text-[#d4f25c]">{initials || "?"}</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-[#0e0e10]/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ImageUp className="size-5 text-[#f2f2f0]" strokeWidth={1.75} aria-hidden="true" />
        </span>
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={`h-10 rounded-lg border border-[#2f2f36] bg-[#1d1d21] px-3.5 text-[13px] font-medium transition-[color,background-color,border-color,box-shadow,transform] hover:border-[#3a3a42] hover:bg-[#232328] duration-150 active:scale-[0.97] ${focusRing}`}
        >
          Upload new
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className={`h-10 rounded-lg px-3 text-[13px] text-[#9a9aa2] transition-[color,background-color,border-color,box-shadow,transform] hover:text-[#f2f2f0] duration-150 active:scale-[0.97] ${focusRing}`}>
            Remove
          </button>
        )}
        <span className="hidden text-[12px] text-[#6e6e76] xl:inline">or drop an image here</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          read(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function DangerZone({ id, username, email, reduce }: { id: string; username: string; email: string; reduce: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const confirmId = `${id}-confirm`;
  const match = typed.trim() === username;

  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 lg:scroll-mt-10">
      <h2 id={`${id}-h`} className="font-display text-[22px] font-semibold tracking-[-0.03em] text-[#ff8a7a]">
        Danger zone
      </h2>
      <p className="mt-1.5 text-[14px] text-[#9a9aa2]">Take your notes with you, or leave for good.</p>
      <div className="mt-5 divide-y divide-[#3a1f1c] rounded-xl border border-[#4a2421] bg-[#171213]">
        <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[14px] font-medium">Export everything</p>
            <p className="mt-1 text-[13px] text-[#9a9aa2]">Every note, comment and attachment as Markdown in a .zip.</p>
          </div>
          <button
            type="button"
            className={`inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg border border-[#2f2f36] bg-[#1d1d21] px-3.5 text-[13px] font-medium transition-[color,background-color,border-color,box-shadow,transform] hover:bg-[#232328] sm:self-auto duration-150 active:scale-[0.97] ${focusRing}`}
          >
            <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Export .zip
          </button>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[14px] font-medium">Delete account</p>
              <p className="mt-1 text-[13px] text-[#9a9aa2]">Removes your notes from every shared workspace. There’s no undo.</p>
            </div>
            {!open && !done && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-expanded={open}
                className="inline-flex h-10 shrink-0 items-center self-start rounded-lg border border-[#6b2b25] bg-[#2a1513] px-3.5 text-[13px] font-medium text-[#ff8a7a] transition-[color,background-color,border-color,box-shadow,transform] hover:border-[#8a352d] hover:bg-[#341917] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8a7a] sm:self-auto duration-150 active:scale-[0.97]"
              >
                Delete account
              </button>
            )}
          </div>
          <AnimatePresence initial={false}>
            {open && !done && (
              <motion.div
                initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.35, ease }}
                className="overflow-hidden"
              >
                <form
                  className="mt-5 rounded-lg border border-[#3a1f1c] bg-[#120e0e] p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (match) setDone(true);
                  }}
                >
                  <label htmlFor={confirmId} className="flex items-start gap-2.5 text-[13px] leading-snug text-[#c4c4ca]">
                    <TriangleAlert className="mt-px size-4 shrink-0 text-[#ff8a7a]" strokeWidth={1.75} aria-hidden="true" />
                    <span>
                      Type <span className="rounded bg-[#2a1513] px-1.5 py-0.5 font-mono text-[12px] text-[#ff8a7a]">{username}</span> to confirm.
                    </span>
                  </label>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      id={confirmId}
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      autoFocus
                      spellCheck={false}
                      autoComplete="off"
                      className="h-10 w-full min-w-0 rounded-lg border border-[#3a1f1c] sm:flex-1 bg-[#0e0e10] px-3 font-mono text-[13px] outline-none transition-colors focus:border-[#ff8a7a]/70"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          setTyped("");
                        }}
                        className={`h-10 flex-1 rounded-lg px-3.5 text-[13px] text-[#9a9aa2] hover:text-[#f2f2f0] sm:flex-none transition-transform duration-150 active:scale-[0.97] ${focusRing}`}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!match}
                        className="h-10 flex-1 rounded-lg bg-[#ff6b5a] px-3.5 text-[13px] font-semibold text-[#160b0a] transition-[opacity,transform] hover:bg-[#ff7d6e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8a7a] disabled:cursor-not-allowed disabled:opacity-35 sm:flex-none duration-150 active:scale-[0.97]"
                      >
                        Delete forever
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
          {done && (
            <p role="status" className="mt-4 rounded-lg border border-[#3a1f1c] bg-[#120e0e] px-4 py-3 text-[13px] leading-snug text-[#c4c4ca]">
              We’ve sent a last-chance link to <span className="text-[#f2f2f0]">{email}</span>. Your account goes in 48 hours unless you click it.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default SettingsPanel;
