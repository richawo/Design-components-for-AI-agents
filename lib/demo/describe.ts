import type { ComponentControl } from "../registry-types";
import { REPLAY_ACTION, optionOf } from "./schema.mjs";

/** One control as a line of Markdown, for agents: what it tunes and its range or choices. */
export function describeControl(c: ComponentControl): string {
  if (c.kind === "action" && c.prop === REPLAY_ACTION) return `- ${c.label}: replays the demo.`;
  const opts = (c.options ?? []).map(optionOf);
  const range =
    c.kind === "slider"
      ? `${c.min}–${c.max}${c.unit ? ` ${c.unit}` : ""}${c.step ? `, step ${c.step}` : ""}`
      : c.kind === "select" || c.kind === "segmented"
        ? opts.map((o) => JSON.stringify(o.value)).join(" | ")
        : c.kind === "color"
          ? `hex colour${opts.length ? `; suggested ${opts.map((o) => o.value).join(", ")}` : ""}`
          : c.kind === "toggle"
            ? "true | false"
            : c.kind === "action"
              ? `runtime state: ${(opts.length ? opts.map((o) => JSON.stringify(o.value)) : [JSON.stringify(c.value)]).join(" | ")}`
              : "text";
  const dflt = c.default !== undefined ? ` · demo default ${JSON.stringify(c.default)}` : "";
  return `- \`${c.prop}\` (${c.label}, ${c.kind}): ${range}${dflt}`;
}

/** The "Controls" section shared by the MCP server and the Markdown twin. */
export function controlsSection(controls: ComponentControl[] | undefined): string[] {
  if (!controls?.length) return [];
  return [
    "## Controls",
    "",
    "The props worth tuning, with the ranges the preview offers. Pass them to the named export; action controls show runtime states the host app drives.",
    "",
    ...controls.map(describeControl),
  ];
}
