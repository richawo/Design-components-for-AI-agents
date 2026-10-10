import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { configuredPrompt, configuredSnippet, decodeHash, diffValues, documentedDefault, encodeHash, parseFromPreview, parseToPreview, PREVIEW_CHANNEL } from "@/lib/demo/protocol";
import { DEMO_MAX_MS, demoDuration, parseStep, parseSteps, validateControls, validateDemo } from "@/lib/demo/schema.mjs";
import type { ComponentControl, ComponentMeta } from "@/lib/registry-types";

const root = path.resolve(__dirname, "..");

/** Every component folder we can see: free always, Pro when the private repo is cloned. */
function components() {
  const out: { tier: string; slug: string; meta: ComponentMeta; code: string }[] = [];
  for (const tier of ["free", "pro"]) {
    const dir = path.join(root, "registry", tier);
    if (!fs.existsSync(dir)) continue;
    for (const slug of fs.readdirSync(dir)) {
      const metaPath = path.join(dir, slug, "meta.json");
      if (!fs.existsSync(metaPath)) continue;
      out.push({ tier, slug, meta: JSON.parse(fs.readFileSync(metaPath, "utf8")), code: fs.readFileSync(path.join(dir, slug, `${slug}.tsx`), "utf8") });
    }
  }
  return out;
}

describe("demo step DSL", () => {
  it("parses targets, points and commands", () => {
    expect(parseStep("hover:@send").step).toEqual({ cmd: "hover", target: { name: "send" } });
    expect(parseStep("click:@plot:0.2,0.5").step).toEqual({ cmd: "click", target: { name: "plot", at: [0.2, 0.5] } });
    expect(parseStep("click").step).toEqual({ cmd: "click" });
    expect(parseStep("move:0.5,0.4").step).toEqual({ cmd: "move", point: [0.5, 0.4] });
    expect(parseStep("tab:3").step).toEqual({ cmd: "tab", n: 3 });
    expect(parseStep("key:Enter").step).toEqual({ cmd: "key", key: "Enter" });
    expect(parseStep("type:hello world").step).toEqual({ cmd: "type", text: "hello world" });
  });

  it("rejects raw selectors, bad fractions and unknown commands", () => {
    expect(parseStep("hover:button.primary").error).toMatch(/@name/);
    expect(parseStep("hover:@send:1.2,0.5").error).toMatch(/fractions/);
    expect(parseStep("move:2,1").error).toBeTruthy();
    expect(parseStep("teleport:@x").error).toMatch(/unknown step/);
    expect(parseStep("wait:9000").error).toBeTruthy();
  });

  it("times a script the way the player and recorder play it", () => {
    expect(demoDuration(parseSteps(["wait:500", "hover:@a", "click", "type:abc"]))).toBe(500 + 700 + 110 + 210);
  });

  it("validates whole scripts", () => {
    expect(validateDemo({ steps: ["wait:3000", "click:@go", "wait:500"] })).toEqual([]);
    expect(validateDemo({ steps: ["wait:500", "click:@go"] }).join()).toMatch(/keep it between/);
    expect(validateDemo({ steps: ["wait:3000", "move:0.5,0.5"] }).join()).toMatch(/never targets/);
    expect(validateDemo({ steps: ["wait:2500", "hover:@go", "down"] }).join()).toMatch(/held down/);
    expect(validateDemo({ steps: ["wait:3000", "click:@go"], speed: 2 }).join()).toMatch(/unknown keys/);
  });
});

