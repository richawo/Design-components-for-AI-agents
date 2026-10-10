// The demo + controls contract, in one place. Plain JS so the Node scripts
// (build-registry, rec, record-demos, check-component) and the site (through
// schema.d.mts) share exactly the same parser, timings and validation.
//
// A demo is a list of steps in the rec.mjs DSL. Targets are named with
// `@name`, which means the element carrying `data-demo="name"`:
//
//   wait:600              pause
//   move:0.5,0.4          glide the pointer to a fraction of the viewport
//   hover:@name[:fx,fy]   glide to an element (its centre, or a fraction of its box)
//   click[:@name[:fx,fy]] glide there and click, or click where the pointer is
//   down / up             press / release the primary button
//   drag:0.3,0.5          hold, glide to a fraction of the viewport, release
//   tab[:n]               move focus forward n times
//   key:Enter             press a key on the focused element
//   type:hello            type into the focused field
//   scroll:600            scroll the page by pixels

/** How long each kind of step takes, in ms. The live player and the recorder both use these. */
export const TIMING = Object.freeze({
  glide: 700, // pointer travel to a target or point
  drag: 600, // pointer travel while dragging
  press: 110, // button held during a click
  tabGap: 450, // between Tab presses
  keyGap: 250, // after a key press
  typeGap: 70, // between typed characters
  scrollSettle: 500, // after a scroll
});

export const STEP_COMMANDS = Object.freeze(["wait", "move", "hover", "click", "down", "up", "drag", "tab", "key", "type", "scroll"]);
export const CONTROL_KINDS = Object.freeze(["toggle", "slider", "select", "segmented", "color", "text", "action"]);

/** A demo should read in one breath: long enough to show the idea, short enough to loop. */
export const DEMO_MIN_MS = 3000;
export const DEMO_MAX_MS = 8000;
export const MAX_CONTROLS = 12;
/** An action control with this prop replays the demo instead of setting a prop. */
export const REPLAY_ACTION = "$replay";

const NAME = /^[a-z][a-z0-9-]{0,39}$/;
const FRACTION = (n) => Number.isFinite(n) && n >= 0 && n <= 1;

/** The selector for a demo target name. */
export function targetSelector(name) {
  return `[data-demo="${name}"]`;
}

function parseTarget(arg) {
  // @name, optionally followed by :fx,fy (a point inside the element's box).
  const m = /^@([a-z][a-z0-9-]*)(?::(-?[\d.]+),(-?[\d.]+))?$/.exec(arg);
  if (!m) return { error: `target "${arg}" must be @name or @name:fx,fy (data-demo names are lowercase kebab-case)` };
  const target = { name: m[1] };
  if (m[2] !== undefined) {
    const fx = Number(m[2]);
    const fy = Number(m[3]);
    if (!FRACTION(fx) || !FRACTION(fy)) return { error: `point in "${arg}" must be two fractions between 0 and 1` };
    target.at = [fx, fy];
  }
  return { target };
}

function parsePoint(arg, cmd) {
  const parts = arg.split(",").map(Number);
  if (parts.length !== 2 || !parts.every(FRACTION)) return { error: `${cmd} needs two fractions of the viewport, e.g. ${cmd}:0.5,0.4` };
  return { point: parts };
}

/**
 * Parse one step. Returns `{ step }` or `{ error }`; never throws.
 * @param {string} raw
 */
export function parseStep(raw) {
  if (typeof raw !== "string" || !raw.trim()) return { error: "a step must be a non-empty string" };
  const s = raw.trim();
  const i = s.indexOf(":");
  const cmd = i === -1 ? s : s.slice(0, i);
  const arg = i === -1 ? "" : s.slice(i + 1);
  switch (cmd) {
    case "wait": {
      const ms = Number(arg);
      if (!Number.isInteger(ms) || ms < 0 || ms > 6000) return { error: `wait needs whole ms between 0 and 6000 (got "${arg}")` };
      return { step: { cmd, ms } };
    }
    case "move":
    case "drag": {
      const p = parsePoint(arg, cmd);
      return p.error ? p : { step: { cmd, point: p.point } };
    }
    case "hover":
    case "click": {
      if (!arg) return cmd === "click" ? { step: { cmd } } : { error: "hover needs a target, e.g. hover:@send" };
      const t = parseTarget(arg);
      return t.error ? t : { step: { cmd, target: t.target } };
    }
    case "down":
    case "up":
      return arg ? { error: `${cmd} takes no argument` } : { step: { cmd } };
    case "tab": {
      const n = arg ? Number(arg) : 1;
      if (!Number.isInteger(n) || n < 1 || n > 12) return { error: `tab needs a count between 1 and 12 (got "${arg}")` };
      return { step: { cmd, n } };
    }
    case "key":
      if (!/^[A-Za-z0-9]+$|^ $/.test(arg)) return { error: `key needs a key name such as Enter, Escape, ArrowDown or Space (got "${arg}")` };
      return { step: { cmd, key: arg === " " ? "Space" : arg } };
    case "type":
      if (!arg || arg.length > 80) return { error: "type needs 1–80 characters of text" };
      return { step: { cmd, text: arg } };
    case "scroll": {
      const px = Number(arg);
      if (!Number.isInteger(px) || Math.abs(px) > 4000) return { error: `scroll needs whole pixels up to ±4000 (got "${arg}")` };
      return { step: { cmd, px } };
    }
    default:
      return { error: `unknown step "${cmd}" (use ${STEP_COMMANDS.join(", ")})` };
  }
}

