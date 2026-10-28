import type {ComponentSource} from "../../lib/registry-types";
export type StyleDelta={format:"dfa-style-delta-v1";slug:string;baseCodeSha256:string;codeEdits:{at:number;end:number;text:string}[];promptSuffix:string;visualStyle:Record<string,unknown>;styleCss:string;font:{family:string;url:string;weight:string}};
export function packStyleSource(base:ComponentSource,variant:ComponentSource&{codeEdits?:{at:number;end:number;text:string}[];styleCss:string;font:StyleDelta["font"]}):StyleDelta;
export function restoreStyleSource(base:ComponentSource,delta:StyleDelta):ComponentSource&{visualStyle:string;styleCss:string;font:StyleDelta["font"]};
