"use client";

import { useEffect, useState, type ComponentType } from "react";
import { previews } from "@/registry/__generated__/previews";

/**
 * Renders one registry component on a bare page. The component page embeds
 * this in an iframe so breakpoints respond to the frame width, not the window.
 * Mobile (React Native) components render inside a phone-sized viewport.
 */
export function PreviewRenderer({ slug, platform, theme }: { slug: string; platform: "web" | "mobile"; theme: "light" | "dark" }) {
  const [Comp, setComp] = useState<ComponentType | null>(null);

  useEffect(() => {
    let live = true;
    previews[slug]?.().then((m) => live && setComp(() => m.default));
    return () => {
      live = false;
    };
  }, [slug]);

  if (platform === "mobile") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black p-0 sm:p-8">
        <div className="relative h-dvh w-full overflow-hidden bg-white sm:h-[844px] sm:w-[390px] sm:rounded-[54px] sm:shadow-[0_0_0_10px_#1a1a1c,0_0_0_11px_#2e2e33,0_40px_120px_-20px_rgba(255,122,69,0.18)]">
          <div className="flex h-full w-full flex-col">{Comp ? <Comp /> : null}</div>
          <div className="pointer-events-none absolute left-1/2 top-[11px] hidden h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black sm:block" />
        </div>
      </div>
    );
  }

  return <div className={theme === "dark" ? "min-h-dvh bg-black" : "min-h-dvh bg-white"}>{Comp ? <Comp /> : null}</div>;
}