/** How long a parsed step takes to play, in ms. */
export function stepDuration(step) {
  switch (step.cmd) {
    case "wait":
      return step.ms;
    case "move":
    case "hover":
      return TIMING.glide;
    case "click":
      return (step.target ? TIMING.glide : 0) + TIMING.press;
    case "drag":
      return TIMING.drag;
    case "tab":
      return step.n * TIMING.tabGap;
    case "key":
      return TIMING.keyGap;
    case "type":
      return step.text.length * TIMING.typeGap;
    case "scroll":
      return TIMING.scrollSettle;
    default:
      return 0;
  }
}

/** Parsed steps, or throws with every problem listed. */
export function parseSteps(steps) {
  const out = [];
  const errors = [];
  (steps ?? []).forEach((raw, i) => {
    const r = parseStep(raw);
    if (r.error) errors.push(`step ${i + 1}: ${r.error}`);
    else out.push(r.step);
  });
  if (errors.length) throw new Error(errors.join("; "));
  return out;
}

export function demoDuration(steps) {
  return steps.reduce((ms, s) => ms + stepDuration(s), 0);
}

/** Every data-demo name a script targets, in order of first use. */
export function demoTargets(steps) {
  return [...new Set(steps.filter((s) => s.target).map((s) => s.target.name))];
}

/**
 * Validate meta.demo. Returns a list of problems (empty when valid).
 * @param {unknown} demo
 */
export function validateDemo(demo) {
  const errors = [];
  if (demo === undefined) return errors;
  if (!demo || typeof demo !== "object" || Array.isArray(demo)) return ["demo must be an object { steps, loop? }"];
  const extra = Object.keys(demo).filter((k) => !["steps", "loop"].includes(k));
  if (extra.length) errors.push(`demo has unknown keys: ${extra.join(", ")}`);
  if (!Array.isArray(demo.steps) || demo.steps.length < 2) return [...errors, "demo.steps must list at least two steps"];
  if (demo.steps.length > 40) errors.push("demo.steps is too long (max 40 steps); keep the script small");
  if (demo.loop !== undefined && typeof demo.loop !== "boolean") errors.push("demo.loop must be a boolean");
  const parsed = [];
  demo.steps.forEach((raw, i) => {
    const r = parseStep(raw);
    if (r.error) errors.push(`demo step ${i + 1} ("${raw}"): ${r.error}`);
    else parsed.push(r.step);
  });
  if (parsed.length === demo.steps.length) {
    if (!parsed.some((s) => s.target)) errors.push("demo never targets an element; name the parts it uses with data-demo and point at them with @name");
    const ms = demoDuration(parsed);
    if (ms < DEMO_MIN_MS || ms > DEMO_MAX_MS) errors.push(`demo runs ${(ms / 1000).toFixed(1)}s; keep it between ${DEMO_MIN_MS / 1000} and ${DEMO_MAX_MS / 1000}s`);
    let held = false;
    for (const s of parsed) {
      if (s.cmd === "down") held = true;
      if (s.cmd === "up") held = false;
    }
    if (held) errors.push("demo ends with the pointer held down; add an up step");
  }
  return errors;
}

