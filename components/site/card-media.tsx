"use client";

import { useEffect, useRef, useState } from "react";

/** Off screen this long, a card drops its video so a long gallery doesn't hold dozens of decoders. */
const UNLOAD_AFTER_MS = 2000;
/** A touch card plays when this much of it is on screen. */
const PLAY_IN_VIEW_AT = 0.6;

type Mode = "hover" | "in-view" | "off";

function videoMode(): Mode {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "off";
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return "off";
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches ? "hover" : "in-view";
}

/**
 * A gallery card's picture: the poster, and over it a short recording of the
 * component in use. The video costs nothing until it's wanted: no src until a
 * pointer enters the card (or, on touch screens, until the card is in view),
 * paused and rewound on leave, unloaded when the card scrolls away. Reduced
 * motion and Save-Data get the poster only.
 */
export function CardMedia({
  name,
  thumb,
  video,
  platform,
  priority,
}: {
  name: string;
  thumb: string | null;
  video: { mp4: string; webm: string | null } | null;
  platform: "web" | "mobile";
  priority: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState(false);
  const srcRef = useRef(false);
  const want = useRef(false);
  const [showing, setShowing] = useState(false);
  const fit = platform === "mobile" ? "object-contain py-3" : "object-cover object-top";

  useEffect(() => {
    const v = ref.current;
    const card = v?.closest("a");
    if (!v || !card || !video) return;
    const mode = videoMode();
    if (mode === "off") return;

    let unload: number | undefined;
    const start = () => {
      want.current = true;
      window.clearTimeout(unload);
      // The first time, the source renders on the next commit and plays from the effect below.
      if (srcRef.current) v.play().catch(() => {});
      else setSrc(true);
    };
    const stop = () => {
      want.current = false;
      v.pause();
      setShowing(false);
      // Rewind after the fade, so the poster is what fades back in.
      window.setTimeout(() => {
        if (v.paused) v.currentTime = 0;
      }, 220);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (mode === "in-view") {
          if (e.intersectionRatio >= PLAY_IN_VIEW_AT) start();
          else stop();
        }
        if (!e.isIntersecting) {
          window.clearTimeout(unload);
          unload = window.setTimeout(() => {
            v.pause();
            setShowing(false);
            setSrc(false);
          }, UNLOAD_AFTER_MS);
        } else window.clearTimeout(unload);
      },
      { threshold: [0, PLAY_IN_VIEW_AT] },
    );
    io.observe(card);

    const focusIn = () => card.matches(":focus-visible") && start();
    if (mode === "hover") {
      card.addEventListener("pointerenter", start);
      card.addEventListener("pointerleave", stop);
      card.addEventListener("focusin", focusIn);
      card.addEventListener("focusout", stop);
    }
    return () => {
      io.disconnect();
      window.clearTimeout(unload);
      card.removeEventListener("pointerenter", start);
      card.removeEventListener("pointerleave", stop);
      card.removeEventListener("focusin", focusIn);
      card.removeEventListener("focusout", stop);
    };
  }, [video]);

  // <source> changes need an explicit load(); dropping them also releases the decoder.
  useEffect(() => {
    const v = ref.current;
    srcRef.current = src;
    if (!v) return;
    v.load();
    if (src && want.current) v.play().catch(() => {});
  }, [src]);

  return (
    <>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt={`${name} preview`}
          loading={priority ? "eager" : "lazy"}
          className={`absolute inset-0 size-full transition-transform duration-500 ease-site group-hover:scale-[1.02] ${fit}`}
        />
      ) : (
        <div className="absolute inset-0 site-dots opacity-60" />
      )}
      {video && (
        <video
          ref={ref}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          disablePictureInPicture
          onPlaying={() => setShowing(true)}
          className={`pointer-events-none absolute inset-0 size-full transition-[opacity,scale] duration-200 ease-site group-hover:scale-[1.02] ${fit} ${showing ? "opacity-100" : "opacity-0"}`}
        >
          {src && <source src={video.mp4} type="video/mp4" />}
          {src && video.webm && <source src={video.webm} type="video/webm" />}
        </video>
      )}
    </>
  );
}
