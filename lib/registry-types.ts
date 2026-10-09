export type Tier = "free" | "pro";
export type Platform = "web" | "mobile";

export const CATEGORIES = {
  charts: { label: "Charts & data", noun: "chart", blurb: "Financial-grade charts with crosshairs, tooltips and motion that explains the data." },
  "three-d": { label: "3D & WebGL", noun: "3D scene", blurb: "Three.js scenes that stay tasteful, responsive and light enough to ship on a landing page." },
  pixel: { label: "Pixel & generative", noun: "pixel animation", blurb: "Dot-matrix displays, pixel sprites and generative textures that add character without noise." },
  hero: { label: "Heroes", noun: "hero section", blurb: "First impressions with a point of view: editorial headlines, live product, kinetic type." },
  pricing: { label: "Pricing", noun: "pricing section", blurb: "Pricing that reads like a decision, not a spreadsheet." },
  features: { label: "Features", noun: "feature section", blurb: "Bento grids, sticky scroll stories and spec sheets that show instead of tell." },
  "social-proof": { label: "Social proof", noun: "testimonial and logo section", blurb: "Testimonials, logo walls and numbers people actually believe." },
  cta: { label: "Calls to action", noun: "call-to-action block", blurb: "Closers, waitlists and newsletter sign-ups with some nerve." },
  headers: { label: "Headers", noun: "header", blurb: "Site headers and navigation bars: hairline, floating, morphing mega menus and announcement strips." },
  footers: { label: "Footers", noun: "footer", blurb: "Footers that close a page properly: columns, wordmarks, newsletters and status." },
  navigation: { label: "Navigation", noun: "navigation component", blurb: "Menus, breadcrumbs, tabs and the parts that move people around." },
  content: { label: "Content", noun: "content section", blurb: "FAQs, changelogs, blog indexes and long-form layouts." },
  ai: { label: "AI interfaces", noun: "AI interface", blurb: "Chat threads, prompt composers, agent timelines and streaming text." },
  app: { label: "App UI", noun: "app interface", blurb: "Dashboards, tables, settings and boards for the product behind the site." },
  auth: { label: "Auth", noun: "sign-in component", blurb: "Sign in, sign up, one-time codes, magic links, passkeys and SSO: the first thing a customer touches." },
  forms: { label: "Forms & inputs", noun: "form", blurb: "Inputs, composers and forms people actually finish." },
  text: { label: "Text effects", noun: "text effect", blurb: "Type that moves with intent: decoding, rolling, weight waves and reveals." },
  portfolio: { label: "Portfolio", noun: "portfolio section", blurb: "Work indexes and case-study layouts with a designer's eye." },
  commerce: { label: "Commerce", noun: "commerce component", blurb: "Product cards, carts and checkout moments." },
  primitives: { label: "Primitives", noun: "UI primitive", blurb: "Buttons, toasts, empty states: the small parts everything else is built from." },
  mobile: { label: "Mobile", noun: "React Native screen", blurb: "React Native screens and parts for iOS and Android, previewed live on the web." },
} as const;

export type Category = keyof typeof CATEGORIES;

export interface PropDoc {
  name: string;
  type: string;
  default?: string;
  description: string;
}

/** The contents of a component's meta.json. */
export interface ComponentMeta {
  slug: string;
  name: string;
  tier: Tier;
  platform: Platform;
  category: Category;
  /** One sentence, 110–160 characters. Used as the meta description. */
  description: string;
  tags: string[];
  /** npm packages beyond react / react-dom (and react-native for mobile). */
  dependencies: string[];
  /** Dominant surface of the default demo. */
  theme: "light" | "dark";
  /** Height of the preview frame at desktop width, in px. */
  previewHeight: number;
  /** A short usage example. */
  usage: string;
  props: PropDoc[];
  added: string;
  /** Drafts are hidden from the site and registry until they meet the bar. */
  status?: "draft";
}

/** The contents of a component's prompt.json. */
export interface JsonPrompt {
  component: string;
  intent: string;
  platform: Platform;
  stack: Record<string, string>;
  layout: Record<string, unknown>;
  typography: Record<string, unknown>;
  color: Record<string, unknown>;
  motion: Record<string, unknown>;
  responsive: Record<string, unknown>;
  accessibility: string[];
  content: Record<string, unknown>;
  avoid: string[];
}

export interface RegistryEntry extends ComponentMeta {
  /** True when the component source is available to this build. */
  hasSource: boolean;
}

export interface ComponentSource {
  slug: string;
  code: string;
  prompt: string;
  promptJson: string;
}
