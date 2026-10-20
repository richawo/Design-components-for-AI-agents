"use client";

import { createContext, type ReactNode } from "react";
import type { treeLocalizer } from "./tree";

const English: ReturnType<typeof treeLocalizer> = {
  locale: "en", dictionary: {}, t: (text) => text,
  href: (path) => path, localize: <T,>(node: T) => node,
};

export const I18nContext = createContext(English);

/** Code stays exact even when it renders through nested React components. */
export function NoTranslation({ children }: { children: ReactNode }) {
  return <I18nContext.Provider value={English}>{children}</I18nContext.Provider>;
}
