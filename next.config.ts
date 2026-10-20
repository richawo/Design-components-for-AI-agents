import type { NextConfig } from "next";

const config: NextConfig = {
  // Mobile components are written in React Native. On the web we render
  // them through react-native-web so every preview is the real code.
  turbopack: {
    rules: {
      "*.tsx": { condition: { path: /(?:^|[/\\])registry[/\\]/ }, loaders: ["./scripts/localize-preview-loader.cjs"] },
    },
    resolveAlias: {
      "react-native": "react-native-web",
      // react-native-svg's web build looks up bundled assets; previews have none.
      "@react-native/assets-registry/registry":
        "./lib/shims/assets-registry.js",
    },
    resolveExtensions: [
      ".web.tsx",
      ".web.ts",
      ".web.jsx",
      ".web.js",
      ".web.mjs",
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
      ".mjs",
      ".json",
    ],
  },
  // Match native preview resolution when the supported webpack compiler is used.
  webpack(config) {
    config.module.rules.push({ test: /registry[/\\].*\.tsx$/, use: [{ loader: `${process.cwd()}/scripts/localize-preview-loader.cjs` }] });
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-native$": "react-native-web",
      "@react-native/assets-registry/registry": `${process.cwd()}/lib/shims/assets-registry.js`,
    };
    config.resolve.extensions = [...new Set([
      ".web.tsx", ".web.ts", ".web.jsx", ".web.js", ".web.mjs",
      ...config.resolve.extensions,
    ])];
    return config;
  },
  experimental: { globalNotFound: true },
  devIndicators: false,
  agentRules: false,
  transpilePackages: [
    "react-native-web",
    "react-native-svg",
    "expo-blur",
    "expo-linear-gradient",
    "expo-modules-core",
  ],
  async rewrites() {
    return {
      beforeFiles: [
        // Markdown companions for agents: /components/hero-editorial.md
        // These root companions must precede the localized catch-all route.
        { source: "/index.md", destination: "/md/page/index" },
        { source: "/:page(components|blocks|pricing|docs|account).md", destination: "/md/page/:page" },
        { source: "/components/:slug.md", destination: "/md/components/:slug" },
        { source: "/blocks/:slug.md", destination: "/md/blocks/:slug" },
        { source: "/blog.md", destination: "/md/blog/en" },
        { source: "/blog/:path*.md", destination: "/md/blog/en/:path*" },
        { source: "/:locale/blog.md", destination: "/md/blog/:locale" },
        {
          source: "/:locale/blog/:path*.md",
          destination: "/md/blog/:locale/:path*",
        },
        { source: "/:locale/index.md", destination: "/md/localized/:locale/index" },
        { source: "/:locale/:section(components|blocks|categories|docs)/:slug.md", destination: "/md/localized/:locale/:section/:slug" },
        { source: "/:locale/:page(components|blocks|pricing|docs|account).md", destination: "/md/localized/:locale/:page" },
        { source: "/docs/:page.md", destination: "/md/page/docs/:page" },
        {
          source: "/categories/:page.md",
          destination: "/md/page/categories/:page",
        },
      ],
      fallback: [
        // Root page companions run after real sitemap/verification routes.
        { source: "/index.md", destination: "/md/page/index" },
        { source: "/:page.md", destination: "/md/page/:page" },
      ],
    };
  },
};

export default config;
