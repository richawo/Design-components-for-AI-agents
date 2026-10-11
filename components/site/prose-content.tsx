"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CopyButton } from "./copy-button";

/** Keep the Markdown tree intact, including code inside lists and quotations. */
export function ProseContent({ html, className = "" }: { html: string; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [tools, setTools] = useState<{ element: HTMLElement; text: string }[]>([]);
  useEffect(() => {
    const blocks = Array.from(root.current?.querySelectorAll("pre") ?? []).map((pre) => {
      const wrapper = document.createElement("div");
      wrapper.className = "my-6 overflow-hidden rounded-xl border border-white/10 bg-site-raised [&_pre]:!m-0 [&_pre]:!rounded-none [&_pre]:!border-0";
      wrapper.dir = "ltr";
      const toolbar = document.createElement("div");
      toolbar.className = "flex min-h-12 items-center justify-end border-b border-white/[0.07] px-3 py-1";
      pre.before(wrapper);
      wrapper.append(toolbar, pre);
      return { pre, wrapper, element: toolbar, text: pre.querySelector("code")?.textContent ?? pre.textContent ?? "" };
    });
    setTools(blocks);
    return () => { for (const { pre, wrapper } of blocks) if (wrapper.parentNode) wrapper.replaceWith(pre); };
  }, [html]);
  return <>
    <div ref={root} className={`site-prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
    {tools.map(({ element, text }, index) => createPortal(<CopyButton text={text} label="Copy code" />, element, String(index)))}
  </>;
}
