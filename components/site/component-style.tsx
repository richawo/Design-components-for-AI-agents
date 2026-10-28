"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {usePathname} from "next/navigation";
import {SiteLink as Link} from "./site-link";
import {useSiteI18n} from "./site-i18n";
import {fetchProAccess} from "@/lib/pro-access-client";
import {VISUAL_STYLES,parseVisualStyle,type VisualStyle} from "@/lib/visual-styles";

type Access="checking"|"active"|"locked"|"error";
type StyleContext={visualStyle:VisualStyle;supported:boolean;access:Access;busy:boolean;upsell:boolean;choose:(style:VisualStyle)=>void;checkAccess:()=>void};
const Context=createContext<StyleContext>({visualStyle:"original",supported:true,access:"checking",busy:false,upsell:false,choose:()=>{},checkAccess:()=>{}});
export const useComponentStyle=()=>useContext(Context);
const PREFERENCE="dfa-component-style-v1";
function savePreference(style:VisualStyle){try{localStorage.setItem(PREFERENCE,style);}catch{/* The current tab can still select a style. */}}
function writeUrl(style:VisualStyle){
 if(!/\/(?:components|blocks)\/[^/]+$/.test(window.location.pathname))return;
 const url=new URL(window.location.href);if(style!=="original")url.searchParams.set("visualStyle",style);else url.searchParams.delete("visualStyle");
 window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
}
/** One paid selection follows visitors through the entire catalogue. Material is always gated separately. */
export function SiteStyleProvider({children}:{children:ReactNode}){
 const[visualStyle,setStyle]=useState<VisualStyle>("original"),[access,setAccess]=useState<Access>("checking"),[busy,setBusy]=useState(false),[upsell,setUpsell]=useState(false);
 const sequence=useRef(0);const pathname=usePathname();
 const choose=useCallback(async(style:VisualStyle)=>{
  const request=++sequence.current;setUpsell(false);
  if(style==="original"){setBusy(false);setStyle(style);savePreference(style);writeUrl(style);return;}
  setBusy(true);
  try{const paid=await fetchProAccess();if(request!==sequence.current)return;setAccess(paid?"active":"locked");if(paid){setStyle(style);savePreference(style);writeUrl(style);}else{setStyle("original");setUpsell(true);savePreference("original");writeUrl("original");}}
  catch{if(request===sequence.current){setAccess("error");setUpsell(true);}}
  finally{if(request===sequence.current)setBusy(false);}
 },[]);
 const checkAccess=useCallback(async()=>{const request=sequence.current;setAccess("checking");try{const paid=await fetchProAccess();if(request===sequence.current)setAccess(paid?"active":"locked");}catch{if(request===sequence.current)setAccess("error");}},[]);
 useEffect(()=>{
  let saved:VisualStyle|null=null;try{saved=parseVisualStyle(localStorage.getItem(PREFERENCE));}catch{}
  const requested=parseVisualStyle(new URLSearchParams(window.location.search).get("visualStyle"));
  if(requested!=="original"&&requested||saved&&saved!=="original")void choose(requested!=="original"&&requested?requested:saved!);
  else setAccess("locked");
  return()=>{sequence.current++;};
 },[choose]);
 useEffect(()=>{writeUrl(visualStyle);},[pathname,visualStyle]);
 return <Context.Provider value={{visualStyle,supported:true,access,busy,upsell,choose,checkAccess}}>{children}</Context.Provider>;
}
/** Retained as the component boundary for future per-platform style capabilities. */
export function ComponentStyleProvider({children}:{slug:string;styles?:VisualStyle[];children:ReactNode}){return <>{children}</>;}

