"use client";
import { useSiteI18n } from "@/components/site/site-i18n";

import { useEffect, useRef, useState } from "react";
import { registerCard, videoAllowed } from "./card-playback";
import { useComponentStyle } from "./component-style";
import { cardStyleMedia, type CardStylePreviews } from "@/lib/card-style-media";

type CardMediaProps = {
  name: string;
  thumb: string | null;
  srcSet?: string;
  sizes?: string;
  video: { mp4: string; webm: string | null } | null;
  platform: "web" | "mobile";
  priority: boolean;
  compact?: boolean;
  stylePreviews?: CardStylePreviews;
};

export function CardMedia(props: CardMediaProps) {
  const { visualStyle } = useComponentStyle();
  const selected = cardStyleMedia(props, props.stylePreviews, visualStyle);
  // Changing material retires the old decoder and its asynchronous events.
  return <RecordedCardMedia key={visualStyle} {...props} {...selected} />;
}

function restoreOriginalPoster(image: HTMLImageElement) {
  const original = image.getAttribute("src");
  if (!original || !image.srcset) return;
  image.removeAttribute("srcset");
  image.removeAttribute("sizes");
  image.src = original;
}

/**
 * A gallery card's picture: the poster, and over it a short recording of the
 * component in use, playing on its own while the card is in view (see
 * card-playback for which cards play and when). The video costs nothing until
 * the card nears the viewport, crossfades in over the poster on its first
 * frame, and is unloaded once the card has been off screen a moment. Hovering
 * or focusing a card keeps it playing. Reduced motion and Save-Data get the
 * poster only.
 */
function RecordedCardMedia({
  name,
  thumb,
  srcSet,
  sizes,
  video,
  platform,
  priority,
  compact = false,
}: CardMediaProps) {
  const { localize } = useSiteI18n();

  const posterRef = useRef<HTMLImageElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const want = useRef(false);
  const committed = useRef(false);
  const [showing, setShowing] = useState(false);
  const fit = platform === "mobile" ? "object-contain py-3" : "object-cover object-top";

  useEffect(() => {
    // A missing server-rendered image can fail before hydration attaches onError.
    const image = posterRef.current;
    if (image?.complete && image.naturalWidth === 0) restoreOriginalPoster(image);
  }, [thumb, srcSet]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    const update = () => setAllowed(videoAllowed());
    update();
    preference.addEventListener("change", update);
    connection?.addEventListener("change", update);
    return () => {
      preference.removeEventListener("change", update);
      connection?.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const v = ref.current;
    const card = v?.closest("a");
    if (!v || !card || !video || !allowed || !videoAllowed()) return;

    const restart = () => {
      setShowing(false);
      v.pause();
      if (v.readyState > 0) v.currentTime = 0;
      v.play().catch(() => {});
    };
    const handle = registerCard(card, {
      setLoaded(loaded) {
        if (!loaded) setShowing(false);
        setSrc(loaded);
      },
      setPlaying(playing) {
        want.current = playing;
        if (!playing) v.pause();
        else if (committed.current) restart();
        // Otherwise the source is still committing; the effect below starts it.
      },
    }, compact);
    // A hover-only recording may mount after pointer/focus entry already fired.
    if (card.matches(":hover, :focus-visible")) handle.engage(true);
    const engage = () => {
      // In-view autoplay may already be halfway through its loop. Entering
      // deliberately always starts the walkthrough at its first state.
      if (committed.current && want.current) restart();
      handle.engage(true);
    };
    const enter = (e: PointerEvent) => e.pointerType === "mouse" && engage();
    const leave = () => handle.engage(false);
    const focusIn = () => card.matches(":focus-visible") && engage();
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    card.addEventListener("focusin", focusIn);
    card.addEventListener("focusout", leave);
    return () => {
      // Removing a paused showcase's <video> must also stop the detached
      // decoder. A fresh registration starts only after the scheduler selects it.
      want.current = false;
      v.pause();
      if (!v.isConnected) {
        // Pausing a detached video keeps its download alive. Release it so
        // the individual page's preview can use the connection immediately.
        v.querySelectorAll("source").forEach((source) => source.removeAttribute("src"));
        v.removeAttribute("src");
        v.load();
      }
      handle.release();
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointerleave", leave);
      card.removeEventListener("focusin", focusIn);
      card.removeEventListener("focusout", leave);
    };
  }, [video, compact, allowed]);

  // <source> changes need an explicit load(); dropping them also releases the decoder.
  useEffect(() => {
    const v = ref.current;
    committed.current = src;
    if (!v) return;
    v.load();
    if (src && want.current) v.play().catch(() => {});
  }, [src, video?.mp4, video?.webm]);

  return (
    localize(<>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={posterRef}
          src={thumb}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          alt={`${name} preview`}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          onError={(event) => {
            // A tab can outlive a deployment's hashed derivatives. Retry the
            // stable original once, without a reload or a broken card image.
            restoreOriginalPoster(event.currentTarget);
          }}
          className={`absolute inset-0 size-full transition-transform duration-500 ease-site group-hover:scale-[1.02] motion-reduce:!scale-100 motion-reduce:transition-none ${fit}`}
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
          className={`pointer-events-none absolute inset-0 size-full transition-[opacity,scale] duration-200 ease-site group-hover:scale-[1.02] motion-reduce:!scale-100 motion-reduce:transition-none ${fit} ${showing ? "opacity-100" : "opacity-0"}`}
        >
          {src && <source src={video.mp4} type="video/mp4" />}
          {src && video.webm && <source src={video.webm} type="video/webm" />}
        </video>
      )}
    </>)
  );
}
