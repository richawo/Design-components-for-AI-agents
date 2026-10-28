"use client";
import { useSiteI18n } from "@/components/site/site-i18n";

import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect, type ComponentType } from "react";
import { useAccent } from "@/lib/accent-client";
import { accentInk, parseAccent } from "@/lib/accent";
import type { PreviewAccent } from "@/lib/preview-accent";
import { loadPreview } from "@/lib/preview-loader";
import { formatLocale } from "@/lib/i18n/routing";
import { DemoAborted, DemoPlayer, whenSmooth, type CursorHandle } from "@/lib/demo/player";
import { PREVIEW_CHANNEL, parseToPreview, type Body, type FromPreview } from "@/lib/demo/protocol";
import { parseSteps } from "@/lib/demo/schema.mjs";
import type { ControlValue, DemoScript } from "@/lib/registry-types";
import { applyNativePreviewStyle } from "@/lib/preview-native-style";
import { parseStyleTheme, type StyleTheme } from "@/lib/visual-styles";
import { DemoCursor } from "./demo-cursor";

/** Pause between loops of a looping demo. */
const LOOP_GAP_MS = 1600;
/** Let a remounted component paint before the script starts. */
const MOUNT_SETTLE_MS = 120;

type AnyComponent = ComponentType<Record<string, ControlValue>>;

/**
 * Renders one registry component on a bare page. The component page embeds
 * this in an iframe so breakpoints respond to the frame width, not the window.
 * Mobile (React Native) components render inside a phone-sized viewport.
 *
 * Embedded, it speaks a small postMessage protocol with its same-origin parent
 * (lib/demo/protocol.ts): props from the Customize panel are merged over the
 * demo's own, and the parent can play, stop or replay the demo script. Opened
 * on its own (screenshots, a new tab) nothing autoplays.
 */
