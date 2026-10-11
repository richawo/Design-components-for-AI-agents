/** A null preference preserves each component's original palette. */
export const ACCENT_KEY = "dfa:accent";
export const DEFAULT_ACCENT = "#ff7a45";
export function parseAccent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hex = value.trim();
  if (/^#[\da-f]{6}$/i.test(hex)) return hex.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(hex)) return `#${[...hex.slice(1)].map(c => c + c).join("")}`.toLowerCase();
  return null;
}
export function accentInk(hex: string): "#000000" | "#ffffff" {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .179 ? "#000000" : "#ffffff";
}
