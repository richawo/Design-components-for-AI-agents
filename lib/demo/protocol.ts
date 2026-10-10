import type { ComponentControl, ControlValue, PropDoc } from "../registry-types";
import { REPLAY_ACTION, optionOf } from "./schema.mjs";

/* ------------------------------------------------------------------ */
/* postMessage protocol between a component page and its preview frame. */
/* Both live on the same origin; anything else is ignored.               */
/* ------------------------------------------------------------------ */

export const PREVIEW_CHANNEL = "dfa-preview";

/**
 * Parent → preview. "hello" asks the preview to (re)send "ready": the preview
 * can finish loading before the page has hydrated and started listening.
 */
export type ToPreview =
  | { channel: typeof PREVIEW_CHANNEL; type: "hello" }
  | { channel: typeof PREVIEW_CHANNEL; type: "props"; props: Record<string, ControlValue>; remount?: boolean }
  | { channel: typeof PREVIEW_CHANNEL; type: "demo"; action: "play" | "stop" | "replay" };

/** Preview → parent. */
export type FromPreview =
  | { channel: typeof PREVIEW_CHANNEL; type: "ready"; hasDemo: boolean }
  | { channel: typeof PREVIEW_CHANNEL; type: "demo-state"; playing: boolean; reason?: "finished" | "user" | "stopped" };

/** A message without its channel tag (distributes over the union). */
export type Body<T> = T extends unknown ? Omit<T, "channel"> : never;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isValue = (v: unknown): v is ControlValue => typeof v === "string" || typeof v === "number" || typeof v === "boolean";
const PROP_NAME = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;

/** Validate a message the preview received. Returns null for anything that isn't ours or isn't well-formed. */
export function parseToPreview(data: unknown): ToPreview | null {
  if (!isRecord(data) || data.channel !== PREVIEW_CHANNEL) return null;
  if (data.type === "hello") return { channel: PREVIEW_CHANNEL, type: "hello" };
  if (data.type === "props") {
    if (!isRecord(data.props)) return null;
    const entries = Object.entries(data.props);
    if (entries.length > 32 || !entries.every(([k, v]) => PROP_NAME.test(k) && isValue(v) && (typeof v !== "string" || v.length <= 400))) return null;
    return { channel: PREVIEW_CHANNEL, type: "props", props: Object.fromEntries(entries) as Record<string, ControlValue>, remount: data.remount === true };
  }
  if (data.type === "demo" && (data.action === "play" || data.action === "stop" || data.action === "replay")) {
    return { channel: PREVIEW_CHANNEL, type: "demo", action: data.action };
  }
  return null;
}

