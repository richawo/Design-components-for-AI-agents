import type { VisualStyle } from "./visual-styles";

export type CardStylePreviews = Partial<Record<VisualStyle, string>>;
export type CardMediaSource = {
  thumb: string | null;
  srcSet?: string;
  video: { mp4: string; webm: string | null } | null;
};

/** A recorded Original walkthrough must never cover the selected style's poster. */
export function cardStyleMedia(original: CardMediaSource, styles: CardStylePreviews | undefined, style: VisualStyle): CardMediaSource {
  const thumb = style !== "original" && styles?.[style];
  return thumb ? { thumb, srcSet: undefined, video: null } : original;
}
