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
export function accentText(hex: string): string {
  // Keep badges, text and keyboard focus legible against the black site shell.
  if (accentInk(hex) === "#000000") return hex;
  return `color-mix(in srgb, ${hex} 55%, white)`;
}

// Runs before paint. Deliberately self-contained so minification cannot leave
// references to renamed module bindings inside a serialized function.
export const ACCENT_BOOTSTRAP = `try{const v=localStorage.getItem("${ACCENT_KEY}");if(/^#[\\da-f]{6}$/i.test(v||"")){const c=[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);const light=.2126*c[0]+.7152*c[1]+.0722*c[2]>.179;const r=document.documentElement.style;r.setProperty('--color-site-accent',v);r.setProperty('--color-site-on-accent',light?'#000000':'#ffffff');r.setProperty('--color-site-accent-readable',light?v:'color-mix(in srgb, '+v+' 55%, white)');}}catch{}`;
