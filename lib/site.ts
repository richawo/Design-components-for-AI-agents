export const site = {
  name: "Design for AI",
  shortName: "Design for AI",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://design.yaps.ai").replace(/\/$/, ""),
  tagline: "Design components for AI agents",
  description:
    "Precise, responsive React, Tailwind and React Native components, each with code, a prompt and a JSON prompt, so your AI agent ships sites that don't look like AI slop.",
  github: "https://github.com/richawo/Design-components-for-AI-agents",
  twitter: "@yapsai",
  email: "hello@yaps.ai",
};

export const absoluteUrl = (path = "/") => `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
