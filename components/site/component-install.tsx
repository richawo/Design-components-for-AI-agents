"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchProSource } from "@/lib/pro-source-client";
import { CopyButton } from "./copy-button";

export function ComponentInstall({
  slug,
  name,
  tier,
  text,
  html,
  dependencies,
  platform,
}: {
  slug: string;
  name: string;
  tier: "free" | "pro";
  text: string;
  html: string;
  dependencies: string[];
  platform: "web" | "mobile";
}) {
  const [access, setAccess] = useState<
    "checking" | "active" | "locked" | "error"
  >("checking");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (tier !== "pro") return;
    let live = true;
    setAccess("checking");
    fetchProSource(slug)
      .then((source) => {
        if (live) setAccess(source ? "active" : "locked");
      })
      .catch(() => {
        if (live) setAccess("error");
      });
    return () => {
      live = false;
    };
  }, [slug, tier, attempt]);
  return (
    <div>
      {tier === "pro" && (
        <div
          className="mb-5 rounded-2xl border border-site-line-2 bg-site-raised p-5 sm:p-6"
          data-pro-access={access}
        >
          {access === "active" ? (
            <p className="text-sm leading-relaxed text-site-fg-2">
              Your Pro access is active. Install {name} below or copy its source
              and briefs.
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
                Pro includes the source, design brief and JSON prompt, plus the
                private registry for installation. Already own a licence? Sign
                in to unlock them here.
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
        </div>
      )}
      <p className="text-[15px] leading-relaxed text-site-fg-2">
        {platform === "mobile"
          ? "Copy the React Native file into your app and install its dependencies."
          : "Add the component with shadcn, or use the Design for AI CLI and your connected agent."}{" "}
        {tier === "pro" &&
          "The registry checks your licence before returning source."}
      </p>
      <div className="mt-5 overflow-hidden rounded-2xl border border-site-line bg-site-raised">
        <div className="flex items-center justify-between gap-3 border-b border-site-line px-4 py-3">
          <span className="font-mono text-xs text-site-fg-3">
            {platform === "mobile" ? "React Native" : "Terminal"}
          </span>
          <CopyButton text={text} label="Copy install command" />
        </div>
        <div
          tabIndex={0}
          role="region"
          aria-label={`${name} install command`}
          className="max-h-[480px] overflow-auto p-4 text-[12px] leading-[1.8] sm:p-5 [&_pre]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        />
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
    </div>
  );
}
