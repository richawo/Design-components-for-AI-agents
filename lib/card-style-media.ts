import type { StyleTheme, VisualStyle } from "./visual-styles";

export type CardMediaSource = {
  thumb: string | null;
  srcSet?: string;
  video: { mp4: string; webm: string | null } | null;
  compact?: boolean;
};
export type CardStylePosters = Partial<Record<VisualStyle, string>>;
export type RecordedStyleMedia = {
  thumb: string | null;
  video: CardMediaSource["video"];
  conveyorVideo?: CardMediaSource["video"];
};
export type ThemedStyleMedia = RecordedStyleMedia & {themes?:Partial<Record<StyleTheme, RecordedStyleMedia>>};
export type CardStylePreviews = Partial<Record<VisualStyle, string | ThemedStyleMedia>>;

/** Select a matched poster and recording. Original media must not cover a styled card. */
export function cardStyleMedia(original: CardMediaSource, styles: CardStylePreviews | undefined, style: VisualStyle, theme:StyleTheme="light"): CardMediaSource {
  const selected = style !== "original" && styles?.[style];
  if (!selected) return original;
  // A prefetched catalogue can contain the previous deployment's poster map.
  if (typeof selected === "string") return { thumb: selected, srcSet: undefined, video: null, compact: false };
  const themed=theme==="dark"?selected.themes?.dark??selected:selected;
  const compact = Boolean(original.compact && themed.conveyorVideo);
  return { thumb: themed.thumb, srcSet: undefined, video: compact ? themed.conveyorVideo! : themed.video, compact };
}