function Lock(){return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V4a3 3 0 0 1 6 0v3"/></svg>;}
function ProMessage(){const{access}=useComponentStyle();return <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-site-fg-2"><p>{access==="error"?"We couldn't check your Pro access. Please try again.":"Preview the look. Pro unlocks Crayon components, prompts and MCP access."}</p><Link href="/pricing" className="underline underline-offset-4 hover:text-site-fg">Get Pro access</Link><Link href="/account" className="underline underline-offset-4 hover:text-site-fg">Sign in</Link></div>;}
function CrayonSample(){return <div role="img" aria-label="Crayon style sample: paper surfaces, handwritten headings and drawn cards" className="my-3 overflow-hidden rounded-xl border border-[#716950]/40 bg-[#f6edda] p-5 text-[#2d3027]" style={{fontFamily:'"DFA Crayon Sample", cursive'}}>
 <style>{'@font-face{font-family:"DFA Crayon Sample";src:url("/fonts/caveat-latin-variable.woff2") format("woff2");font-weight:400 700;font-display:swap}'}</style>
 <div className="flex items-center justify-between text-[12px]" style={{fontFamily:"sans-serif"}}><span>STUDIO / 01</span><span>✳</span></div><p className="my-3 text-[40px] font-bold leading-none">A little less ordinary.</p><div className="flex gap-2"><div className="flex-1 border border-[#716950] bg-[#fff8e7] px-3 py-3 text-[22px]" style={{borderRadius:"9px 13px 8px 12px",boxShadow:"2px 3px 0 #71695033"}}>Make something good.</div><div className="flex size-16 items-center justify-center rounded-full bg-[#b74e28] text-3xl text-[#fff8e7]">↗</div></div>
 </div>;}
export function SiteStyleSelector(){
 const{localize}=useSiteI18n();const{visualStyle,access,busy,upsell,choose,checkAccess}=useComponentStyle();const[open,setOpen]=useState(false);const scope=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(open)checkAccess();},[open,checkAccess]);
 useEffect(()=>{if(!open)return;const dismiss=(e:PointerEvent)=>{if(!scope.current?.contains(e.target as Node))setOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.stopPropagation();setOpen(false);trigger.current?.focus();}};document.addEventListener("pointerdown",dismiss);document.addEventListener("keydown",key);return()=>{document.removeEventListener("pointerdown",dismiss);document.removeEventListener("keydown",key);};},[open]);
 return localize(<div ref={scope} className="relative" data-style-selector><button ref={trigger} type="button" aria-expanded={open} aria-controls="site-style-menu" aria-label="Choose component style" onClick={()=>setOpen(v=>!v)} className="flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-[13px] text-site-fg-2 hover:bg-white/[0.06] hover:text-site-fg"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="m3 14 11-11 3 3L6 17H3v-3ZM11.5 5.5l3 3"/></svg><span className="hidden sm:inline" translate="no">{VISUAL_STYLES.find(s=>s.id===visualStyle)?.name}</span><span aria-hidden="true">⌄</span></button>
 {open&&<div id="site-style-menu" role="region" aria-label="Component styles" className="fixed inset-x-4 top-16 z-[70] mt-2 max-h-[calc(100dvh-88px)] w-auto overflow-y-auto sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-[350px] sm:max-w-[calc(100vw-32px)] rounded-2xl border border-white/15 bg-[#111113] p-4 text-site-fg shadow-2xl"><p className="mb-3 text-sm font-medium">Component style</p><div role="group" aria-label="Site component style" className="grid grid-cols-2 gap-2">{VISUAL_STYLES.map(style=><button key={style.id} type="button" aria-pressed={style.id===visualStyle} aria-busy={busy&&style.tier==="pro"} onClick={()=>{choose(style.id);if(style.id==="original"||access==="active")setOpen(false);trigger.current?.focus();}} className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-sm ${style.id===visualStyle?"border-white/50 bg-white/10":"border-white/10 hover:bg-white/5"}`}><span translate="no">{style.name}</span>{style.tier==="pro"&&<span className="flex items-center gap-1.5 text-[10px] uppercase text-site-fg-3">Pro{access!=="active"&&<Lock/>}</span>}</button>)}</div><CrayonSample/><p className="mb-3 text-xs leading-relaxed text-site-fg-3">Gallery cards and live previews follow your selection.</p>{access==="checking"?<p role="status" className="text-xs text-site-fg-3">Checking Pro access</p>:access!=="active"||upsell?<ProMessage/>:<p role="status" className="text-xs text-site-fg-2">Your Pro access unlocks both styles across the library.</p>}{busy&&<p role="status" className="mt-3 text-xs text-site-fg-3">Checking Pro access</p>}</div>}
 </div>);
}
export function ComponentStyleSelector(){
 const{localize}=useSiteI18n();const{visualStyle,access,busy,upsell,choose}=useComponentStyle();
 return localize(<div className="border-b border-white/[0.06] px-3 py-2 sm:px-4"><div className="flex flex-wrap items-center gap-x-4 gap-y-2"><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-site-fg-3">Style</span><div role="group" aria-label="Component style" className="inline-flex items-center gap-1 rounded-lg border border-site-line p-1">{VISUAL_STYLES.map(style=><button key={style.id} type="button" aria-label={style.name+" style"} aria-pressed={visualStyle===style.id} aria-busy={busy&&style.tier==="pro"} onClick={()=>choose(style.id)} className={`flex min-h-10 items-center gap-2 rounded-md px-3 text-[13px] transition-colors ${visualStyle===style.id?"bg-white/[0.1] text-site-fg":"text-site-fg-3 hover:text-site-fg"}`}><span translate="no">{style.name}</span>{style.tier==="pro"&&<><span className="font-mono text-[9px] uppercase tracking-[0.08em] text-site-fg-3">Pro</span>{access!=="active"&&<Lock/>}</>}</button>)}</div>{busy&&<span role="status" className="text-xs text-site-fg-3">Checking Pro access</span>}</div>{upsell&&<div className="mt-3 border-t border-site-line pt-3"><ProMessage/></div>}</div>);
}
