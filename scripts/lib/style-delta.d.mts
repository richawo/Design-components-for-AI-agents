import type {ComponentSource} from "../../lib/registry-types";
type SharedText=string|{parts:(string|{ref:string})[]};
export type StyleDelta={format:"dfa-style-delta-v1"|"dfa-style-delta-v2";slug:string;baseCodeSha256:string;codeEdits:{at:number;end:number;text:SharedText}[];promptSuffix:SharedText;visualStyle:Record<string,unknown>;styleCss:SharedText;font:{family:string;url:string;weight:string};sharedSha256?:string;styleRuntime?:SharedText;styleRuntimeSha256?:string;styleOptions?:Record<string,string>};
export function sharedStyleText(material:Record<string,unknown>|null):Record<string,string>|null;
export function packStyleSource(base:ComponentSource,variant:ComponentSource&{codeEdits?:{at:number;end:number;text:string}[];styleCss:string;font:StyleDelta["font"];styleRuntime?:string;styleRuntimeSha256?:string;styleOptions?:Record<string,string>},shared?:Record<string,string>|null):StyleDelta;
export function restoreStyleSource(base:ComponentSource,delta:StyleDelta,shared?:Record<string,string>|null):ComponentSource&{visualStyle:string;styleCss:string;font:StyleDelta["font"];styleRuntime?:string;styleRuntimeSha256?:string;styleOptions?:Record<string,string>};
