import type { NextConfig } from "next";

const config: NextConfig = {
  // Mobile components are written in React Native. On the web we render
  // them through react-native-web so every preview is the real code.
  turbopack: {
    resolveAlias: {
      "react-native": "react-native-web",
      // react-native-svg's web build looks up bundled assets; previews have none.
      "@react-native/assets-registry/registry": "./lib/shims/assets-registry.js",
    },
    resolveExtensions: [".web.tsx", ".web.ts", ".web.jsx", ".web.js", ".web.mjs", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
  experimental: { globalNotFound: true },
  devIndicators: false,
  agentRules: false,
  transpilePackages: ["react-native-web", "react-native-svg", "expo-blur", "expo-linear-gradient", "expo-modules-core"],
  async rewrites() {
    return { beforeFiles: [
      // Markdown companions for agents: /components/hero-editorial.md
      { source: "/components/:slug.md", destination: "/md/components/:slug" },
      { source: "/blog.md", destination: "/md/blog/en" },
      { source: "/blog/:path*.md", destination: "/md/blog/en/:path*" },
      { source: "/:locale/blog.md", destination: "/md/blog/:locale" },
      { source: "/:locale/blog/:path*.md", destination: "/md/blog/:locale/:path*" },
      { source: "/docs/:page.md", destination: "/md/page/docs/:page" },
      { source: "/categories/:page.md", destination: "/md/page/categories/:page" },
    ], fallback: [
      // Root page companions run after real sitemap/verification routes.
      { source: "/index.md", destination: "/md/page/index" },
      { source: "/:page.md", destination: "/md/page/:page" },
    ] };
  },
};

export default config;
