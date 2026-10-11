"use client";

import { MotionConfig } from "motion/react";

/** All site navigation and shared layout transitions follow the system preference. */
export function SiteMotion({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
