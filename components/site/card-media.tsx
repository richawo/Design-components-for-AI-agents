"use client";

import { useEffect, useRef, useState } from "react";
import { registerCard, videoAllowed } from "./card-playback";

/**
 * A gallery card's picture: the poster, and over it a short recording of the
 * component in use, playing on its own while the card is in view (see
 * card-playback for which cards play and when). The video costs nothing until
 * the card nears the viewport, crossfades in over the poster on its first
 * frame, and is unloaded once the card has been off screen a moment. Hovering
 * or focusing a card keeps it playing. Reduced motion and Save-Data get the
 * poster only.
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
  const want = useRef(false);
  const committed = useRef(false);
  const [showing, setShowing] = useState(false);
  const fit = platform === "mobile" ? "object-contain py-3" : "object-cover object-top";

  useEffect(() => {
    const v = ref.current;
    const card = v?.closest("a");
    if (!v || !card || !video || !videoAllowed()) return;

    const handle = registerCard(card, {
      setLoaded(loaded) {
        if (!loaded) setShowing(false);
        setSrc(loaded);
      },
      setPlaying(playing) {
        want.current = playing;
        if (!playing) v.pause();
        else if (committed.current) v.play().catch(() => {});
        // Otherwise the source is still committing; the effect below starts it.
      },
    });
    const enter = (e: PointerEvent) => e.pointerType === "mouse" && handle.engage(true);
    const leave = () => handle.engage(false);
    const focusIn = () => card.matches(":focus-visible") && handle.engage(true);
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    card.addEventListener("focusin", focusIn);
    card.addEventListener("focusout", leave);
    return () => {
      handle.release();
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointerleave", leave);
      card.removeEventListener("focusin", focusIn);
      card.removeEventListener("focusout", leave);
    };
  }, [video]);

  // <source> changes need an explicit load(); dropping them also releases the decoder.
  useEffect(() => {
    const v = ref.current;
    committed.current = src;
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
          preload={src ? "auto" : "none"}
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
