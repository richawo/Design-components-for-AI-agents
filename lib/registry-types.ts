export type Tier = "free" | "pro";
export type Platform = "web" | "mobile";

export const CATEGORIES = {
  // Key order is the gallery order (docs/CATALOGUE_ROADMAP.md section 1). Keep
  // scripts/build-registry.mjs CATEGORIES in sync.
  // Lead
  hero: { label: "Heroes", noun: "hero section", blurb: "First impressions with a point of view: editorial headlines, live product, kinetic type." },
  ai: { label: "AI chat & assistants", noun: "AI chat interface", blurb: "Chat threads, composers, streaming and reasoning states, citations, model pickers, voice mode." },
  agents: { label: "Agent interfaces", noun: "agent interface", blurb: "Tool calls, plans, approvals, run traces, diffs, task boards and subagent trees." },
  // Marketing sections
  backgrounds: { label: "Backgrounds & shaders", noun: "background", blurb: "Shader fields, grain, dither, grids and patterns that sit behind content." },
  features: { label: "Features & bento", noun: "feature section", blurb: "Bento grids, tabbed previews, sticky scroll stories, integrations and spec sheets that show instead of tell." },
  pricing: { label: "Pricing", noun: "pricing section", blurb: "Pricing that reads like a decision, not a spreadsheet." },
  "social-proof": { label: "Social proof", noun: "testimonial and logo section", blurb: "Testimonials, logo walls, marquees and numbers people actually believe." },
  cta: { label: "Calls to action", noun: "call-to-action block", blurb: "Closers, waitlists and newsletter sign-ups with some nerve." },
  headers: { label: "Headers & menus", noun: "header", blurb: "Site headers, mega menus, mobile menus and announcement strips." },
  footers: { label: "Footers", noun: "footer", blurb: "Footers that close a page properly: columns, wordmarks, newsletters and status." },
  content: { label: "Content", noun: "content section", blurb: "FAQs, changelogs, timelines, team, comparisons and long-form layouts." },
  media: { label: "Media & galleries", noun: "media component", blurb: "Carousels, galleries, lightboxes, video and audio players, built without network media." },
  portfolio: { label: "Portfolio", noun: "portfolio section", blurb: "Work indexes and case-study layouts with a designer's eye." },
  commerce: { label: "Commerce", noun: "commerce component", blurb: "Product cards, carts and checkout moments." },
  auth: { label: "Auth", noun: "sign-in component", blurb: "Sign in, sign up, one-time codes, magic links, passkeys and SSO: the first thing a customer touches." },
  // Visual
  text: { label: "Text effects", noun: "text effect", blurb: "Type that moves with intent: decoding, rolling, weight waves and reveals." },
  "three-d": { label: "3D & WebGL", noun: "3D scene", blurb: "Three.js scenes that stay tasteful, responsive and light enough to ship on a landing page." },
  pixel: { label: "Pixel & generative", noun: "pixel animation", blurb: "Dot-matrix displays, pixel sprites and generative textures that add character without noise." },
  effects: { label: "Cursors & effects", noun: "cursor and effect", blurb: "Custom cursors, multiplayer presence, spotlights, tilt and animated borders." },
  // Controls
  buttons: { label: "Buttons & links", noun: "button", blurb: "Buttons, split buttons, CTAs, links and hold or press interactions." },
  inputs: { label: "Inputs", noun: "input", blurb: "Text fields, search bars, number scrubbers, tags, sliders, colour pickers and file upload." },
  selects: { label: "Selects & toggles", noun: "select and toggle", blurb: "Selects, comboboxes, multi-selects, switches, segmented controls, checkboxes and radios." },
  "date-time": { label: "Dates & calendars", noun: "date and calendar", blurb: "Date and range pickers, month and week calendars, booking slots." },
  forms: { label: "Forms", noun: "form", blurb: "Composed forms people actually finish: wizards, surveys, contact and settings forms." },
  // Surfaces & feedback
  overlays: { label: "Dialogs & overlays", noun: "dialog and overlay", blurb: "Dialogs, sheets, drawers, popovers, tooltips, dropdown and context menus." },
  feedback: { label: "Feedback & status", noun: "feedback and status", blurb: "Toasts, alerts, notifications, empty states, loaders and skeletons." },
  progress: { label: "Progress & usage", noun: "progress and usage", blurb: "Progress bars, rings, gauges and AI usage and quota meters." },
  cards: { label: "Cards & profiles", noun: "card", blurb: "Standalone cards: profiles, stacks, tickets, swipe decks, hover cards." },
  primitives: { label: "Primitives", noun: "UI primitive", blurb: "The smallest parts: avatars, badges, keycaps, dividers." },
  // App UI
  navigation: { label: "Navigation", noun: "navigation component", blurb: "In-app navigation: tabs, sidebars, docks, breadcrumbs, pagination, toolbars." },
  onboarding: { label: "Onboarding & steppers", noun: "onboarding", blurb: "Steppers, setup checklists, product tours." },
  app: { label: "Dashboards & app UI", noun: "app interface", blurb: "Dashboards, settings, API keys, audit logs: the product behind the site." },
  data: { label: "Tables & lists", noun: "table and list", blurb: "Data tables, editable grids, file trees, kanban boards, inbox lists." },
  charts: { label: "Charts & maps", noun: "chart", blurb: "Financial-grade charts, heatmaps, funnels, sankeys and dot maps, with motion that explains the data." },
  // Platforms
  mobile: { label: "Mobile", noun: "React Native screen", blurb: "React Native screens and parts for iOS and Android, previewed live on the web." },
} as const;

export type Category = keyof typeof CATEGORIES;

export interface PropDoc {
  name: string;
  type: string;
  default?: string;
  description: string;
}

/**
 * A scripted walkthrough of the component, in the scripts/rec.mjs step DSL.
 * Targets are `@name`, meaning the element with `data-demo="name"`. It plays
 * live on the component page (with a drawn cursor) and is recorded into the
 * gallery card's hover video. See docs/COMPONENT_SPEC.md "Demo script".
 */
export interface DemoScript {
  /** e.g. ["wait:500", "hover:@send", "click", "wait:900"]. 3–8 s in total. */
  steps: string[];
  /** Replay after a pause on the component page. Recordings play once. */
  loop?: boolean;
}

export type ControlKind = "toggle" | "slider" | "select" | "segmented" | "color" | "text" | "action";
export type ControlValue = string | number | boolean;
export type ControlOption = ControlValue | { value: ControlValue; label: string };

/**
 * One tunable prop in the Customize panel under the preview. Values are
 * merged over the demo's own props. See docs/COMPONENT_SPEC.md "Controls".
 */
export interface ComponentControl {
  /** A prop of the named export (documented in meta.props), or "$replay" for an action that replays the demo. */
  prop: string;
  label: string;
  kind: ControlKind;
  /** The value the demo renders with. Required for every kind except action. */
  default?: ControlValue;
  /** slider */
  min?: number;
  max?: number;
  step?: number;
  /** slider: shown after the value, e.g. "ms" or "px". */
  unit?: string;
  /** select / segmented choices, colour swatches, or one action button each. */
  options?: ControlOption[];
  /** action without options: the value its single button sets. */
  value?: ControlValue;
  /** Controls sharing a group sit together under its heading. */
  group?: string;
  /** Remount the component when this changes (for props read only on mount, such as defaultX). */
  remount?: boolean;
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
  /** Scripted walkthrough for the live preview and the card video. */
  demo?: DemoScript;
  /** Tunable props shown under the preview (max 12). */
  controls?: ComponentControl[];
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