describe("controls", () => {
  const props = ["accent", "size", "duration", "state", "label"];
  it("accepts every kind", () => {
    const controls = [
      { prop: "accent", label: "Accent", kind: "color", default: "#ff7a45", options: ["#ff7a45", "#22c55e"] },
      { prop: "size", label: "Size", kind: "segmented", options: ["sm", "md"], default: "md" },
      { prop: "duration", label: "Hold for", kind: "slider", min: 500, max: 3000, step: 100, unit: "ms", default: 1200 },
      { prop: "label", label: "Label", kind: "text", default: "Delete" },
      { prop: "state", label: "State", kind: "action", options: ["idle", "listening"] },
      { prop: "$replay", label: "Replay", kind: "action" },
    ];
    expect(validateControls(controls, props)).toEqual([]);
  });

  it("catches undocumented props, bad defaults and too many controls", () => {
    expect(validateControls([{ prop: "nope", label: "Nope", kind: "toggle", default: true }], props).join()).toMatch(/isn't documented/);
    expect(validateControls([{ prop: "size", label: "Size", kind: "select", options: ["sm", "md"], default: "lg" }], props).join()).toMatch(/one of the options/);
    expect(validateControls([{ prop: "duration", label: "Hold", kind: "slider", min: 5, max: 1, default: 3 }], props).join()).toMatch(/min must be less/);
    expect(validateControls([{ prop: "accent", label: "Accent", kind: "color", default: "red" }], props).join()).toMatch(/#rrggbb/);
    const many = Array.from({ length: 13 }, (_, i) => ({ prop: `p${i}`, label: `P ${i}`, kind: "toggle", default: false }));
    expect(validateControls(many, many.map((c) => c.prop)).join()).toMatch(/12 or fewer/);
  });
});

describe("preview protocol", () => {
  it("accepts well-formed messages only", () => {
    expect(parseToPreview({ channel: PREVIEW_CHANNEL, type: "props", props: { size: "sm", on: true, n: 3 } })).toMatchObject({ type: "props" });
    expect(parseToPreview({ channel: PREVIEW_CHANNEL, type: "demo", action: "replay" })).toMatchObject({ action: "replay" });
    expect(parseToPreview({ channel: "other", type: "demo", action: "play" })).toBeNull();
    expect(parseToPreview({ channel: PREVIEW_CHANNEL, type: "demo", action: "eval" })).toBeNull();
    expect(parseToPreview({ channel: PREVIEW_CHANNEL, type: "props", props: { onClick: { fn: 1 } } })).toBeNull();
    expect(parseToPreview({ channel: PREVIEW_CHANNEL, type: "props", props: { "__proto__.x": 1 } })).toBeNull();
    expect(parseFromPreview({ channel: PREVIEW_CHANNEL, type: "demo-state", playing: false, reason: "user" })).toMatchObject({ reason: "user" });
    expect(parseFromPreview({ channel: PREVIEW_CHANNEL, type: "ready" })).toBeNull();
  });
});

describe("tuned values", () => {
  const controls: ComponentControl[] = [
    { prop: "duration", label: "Hold for", kind: "slider", min: 500, max: 3000, step: 100, default: 1500 },
    { prop: "variant", label: "Variant", kind: "segmented", options: ["danger", "neutral"], default: "danger" },
    { prop: "accent", label: "Fill", kind: "color", default: "#e5484d" },
    { prop: "label", label: "Label", kind: "text", default: "Hold to delete workspace" },
    { prop: "disabled", label: "Disabled", kind: "toggle", default: false },
    { prop: "state", label: "State", kind: "action", options: ["a", "b"] },
  ];

  it("round-trips through the URL hash as a diff", () => {
    const values = { duration: 2200, variant: "neutral", accent: "#22c55e", label: "Hold, then: gone", disabled: true };
    const hash = encodeHash(controls, values);
    expect(hash).toMatch(/^c=/);
    expect(hash).not.toContain("state");
    expect(decodeHash(controls, `#${hash}`)).toEqual(values);
    expect(encodeHash(controls, { duration: 1500, variant: "danger" })).toBe("");
  });

  it("drops unknown props and out-of-range values from a hash", () => {
    expect(decodeHash(controls, "#c=duration:99999,variant:purple,evil:1,accent:%23zzzzzz")).toEqual({ duration: 3000 });
  });

  it("diffs against the demo defaults", () => {
    expect(diffValues(controls, { duration: 1500, variant: "neutral" })).toEqual({ variant: "neutral" });
  });

  it("writes a snippet that restates only what differs from the component's defaults", () => {
    const usage = 'import { HoldConfirmButton } from "@/components/design-for-ai/button-hold-confirm";\n\n<HoldConfirmButton label="x" />';
    const props = [
      { name: "duration", type: "number", default: "1200", description: "" },
      { name: "variant", type: "string", default: '"danger"', description: "" },
      { name: "label", type: "string", default: '"Hold to delete"', description: "" },
      { name: "disabled", type: "boolean", default: "false", description: "" },
      { name: "accent", type: "string", description: "" },
    ];
    const out = configuredSnippet(usage, controls, { duration: 1500, variant: "danger", accent: "#e5484d", label: "Hold to delete workspace", disabled: true }, props);
    expect(out).toContain('import { HoldConfirmButton } from "@/components/design-for-ai/button-hold-confirm";');
    expect(out).toContain("duration={1500}");
    expect(out).toContain('label="Hold to delete workspace"');
    expect(out).toContain("disabled");
    expect(out).not.toContain("variant=");
    expect(out).not.toContain("accent=");
    expect(documentedDefault({ name: "x", type: "", default: '"per seat\\nper month"', description: "" })).toBe("per seat\nper month");
  });

  it("appends the configuration to the prompt", () => {
    expect(configuredPrompt("Brief.", "Hold to Confirm", controls, { duration: 2000 })).toMatch(/## Configuration[\s\S]*`duration`\): 2000/);
  });
});

describe("registry demos and controls", () => {
  const all = components();
  const withContract = all.filter((c) => c.meta.demo || c.meta.controls);

  it("has pilots to hold the contract to", () => expect(withContract.length).toBeGreaterThan(0));

  it.each(all.map((c) => [`${c.tier}/${c.slug}`, c] as const))("%s: demo and controls are valid", (_name, c) => {
    expect(validateDemo(c.meta.demo)).toEqual([]);
    expect(validateControls(c.meta.controls, c.meta.props.map((p) => p.name))).toEqual([]);
    if (c.meta.demo) expect(demoDuration(parseSteps(c.meta.demo.steps))).toBeLessThanOrEqual(DEMO_MAX_MS);
    if (c.meta.controls?.length) {
      // The default export takes the overrides the preview sends: either
      // `Partial<XProps>` directly, or an `XDemoProps` alias that extends it
      // with demo-only settings (`type XDemoProps = Partial<XProps> & {...}`).
      const sig = /export default function \w+\(\s*(?:\w+|\{[^)]*\})\s*:\s*(Partial<\w+Props>|\w+DemoProps)\s*=\s*\{\}\s*\)/.exec(c.code);
      expect(sig, "default export signature").not.toBeNull();
      if (sig && !sig[1].startsWith("Partial<")) {
        expect(c.code).toMatch(new RegExp(`type ${sig[1]}\\s*=\\s*Partial<\\w+Props>`));
      }
    }
    if (c.meta.demo) {
      const names = new Set(c.meta.demo.steps.map((s) => /@([a-z][a-z0-9-]*)/.exec(s)?.[1]).filter(Boolean));
      for (const n of names) expect(c.code.includes(`data-demo="${n}"`) || /data-demo=\{/.test(c.code), `@${n}`).toBe(true);
    }
  });
});