export function PreviewRenderer({ slug, platform, theme, demo, accentConfig, initialLocale }: { accentConfig: PreviewAccent; slug: string; platform: "web" | "mobile"; theme: "light" | "dark"; demo?: DemoScript; initialLocale?: string }) {
  const { localize, locale } = useSiteI18n();

  const accent = useAccent();
  const [styleMaterial,setStyleMaterial] = useState<{css:string;palette:Record<string,string>;themes?:Record<StyleTheme,Record<string,string>>;font:string}|null>(null);
  const [styleTheme,setStyleTheme] = useState<StyleTheme>("light");
  const [styleStatus,setStyleStatus] = useState<"original"|"loading"|"active"|"locked"|"error">("original");
  const [styleAttempt,setStyleAttempt] = useState(0);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get("visualStyle")!=="crayon")return;
    setStyleTheme(parseStyleTheme(params.get("theme"))??"light");
    const controller=new AbortController();let live=true;setStyleStatus("loading");
    const timeout=window.setTimeout(()=>{if(live){live=false;setStyleStatus("error");controller.abort();}},8000);
    fetch(`/api/styles/${encodeURIComponent(slug)}`,{credentials:"same-origin",cache:"no-store",signal:controller.signal}).then(async response=>{
      if(response.status===401||response.status===403)return null;
      if(!response.ok)throw new Error("Style could not be loaded");
      const data=await response.json();if(data.locked===true)return null;
      if(data.visualStyle!=="crayon"||typeof data.css!=="string"||typeof data.font?.family!=="string"||typeof data.font?.url!=="string")throw new Error("Invalid style material");
      const fontUrl=new URL(new URL(data.font.url).pathname,window.location.origin).href;
      const font=new FontFace(data.font.family,`url("${fontUrl}")`,{weight:data.font.weight});
      await font.load();document.fonts.add(font);
      return {css:data.css.replaceAll(data.font.url,fontUrl),palette:data.palette,themes:data.themes,font:data.font.family};
    }).then(material=>{if(!live)return;window.clearTimeout(timeout);if(!material){setStyleStatus("locked");return;}setStyleMaterial(material);setStyleStatus("active");}).catch(error=>{if(live&&error.name!=="AbortError"){window.clearTimeout(timeout);setStyleStatus("error");}});
    return()=>{live=false;window.clearTimeout(timeout);controller.abort();};
  },[slug,styleAttempt]);
  const [Comp, setComp] = useState<AnyComponent | null>(null);
  const [overrides, setOverrides] = useState<Record<string, ControlValue>>({});
  const [mount, setMount] = useState(0);
  const cursor = useRef<CursorHandle>(null);
  const nativeStyleRoot = useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{if(platform!=="mobile"||!styleMaterial||!Comp||!nativeStyleRoot.current)return;return applyNativePreviewStyle(nativeStyleRoot.current,styleMaterial.themes?.[styleTheme]??styleMaterial.palette,styleMaterial.font);},[platform,styleMaterial,styleTheme,Comp,mount]);
  const run = useRef<AbortController | null>(null);
  const steps = useMemo(() => (demo ? parseSteps(demo.steps) : null), [demo]);

  useEffect(() => {
    let live = true;
    loadPreview(slug)?.then((m) => live && setComp(() => m.default as AnyComponent));
    return () => {
      live = false;
    };
  }, [slug]);

  const post = useCallback((msg: Body<FromPreview>) => {
    if (window.parent !== window) window.parent.postMessage({ channel: PREVIEW_CHANNEL, ...msg }, window.location.origin);
  }, []);

  const stop = useCallback(
    (reason: "user" | "stopped") => {
      if (!run.current) return;
      run.current.abort();
      run.current = null;
      post({ type: "demo-state", playing: false, reason });
    },
    [post],
  );

  const play = useCallback(
    async (fresh: boolean) => {
      if (!Comp || styleStatus === "loading" || !steps || !cursor.current) return;
      run.current?.abort();
      const ctl = new AbortController();
      run.current = ctl;
      post({ type: "demo-state", playing: true });
      const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
      try {
        for (let pass = 0; ; pass++) {
          if (fresh || pass > 0) {
            // Start from the component's first state, as a visitor would.
            setMount((m) => m + 1);
            await wait(MOUNT_SETTLE_MS);
          }
          await whenSmooth(window);
          if (ctl.signal.aborted) return;
          await new DemoPlayer(window, cursor.current!, ctl.signal).play(steps);
          if (!demo?.loop || ctl.signal.aborted) break;
          await wait(LOOP_GAP_MS);
          if (ctl.signal.aborted) return;
        }
        if (run.current === ctl) {
          run.current = null;
          post({ type: "demo-state", playing: false, reason: "finished" });
        }
      } catch (e) {
        if (!(e instanceof DemoAborted)) throw e;
      }
    },
    [Comp, styleStatus, steps, demo?.loop, post],
  );

  // Messages from the component page.
  useEffect(() => {
    if (window.parent === window) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const msg = parseToPreview(e.data);
      if (!msg) return;
      if (msg.type === "hello") {
        if (Comp && styleStatus !== "loading") post({ type: "ready", hasDemo: !!steps });
      }
      else if (msg.type === "props") {
        setOverrides(msg.props);
        if (msg.remount) setMount((m) => m + 1);
      } else if (msg.action === "stop") stop("stopped");
      // Autoplay never runs with reduced motion; an explicit replay always does.
      else if (msg.action === "play") {
        if (!reduce.matches && !run.current) void play(false);
      } else void play(true);
    };
    window.addEventListener("message", onMessage);
    if (Comp && styleStatus !== "loading") post({ type: "ready", hasDemo: !!steps });
    const motionPreference = () => { if (reduce.matches) stop("stopped"); };
    reduce.addEventListener("change", motionPreference);
    return () => {
      window.removeEventListener("message", onMessage);
      reduce.removeEventListener("change", motionPreference);
    };
  }, [Comp, styleStatus, play, stop, post, steps]);

  // Any real input hands control back to the visitor at once. Capture phase,
  // so the demo has stopped before the component sees the event.
  useEffect(() => {
    const takeOver = (e: Event) => {
      if (!e.isTrusted || !run.current) return;
      if (e.type === "pointermove" && (e as PointerEvent).movementX === 0 && (e as PointerEvent).movementY === 0) return;
      stop("user");
    };
    const types = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
    for (const t of types) window.addEventListener(t, takeOver, { capture: true, passive: true });
    return () => {
      for (const t of types) window.removeEventListener(t, takeOver, { capture: true });
    };
  }, [stop]);

  useEffect(() => () => run.current?.abort(), []);

  const effectiveAccent = (accentConfig.prop && parseAccent(overrides[accentConfig.prop])) || accent;
  const accentProps = accent && accentConfig.prop ? { [accentConfig.prop]: accent } : {};
  const accentCss = effectiveAccent ? accentConfig.variables.map(token =>
    `[style*="${token}"]{${token}:${effectiveAccent}!important;${token === "--accent" ? `--on:${accentInk(effectiveAccent)}!important;` : ""}}` +
    `[class~="bg-(${token})"],[class~="bg-[var(${token})]"]{color:${accentInk(effectiveAccent)}!important;}`
  ).join("\n") : "";
  const node = <>{styleMaterial && <style data-licensed-visual-style>{styleMaterial.css}</style>}{accentCss && <style data-preview-accent>{accentCss}</style>}{Comp ? <Comp key={mount} locale={initialLocale ?? formatLocale(locale === "en" ? "en-US" : locale)} {...accentProps} {...overrides} {...(styleMaterial ? {theme:styleTheme} : {})} /> : null}</>;

  if(styleStatus === "locked" || styleStatus === "error" || styleStatus === "loading") {
    return localize(<div data-preview-slug={slug} data-preview-ready={styleStatus!=="loading"} className="flex min-h-dvh items-center justify-center bg-black p-8 text-white"><div className="max-w-md text-center">
      {styleStatus==="loading"?<p role="status" className="text-sm text-white/60">Loading Crayon</p>:styleStatus==="locked"?<><p className="text-xl font-medium">Crayon is a Pro style.</p><p className="mt-3 text-sm leading-relaxed text-white/60">Sign in with an active Pro licence to use this style.</p><a href="/account" target="_top" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm text-black">Sign in</a></>:<><p role="status" className="text-sm text-white/70">We couldn't load Crayon. Please try again.</p><button type="button" onClick={()=>setStyleAttempt(n=>n+1)} className="mt-5 min-h-11 rounded-full border border-white/20 px-5 text-sm">Retry Crayon</button></>}
    </div></div>);
  }
  if (platform === "mobile") {
    return (
      localize(<div data-preview-slug={slug} data-preview-ready={!!Comp} className="flex min-h-dvh items-center justify-center bg-black p-0 sm:p-8">
        <div
          data-preview-device="mobile"
          className="relative w-full overflow-hidden bg-white sm:rounded-[54px] sm:shadow-[0_0_0_10px_#1a1a1c,0_0_0_11px_#2e2e33,0_40px_120px_-20px_rgba(0,0,0,0.9)]"
          // Registry utilities use a later CSS layer; keep the device bounds independent of them.
          style={{ maxWidth: 390, height: "min(844px, 100dvh)" }}
        >
          <div ref={nativeStyleRoot} data-dfa-style={styleMaterial ? "crayon" : undefined} data-dfa-theme={styleMaterial?styleTheme:undefined} data-dfa-native="true" className="flex h-full w-full flex-col">{node}</div>
          <div className="pointer-events-none absolute left-1/2 top-[11px] hidden h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black sm:block" />
        </div>
        {steps && <DemoCursor ref={cursor} />}
      </div>)
    );
  }

  return (
    localize(<div data-preview-slug={slug} data-preview-ready={!!Comp} data-dfa-style={styleMaterial ? "crayon" : undefined} data-dfa-theme={styleMaterial?styleTheme:undefined} className={theme === "dark" ? "min-h-dvh bg-black" : "min-h-dvh bg-white"}>
      {node}
      {steps && <DemoCursor ref={cursor} />}
    </div>)
  );
}
