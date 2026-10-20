import type { ComponentControl } from "@/lib/registry-types";
import { formatLocale } from "./routing";

const requestedLocale = (locale: string) => formatLocale(locale === "en" ? "en-US" : locale);

/** Keep a demo's locale selector and its displayed values in agreement. */
export function previewControls(controls: ComponentControl[], locale: string) {
  if (locale === "en") return controls;
  const requested = requestedLocale(locale);
  return controls.map((control) => control.prop === "locale" && control.options?.some((option) => (typeof option === "object" ? option.value : option) === requested)
    ? { ...control, default: requested }
    : control);
}

export function previewFormatLocale(controls: ComponentControl[], locale: string) {
  const selected = previewControls(controls, locale).find((control) => control.prop === "locale")?.default;
  return typeof selected === "string" ? selected : requestedLocale(locale);
}
