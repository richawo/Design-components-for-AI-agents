import guides from "@/content/components/guides.json";

export interface ComponentGuide {
  updated?: string;
  useWhen: string;
  avoidWhen: string;
  integration: string[];
  related: string[];
}

const catalogue: Record<string, ComponentGuide> = guides;

/** Public editorial guidance. Pro code and design briefs stay behind entitlement checks. */
export function componentGuide(slug: string): ComponentGuide {
  const guide = Object.hasOwn(catalogue, slug) ? catalogue[slug] : undefined;
  if (!guide) throw new Error(`Missing public component guidance: ${slug}`);
  return guide;
}

export function guideMarkdown(guide: ComponentGuide): string[] {
  return [
    "## When to use",
    "",
    guide.useWhen,
    "",
    "## When not to use",
    "",
    guide.avoidWhen,
    "",
    "## Integration notes",
    "",
    ...guide.integration.map((line) => `- ${line}`),
    "",
  ];
}