const isScalar = (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean";

/** The value an option sets, and its label. Options are bare values or { value, label }. */
export function optionOf(o) {
  return o && typeof o === "object" ? { value: o.value, label: String(o.label ?? o.value) } : { value: o, label: String(o) };
}

/**
 * Validate meta.controls against the component's documented props.
 * @param {unknown} controls
 * @param {string[]} propNames names from meta.props
 */
export function validateControls(controls, propNames) {
  const errors = [];
  if (controls === undefined) return errors;
  if (!Array.isArray(controls)) return ["controls must be an array"];
  if (controls.length === 0) return ["controls is empty; omit it instead"];
  if (controls.length > MAX_CONTROLS) errors.push(`${controls.length} controls; keep it to ${MAX_CONTROLS} or fewer (pick the props that change the look)`);
  const seen = new Set();
  const known = new Set(propNames);
  const allowedKeys = new Set(["prop", "label", "kind", "min", "max", "step", "unit", "options", "default", "group", "remount", "value"]);
  controls.forEach((c, i) => {
    const at = `control ${i + 1}${c && typeof c === "object" && c.prop ? ` (${c.prop})` : ""}`;
    if (!c || typeof c !== "object" || Array.isArray(c)) return errors.push(`${at}: must be an object`);
    const extra = Object.keys(c).filter((k) => !allowedKeys.has(k));
    if (extra.length) errors.push(`${at}: unknown keys ${extra.join(", ")}`);
    if (!CONTROL_KINDS.includes(c.kind)) return errors.push(`${at}: kind must be one of ${CONTROL_KINDS.join(", ")}`);
    if (typeof c.label !== "string" || c.label.length < 2 || c.label.length > 24) errors.push(`${at}: label must be 2–24 characters`);
    if (c.group !== undefined && (typeof c.group !== "string" || c.group.length > 20)) errors.push(`${at}: group must be a short string`);
    if (c.remount !== undefined && typeof c.remount !== "boolean") errors.push(`${at}: remount must be a boolean`);
    if (typeof c.prop !== "string" || !c.prop) return errors.push(`${at}: prop is required`);
    const replay = c.kind === "action" && c.prop === REPLAY_ACTION;
    if (!replay && !known.has(c.prop)) errors.push(`${at}: prop "${c.prop}" isn't documented in meta.props`);
    // Actions may share a prop with nothing else; config controls must be unique.
    const key = `${c.kind === "action" ? "action:" : ""}${c.prop}`;
    if (seen.has(key)) errors.push(`${at}: prop "${c.prop}" has two controls`);
    seen.add(key);

    const options = Array.isArray(c.options) ? c.options.map(optionOf) : null;
    if (c.options !== undefined && (!options || options.some((o) => !isScalar(o.value)))) errors.push(`${at}: options must be values or { value, label }`);

    switch (c.kind) {
      case "toggle":
        if (typeof c.default !== "boolean") errors.push(`${at}: toggle needs a boolean default`);
        break;
      case "slider": {
        for (const k of ["min", "max", "default"]) if (typeof c[k] !== "number" || !Number.isFinite(c[k])) errors.push(`${at}: slider needs a numeric ${k}`);
        if (c.step !== undefined && !(typeof c.step === "number" && c.step > 0)) errors.push(`${at}: step must be a positive number`);
        if (typeof c.min === "number" && typeof c.max === "number" && c.min >= c.max) errors.push(`${at}: min must be less than max`);
        if (typeof c.default === "number" && (c.default < c.min || c.default > c.max)) errors.push(`${at}: default ${c.default} is outside ${c.min}–${c.max}`);
        if (c.unit !== undefined && (typeof c.unit !== "string" || c.unit.length > 6)) errors.push(`${at}: unit must be a short string such as "ms" or "px"`);
        break;
      }
      case "select":
      case "segmented": {
        if (!options || options.length < 2) errors.push(`${at}: ${c.kind} needs at least two options`);
        else {
          if (c.kind === "segmented" && options.length > 5) errors.push(`${at}: segmented takes at most 5 options; use select`);
          if (!options.some((o) => o.value === c.default)) errors.push(`${at}: default must be one of the options`);
        }
        break;
      }
      case "color":
        if (typeof c.default !== "string" || !/^#[0-9a-fA-F]{6}$/.test(c.default)) errors.push(`${at}: color default must be a #rrggbb hex`);
        if (options && options.some((o) => typeof o.value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(o.value))) errors.push(`${at}: color swatches must be #rrggbb hexes`);
        if (options && options.length > 6) errors.push(`${at}: at most 6 swatches`);
        break;
      case "text":
        if (typeof c.default !== "string") errors.push(`${at}: text needs a string default`);
        else if (c.default.length > 120) errors.push(`${at}: text default is too long for a control (max 120)`);
        break;
      case "action":
        if (replay) break;
        if (options) {
          if (options.length < 1 || options.length > 6) errors.push(`${at}: action takes 1–6 options`);
        } else if (!isScalar(c.value)) errors.push(`${at}: action needs options (one button each) or a value`);
        break;
    }
  });
  return errors;
}

/**
 * The value a control starts at. Actions have no configured value (they drive
 * runtime state, which isn't configuration), so they return undefined.
 */
export function controlDefault(c) {
  return c.kind === "action" ? undefined : c.default;
}
