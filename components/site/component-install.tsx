"use client";
import { useComponentStyle } from "./component-style";
import { styleInstallText } from "@/lib/visual-styles";
import { useSiteI18n } from "@/components/site/site-i18n";

import { useReducedMotion } from "@/lib/use-reduced-motion";

import { SiteLink as Link } from "@/components/site/site-link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchProAccess } from "@/lib/pro-access-client";
import {
  AnimatePresence,
  motion,
  useIsPresent,
} from "motion/react";
import { CopyButton } from "./copy-button";

export function ComponentInstall({
  slug,
  name,
  tier,
  text,
  html,
  dependencies,
  platform,
  kind,
}: {
  slug: string;
  name: string;
  tier: "free" | "pro";
  text: string;
  html: string;
  dependencies: string[];
  platform: "web" | "mobile";
  kind?: "component" | "block";
}) {
  const { localize } = useSiteI18n();
  const { visualStyle,styleTheme } = useComponentStyle();
  const effectiveTier = visualStyle === "crayon" ? "pro" : tier;
  const install = visualStyle === "crayon" ? styleInstallText({slug,platform,dependencies},styleTheme) : text;

  const [access, setAccess] = useState<
    "checking" | "active" | "locked" | "error"
  >("checking");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (effectiveTier !== "pro") return;
    let live = true;
    setAccess("checking");
    fetchProAccess()
      .then((source) => {
        if (live) setAccess(source ? "active" : "locked");
      })
      .catch(() => {
        if (live) setAccess("error");
      });
    return () => {
      live = false;
    };
  }, [slug, effectiveTier, attempt]);
  return (
    localize(<div>
      {effectiveTier === "pro" && (
        <AccessPanel access={access}>
          <AnimatePresence mode="wait" initial={false}>
            <AccessScene key={access === "checking" ? "locked" : access}>
              {access === "active" ? (
                <p className="text-sm leading-relaxed text-site-fg-2">
                  Your Pro access is active. Install {name} below or copy its
                  source and briefs.
                </p>
              ) : access === "error" ? (
                <div role="status">
                  <p className="text-sm text-site-fg-2">
                    We couldn't check your Pro access. Please try again.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAttempt((value) => value + 1)}
                    className="site-btn site-btn-secondary mt-4 min-h-11 px-5"
                  >
                    Retry access check
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-lg font-medium tracking-tight">
                    Build with {name}.
                  </p>
                  <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-site-fg-2">
                    Pro includes the source, design brief and JSON prompt, plus
                    the private registry for installation. Already own a
                    licence? Sign in to unlock them here.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/pricing"
                      className="site-btn site-btn-accent min-h-11 px-5"
                    >
                      Get Pro access <span aria-hidden="true">↗</span>
                    </Link>
                    <Link
                      href="/account"
                      className="site-btn site-btn-secondary min-h-11 px-5"
                    >
                      Sign in
                    </Link>
                  </div>
                </>
              )}
            </AccessScene>
          </AnimatePresence>
        </AccessPanel>
      )}
      <p className="text-[15px] leading-relaxed text-site-fg-2">
        {platform === "mobile"
          ? "Copy the React Native file into your app and install its dependencies."
          : kind === "block"
            ? "Install the block and its component dependencies together with shadcn or the Design for AI CLI."
            : "Add the component with shadcn, or use the Design for AI CLI and your connected agent."}{" "}
        {effectiveTier === "pro" &&
          "The registry checks your licence before returning source."}
      </p>
      <div className="mt-5 overflow-hidden rounded-2xl border border-site-line bg-site-raised">
        <div className="flex items-center justify-between gap-3 border-b border-site-line px-4 py-3">
          <span className="font-mono text-xs text-site-fg-3">
            {platform === "mobile" ? "React Native" : "Terminal"}
          </span>
          <CopyButton text={install} label="Copy install command" />
        </div>
        {visualStyle === "original" ? <div
          tabIndex={0}
          role="region"
          aria-label={`${name} install command`}
          className="max-h-[480px] overflow-auto p-4 text-[12px] leading-[1.8] sm:p-5 [&_pre]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        /> : <pre tabIndex={0} className="max-h-[480px] overflow-auto p-5 font-mono text-xs leading-relaxed">{install}</pre>}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-site-fg-2">
        <Link
          href="/docs/installation"
          className="underline decoration-site-line-2 underline-offset-4 transition-colors hover:text-site-fg"
        >
          Installation guide
        </Link>
        <Link
          href="/docs/agents"
          className="underline decoration-site-line-2 underline-offset-4 transition-colors hover:text-site-fg"
        >
          Use with an AI agent
        </Link>
        {dependencies.length > 0 && (
          <span>
            Dependencies:{" "}
            <span className="font-mono text-xs">{dependencies.join(", ")}</span>
          </span>
        )}
      </div>
    </div>)
  );
}

function AccessPanel({
  access,
  children,
}: {
  access: string;
  children: ReactNode;
}) {
  const { localize } = useSiteI18n();

  const reduce = useReducedMotion();
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const node = inner.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    localize(<motion.div
      data-pro-access={access}
      initial={false}
      animate={{ height }}
      transition={{ duration: reduce ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="mb-5 overflow-hidden rounded-2xl border border-site-line-2 bg-site-raised"
    >
      <div ref={inner} className="p-5 sm:p-6">
        {children}
      </div>
    </motion.div>)
  );
}
function AccessScene({ children }: { children: ReactNode }) {
  const { localize } = useSiteI18n();

  const present = useIsPresent(),
    reduce = useReducedMotion();
  return (
    localize(<motion.div
      inert={!present}
      aria-hidden={!present || undefined}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -4 }}
      transition={{ duration: reduce ? 0.1 : 0.18 }}
      className="motion-reduce:!transform-none"
    >
      {children}
    </motion.div>)
  );
}