/** Validate a message the page received from its preview frame. */
export function parseFromPreview(data: unknown): FromPreview | null {
  if (!isRecord(data) || data.channel !== PREVIEW_CHANNEL) return null;
  if (data.type === "ready" && typeof data.hasDemo === "boolean") return { channel: PREVIEW_CHANNEL, type: "ready", hasDemo: data.hasDemo };
  if (data.type === "demo-state" && typeof data.playing === "boolean") {
    const reason = data.reason === "finished" || data.reason === "user" || data.reason === "stopped" ? data.reason : undefined;
    return { channel: PREVIEW_CHANNEL, type: "demo-state", playing: data.playing, reason };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Control values                                                       */
/* ------------------------------------------------------------------ */

/** Controls that hold configuration (everything but actions). */
export const configControls = (controls: ComponentControl[]) => controls.filter((c) => c.kind !== "action");

/** The demo's starting values for every configuration control. */
export function defaultValues(controls: ComponentControl[]): Record<string, ControlValue> {
  return Object.fromEntries(configControls(controls).map((c) => [c.prop, c.default as ControlValue]));
}

/** Only the values that differ from the demo's defaults. */
export function diffValues(controls: ComponentControl[], values: Record<string, ControlValue>): Record<string, ControlValue> {
  const out: Record<string, ControlValue> = {};
  for (const c of configControls(controls)) if (c.prop in values && values[c.prop] !== c.default) out[c.prop] = values[c.prop];
  return out;
}

/** Coerce a value to what a control accepts, or undefined if it can't. */
export function coerce(c: ComponentControl, raw: unknown): ControlValue | undefined {
  switch (c.kind) {
    case "toggle":
      return raw === true || raw === "1" || raw === "true" ? true : raw === false || raw === "0" || raw === "false" ? false : undefined;
    case "slider": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || c.min === undefined || c.max === undefined) return undefined;
      const step = c.step ?? 1;
      const snapped = Math.round((Math.min(c.max, Math.max(c.min, n)) - c.min) / step) * step + c.min;
      return Number(snapped.toFixed(6));
    }
    case "select":
    case "segmented": {
      const hit = (c.options ?? []).map(optionOf).find((o) => String(o.value) === String(raw));
      return hit?.value;
    }
    case "color":
      return typeof raw === "string" && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : undefined;
    case "text":
      return typeof raw === "string" ? raw.slice(0, 400) : undefined;
    default:
      return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* URL hash: #c=prop:value,prop:value (diff from the defaults only)     */
/* ------------------------------------------------------------------ */

/** Encode tuned values for the URL hash, or "" when nothing differs. */
export function encodeHash(controls: ComponentControl[], values: Record<string, ControlValue>): string {
  const diff = diffValues(controls, values);
  const parts = Object.entries(diff).map(([k, v]) => `${k}:${encodeURIComponent(typeof v === "boolean" ? (v ? "1" : "0") : String(v))}`);
  return parts.length ? `c=${parts.join(",")}` : "";
}

/** Read tuned values from a URL hash. Unknown props and bad values are dropped. */
export function decodeHash(controls: ComponentControl[], hash: string): Record<string, ControlValue> {
  const m = /(?:^|[#&])c=([^&]*)/.exec(hash);
  if (!m) return {};
  const byProp = new Map(configControls(controls).map((c) => [c.prop, c]));
  const out: Record<string, ControlValue> = {};
  for (const part of m[1].split(",")) {
    const i = part.indexOf(":");
    if (i < 1) continue;
    const c = byProp.get(part.slice(0, i));
    if (!c) continue;
    let raw: string;
    try {
      raw = decodeURIComponent(part.slice(i + 1));
    } catch {
      continue;
    }
    const v = coerce(c, raw);
    if (v !== undefined) out[c.prop] = v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Copy configured: usage snippet and prompt with the tuned values      */
/* ------------------------------------------------------------------ */

/** Parse a documented default (a JS literal written as a string in meta.props) when it's a plain value. */
export function documentedDefault(p: PropDoc | undefined): ControlValue | undefined {
  const d = p?.default?.trim();
  if (!d) return undefined;
  if (d === "true" || d === "false") return d === "true";
  if (/^-?\d+(\.\d+)?$/.test(d)) return Number(d);
  const q = /^(["'])(.*)\1$/.exec(d);
  return q ? q[2].replace(/\\n/g, "\n") : undefined;
}

function jsxAttr(prop: string, v: ControlValue) {
  if (v === true) return prop;
  if (typeof v === "string" && !/["\n\\{}]/.test(v)) return `${prop}="${v}"`;
  return `${prop}={${JSON.stringify(v)}}`;
}

/**
 * The props a configured snippet should pass, so it reproduces what the
 * preview shows without restating defaults: anything tuned away from the
 * demo, plus demo values that differ from the component's own documented
 * default. A value equal to the documented default is always left out.
 */
export function configuredProps(controls: ComponentControl[], values: Record<string, ControlValue>, props: PropDoc[]): [string, ControlValue][] {
  const docs = new Map(props.map((p) => [p.name, p]));
  return configControls(controls).flatMap((c): [string, ControlValue][] => {
    const v = values[c.prop] ?? (c.default as ControlValue);
    const documented = documentedDefault(docs.get(c.prop));
    if (v === documented) return [];
    return v !== c.default || documented !== undefined ? [[c.prop, v]] : [];
  });
}

/** A usage snippet: the usage's import line and one element with the tuned props. */
export function configuredSnippet(usage: string, controls: ComponentControl[], values: Record<string, ControlValue>, props: PropDoc[]): string {
  const imp = /^import\s*\{\s*(\w+)[^}]*\}\s*from\s*["'][^"']+["'];?/m.exec(usage);
  const name = imp?.[1] ?? "Component";
  const attrs = configuredProps(controls, values, props).map(([k, v]) => jsxAttr(k, v));
  const el = !attrs.length ? `<${name} />` : attrs.join(" ").length < 60 ? `<${name} ${attrs.join(" ")} />` : `<${name}\n${attrs.map((a) => `  ${a}`).join("\n")}\n/>`;
  return `${imp ? `${imp[0]}\n\n` : ""}${el}\n`;
}

/** The design prompt with the tuned values appended, so an agent builds this configuration. */
export function configuredPrompt(prompt: string, name: string, controls: ComponentControl[], values: Record<string, ControlValue>): string {
  const lines = configControls(controls).map((c) => {
    const v = values[c.prop] ?? c.default;
    const shown = typeof v === "string" ? JSON.stringify(v) : String(v);
    return `- ${c.label} (\`${c.prop}\`): ${shown}${c.unit ? ` ${c.unit}` : ""}`;
  });
  return `${prompt.trim()}\n\n## Configuration\n\nBuild ${name} with these settings, which were tuned on its preview:\n\n${lines.join("\n")}\n`;
}

export const isReplay = (c: ComponentControl) => c.kind === "action" && c.prop === REPLAY_ACTION;
