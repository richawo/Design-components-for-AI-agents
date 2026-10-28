import type { VisualStyle } from "./visual-styles";

export type CardMediaSource = {
  thumb: string | null;
  srcSet?: string;
  video: { mp4: string; webm: string | null } | null;
  compact?: boolean;
};
export type CardStylePosters = Partial<Record<VisualStyle, string>>;
export type CardStylePreviews = Partial<Record<VisualStyle, string | {
  thumb: string | null;
  video: CardMediaSource["video"];
  conveyorVideo?: CardMediaSource["video"];
}>>;

/** Select a matched poster and recording. Original media must not cover a styled card. */
export function cardStyleMedia(original: CardMediaSource, styles: CardStylePreviews | undefined, style: VisualStyle): CardMediaSource {
  const selected = style !== "original" && styles?.[style];
  if (!selected) return original;
  // A prefetched catalogue can contain the previous deployment's poster map.
  if (typeof selected === "string") return { thumb: selected, srcSet: undefined, video: null, compact: false };
  const compact = Boolean(original.compact && selected.conveyorVideo);
  return { thumb: selected.thumb, srcSet: undefined, video: compact ? selected.conveyorVideo! : selected.video, compact };
}
