import type { ComponentSource } from "../../lib/registry-types";
type Meta = { slug: string; usage: string; platform: string; kind?: string; category?:string };
type Pack = { css: string; prompt: string; appearance: string; font: { family: string; url: string; weight: string }; palette: Record<string,string>; themes?: Record<"light" | "dark", Record<string,string>>; webRuntime?:string; webModule?:string; nativeRuntime?:string; material?:Record<string,unknown> };
export function styleRoots(meta: Meta, code: string): { start: number; end: number }[];
export function materialCss(code: string, pack: Pack): string;
export function makeStyledSource(meta: Meta, source: ComponentSource, pack: Pack): (ComponentSource & { codeEdits: {at:number;end:number;text:string}[]; visualStyle: string; styleCss: string; font: Pack["font"]; styleRuntime?:string;styleRuntimeSha256?:string; styleOptions?:Record<string,string> }) | null;
