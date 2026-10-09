import type { NextConfig } from "next";

const config: NextConfig = {
  // Mobile components are written in React Native. On the web we render
  // them through react-native-web so every preview is the real code.
  turbopack: {
    resolveAlias: { "react-native": "react-native-web" },
    resolveExtensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
  devIndicators: false,
  agentRules: false,
  transpilePackages: ["react-native-web"],
  async rewrites() {
    return [
      // Markdown companions for agents: /components/hero-editorial.md
      { source: "/components/:slug.md", destination: "/md/components/:slug" },
      { source: "/blog/:slug.md", destination: "/md/blog/:slug" },
      // ...and of every other page: /index.md, /pricing.md, /docs/agents.md, /categories/charts.md
      { source: "/index.md", destination: "/md/page/index" },
      { source: "/:page.md", destination: "/md/page/:page" },
      { source: "/:section/:page.md", destination: "/md/page/:section/:page" },
    ];
  },
};

export default config;
