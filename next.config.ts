import type { NextConfig } from "next";

// Until a custom domain is attached, a Vercel deployment should link to
// itself (install commands, canonical URLs, registry items), not to a domain
// that doesn't point at it yet. NEXT_PUBLIC_SITE_URL always wins.
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (vercelUrl ? `https://${vercelUrl}` : "");

const config: NextConfig = {
  ...(siteUrl ? { env: { NEXT_PUBLIC_SITE_URL: siteUrl } } : {}),
  // Mobile components are written in React Native. On the web we render
  // them through react-native-web so every preview is the real code.
  turbopack: {
    resolveAlias: { "react-native": "react-native-web" },
    resolveExtensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
  devIndicators: false,
  agentRules: false,
  // Route handlers read generated sources from disk at request time.
  outputFileTracingIncludes: {
    "/api/**": ["./registry/__generated__/**/*"],
    "/r/pro/**": ["./registry/__generated__/r-pro/**/*"],
    "/md/**": ["./registry/__generated__/**/*", "./content/**/*"],
  },
  transpilePackages: ["react-native-web"],
  async rewrites() {
    return [
      // Markdown companions for agents: /components/hero-editorial.md
      { source: "/components/:slug.md", destination: "/md/components/:slug" },
      { source: "/blog/:slug.md", destination: "/md/blog/:slug" },
    ];
  },
};

export default config;
