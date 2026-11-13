"use client";

import { Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cardStyleMedia, type CardMediaSource, type CardStylePreviews } from "@/lib/card-style-media";
import { useComponentStyle } from "./component-style";
import { useBlogExampleControls } from "./blog-example-controls";

type Props = {
  media: CardMediaSource;
  styles?: CardStylePreviews;
  name: string;
  labels: { play: string; retry: string; error: string };
};

export function BlogRecording({ media, styles, name, labels }: Props) {
  const { visualStyle, styleTheme } = useComponentStyle();
  const selected = cardStyleMedia(media, styles, visualStyle, styleTheme);
  return <Recording key={selected.video?.mp4 ?? selected.thumb} media={selected} name={name} labels={labels} />;
}

function Recording({ media, name, labels }: Omit<Props, "styles">) {
  const ready = useBlogExampleControls();
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);

  useEffect(() => {
    const video = player.current;
    if (!playing || !video) {
      if (moveFocus.current) button.current?.focus({ preventScroll: true });
      moveFocus.current = false;
      return;
    }
    if (moveFocus.current) video.focus({ preventScroll: true });
    moveFocus.current = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) video.pause();
    });
    const pauseInBackground = () => { if (document.hidden) video.pause(); };
    observer.observe(video);
    document.addEventListener("visibilitychange", pauseInBackground);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", pauseInBackground);
    };
  }, [playing]);

  if (!media.thumb) return null;
  const restoreOriginal = () => { if (media.srcSet) setUseOriginal(true); };
  return (
    <div className="blog-recording">
      {playing && media.video ? (
        <video
          ref={player}
          aria-label={name}
          autoPlay
          muted
          controls
          playsInline
          poster={media.thumb}
          src={media.video.mp4}
          onError={() => {
            moveFocus.current = document.activeElement === player.current;
            setPlaying(false);
            setFailed(true);
          }}
        />
      ) : (
        <>
          <img
            src={media.thumb}
            ref={(image) => { if (image?.complete && image.naturalWidth === 0) restoreOriginal(); }}
            srcSet={useOriginal ? undefined : media.srcSet}
            sizes="(min-width: 70rem) 51rem, (min-width: 61rem) 67vw, 94vw"
            alt={name}
            width={1280}
            height={800}
            loading="lazy"
            decoding="async"
            onError={restoreOriginal}
          />
          {media.video && ready && (
            <button
              ref={button}
              type="button"
              className="blog-play-overlay"
              onClick={(event) => {
                moveFocus.current = document.activeElement === event.currentTarget;
                setFailed(false);
                setPlaying(true);
              }}
            >
              {failed ? <RotateCcw size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
              {failed ? labels.retry : labels.play}
            </button>
          )}
          {failed && <span role="status" className="blog-media-error">{labels.error}</span>}
        </>
      )}
    </div>
  );
}
