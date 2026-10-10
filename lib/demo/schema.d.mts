import type { ComponentControl, ControlOption, ControlValue, DemoScript } from "../registry-types";

export type DemoTarget = { name: string; at?: [number, number] };
export type ParsedStep =
  | { cmd: "wait"; ms: number }
  | { cmd: "move" | "drag"; point: [number, number] }
  | { cmd: "hover"; target: DemoTarget }
  | { cmd: "click"; target?: DemoTarget }
  | { cmd: "down" | "up" }
  | { cmd: "tab"; n: number }
  | { cmd: "key"; key: string }
  | { cmd: "type"; text: string }
  | { cmd: "scroll"; px: number };

export declare const TIMING: Readonly<{
  glide: number;
  drag: number;
  press: number;
  tabGap: number;
  keyGap: number;
  typeGap: number;
  scrollSettle: number;
}>;
export declare const STEP_COMMANDS: readonly string[];
export declare const CONTROL_KINDS: readonly string[];
export declare const DEMO_MIN_MS: number;
export declare const DEMO_MAX_MS: number;
export declare const MAX_CONTROLS: number;
export declare const REPLAY_ACTION: "$replay";

export declare function targetSelector(name: string): string;
export declare function parseStep(raw: string): { step: ParsedStep; error?: undefined } | { error: string; step?: undefined };
export declare function stepDuration(step: ParsedStep): number;
export declare function parseSteps(steps: readonly string[] | undefined): ParsedStep[];
export declare function demoDuration(steps: readonly ParsedStep[]): number;
export declare function demoTargets(steps: readonly ParsedStep[]): string[];
export declare function validateDemo(demo: DemoScript | unknown): string[];
export declare function optionOf(o: ControlOption): { value: ControlValue; label: string };
export declare function validateControls(controls: unknown, propNames: string[]): string[];
export declare function controlDefault(c: ComponentControl): ControlValue | undefined;
