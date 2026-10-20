export type Dictionary = Record<string, string>;
export const textKey = (text: string) => text.replace(/\s+/g, " ").trim();

/** Pure display inputs must be translated before an effect splits their glyphs. */
export function translateDisplay<T>(value: T, t: (text: string) => string): T {
  const line = (text: string) => text.split(/(\r?\n)/).map((part) => /\r?\n/.test(part) ? part : t(part)).join("");
  if (typeof value === "string") return line(value) as T;
  if (Array.isArray(value) && value.every((part) => typeof part === "string")) return value.map(line) as T;
  return value;
}
const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templates = new WeakMap<Dictionary, { pattern: RegExp; replacement: string; head: string }[]>();

export function translator(dictionary: Dictionary) {
  const lookup = (key: string) => Object.hasOwn(dictionary, key) ? dictionary[key] : undefined;
  let patterns = templates.get(dictionary);
  if (!patterns) {
    patterns = Object.entries(dictionary).filter(([key]) => /\{\{\d+\}\}/.test(key) && key.replace(/\{\{\d+\}\}/g, "").trim().length >= 4)
      .sort(([a], [b]) => b.length - a.length).map(([key, replacement]) => ({
        pattern: new RegExp(`^${key.split(/(\{\{\d+\}\})/).map((part) => /^\{\{\d+\}\}$/.test(part) ? "(.+?)" : escapePattern(part)).join("")}$`),
        replacement, head: key.split("{{")[0],
      }));
    templates.set(dictionary, patterns);
  }
  return (text: string): string => {
    const key = textKey(text);
    let translated = lookup(key);
    if (!translated && /^[a-z]+$/.test(key)) translated = lookup(key[0].toUpperCase() + key.slice(1))?.toLowerCase();
    if (!translated && /^[A-Z]+$/.test(key)) translated = lookup(key[0] + key.slice(1).toLowerCase())?.toUpperCase();
    if (!translated && key) for (const { pattern, replacement, head } of patterns!) {
      if (head && !key.startsWith(head)) continue;
      const match = pattern.exec(key);
      if (match) { translated = replacement.replace(/\{\{(\d+)\}\}/g, (_, index) => lookup(match[Number(index) + 1]) ?? match[Number(index) + 1]); break; }
    }
    if (!translated) return text;
    return text.replace(/\S[\s\S]*\S|\S/, () => translated);
  };
}
