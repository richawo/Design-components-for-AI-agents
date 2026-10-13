import { SiteLink as Link } from "@/components/site/site-link";
import type { Metadata } from "next";
import { cataloguePath, BLOCK_LABELS } from "@/lib/catalogue-path";
import type { RegistryEntry } from "@/lib/registry-types";
import {
  Chip,
  ComponentCard,
  TierBadge,
} from "@/components/site/component-card";
import { ComponentInstall } from "@/components/site/component-install";
import { CopyButton } from "@/components/site/copy-button";
import { Toc } from "@/components/site/toc";
import { componentGuide } from "@/lib/component-guidance";
import { JsonLd } from "@/components/site/json-ld";
import { PreviewFrame } from "@/components/site/preview-frame";
import { SourceTabs } from "@/components/site/source-tabs";
import { highlight } from "@/lib/highlight";
import { fileNameFor, installText } from "@/lib/install";
import { getComponent, readSource, thumbnailFor, toCard } from "@/lib/registry";
import { CATEGORIES } from "@/lib/registry-types";
import { absoluteUrl, site } from "@/lib/site";

function seoTitle(e: NonNullable<ReturnType<typeof getComponent>>) {
  if (e.kind === "block")
    return `${e.name}: complete React + Tailwind ${e.blockType ?? "page"} block`;
  return e.platform === "mobile"
    ? `${e.name}: React Native component with AI prompt`
    : `${e.name}: ${CATEGORIES[e.category].noun} for React + Tailwind, with AI prompt`;
}

export function componentMetadata(e: RegistryEntry): Metadata {
  return {
    title: seoTitle(e),
    description: e.description,
    keywords: [
      ...e.tags,
      e.platform === "mobile" ? "react native" : "react",
      "tailwind",
      "ai prompt",
      "component",
      "ai agent",
    ],
    alternates: {
      canonical: cataloguePath(e),
      types: { "text/markdown": `${cataloguePath(e)}.md` },
    },
    openGraph: {
      type: "article",
      title: `${e.name} · ${site.name}`,
      description: e.description,
      url: absoluteUrl(cataloguePath(e)),
    },
  };
}

export async function ComponentDetail({ entry: e }: { entry: RegistryEntry }) {
  const slug = e.slug;
  const block = e.kind === "block";
  const group = block ? "Blocks" : "Components";
  const groupPath = block ? "/blocks" : "/components";
  const install = installText(e);
  const [installHtml, usageHtml] = await Promise.all([
    highlight(install, "bash"),
    highlight(e.usage, "tsx"),
  ]);

  // Keep highlighted source out of the navigation payload. The source panel
  // fetches the prebuilt free payload as it approaches the viewport.
  const prompt =
    e.tier === "free" ? ((await readSource(slug))?.prompt ?? null) : null;

  const guide = componentGuide(slug);
  const related = guide.related
    .map(getComponent)
    .filter((c): c is NonNullable<typeof c> => !!c);
  const headings = [
    ["preview", "Preview"],
    ...(block ? [["built-from", "Built from"]] : []),
    ["when-to-use", "When to use"],
    ["when-not-to-use", "When not to use"],
    ["installation", "Installation"],
    ["usage", "Usage"],
    ["integration", "Integration notes"],
    ["api", "API reference"],
    ["source", "Source and briefs"],
    ["ai-reference", "Notes for AI"],
    ...(related.length ? [["related", "Related"]] : []),
  ].map(([id, text]) => ({ id, text, level: 2 as const }));
  const cat =
    block && e.blockType
      ? { label: BLOCK_LABELS[e.blockType] }
      : CATEGORIES[e.category];
  const thumb = thumbnailFor(slug);

  return (
    <div className="mx-auto max-w-[80rem] px-5 pb-28 sm:px-8">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareSourceCode",
            name: e.name,
            description: e.description,
            url: absoluteUrl(cataloguePath(e)),
            programmingLanguage: "TypeScript",
            runtimePlatform: e.platform === "mobile" ? "React Native" : "React",
            keywords: e.tags.join(", "),
            dateCreated: e.added,
            dateModified: guide.updated ?? e.added,
            image: thumb ? absoluteUrl(thumb) : undefined,
            license:
              e.tier === "free"
                ? "https://opensource.org/licenses/MIT"
                : absoluteUrl("/docs/license"),
            isAccessibleForFree: e.tier === "free",
            codeRepository:
              e.tier === "free"
                ? `${site.github}/tree/main/registry/free/${slug}`
                : undefined,
            author: { "@type": "Organization", name: site.name, url: site.url },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: group,
                item: absoluteUrl(groupPath),
              },
              {
                "@type": "ListItem",
                position: 2,
                name: cat.label,
                item: absoluteUrl(
                  block
                    ? `/blocks#${e.blockType}`
                    : `/categories/${e.category}`,
                ),
              },
              {
                "@type": "ListItem",
                position: 3,
                name: e.name,
                item: absoluteUrl(cataloguePath(e)),
              },
            ],
          },
        ]}
      />

      <nav
        aria-label="Breadcrumb"
        className="site-in pt-10 text-[13px] text-site-fg-3"
      >
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link
              href={groupPath}
              className="rounded-sm transition-colors duration-150 hover:text-site-fg"
            >
              {group}
            </Link>
          </li>
          <li aria-hidden="true" className="opacity-60">
            /
          </li>
          <li>
            <Link
              href={
                block ? `/blocks#${e.blockType}` : `/categories/${e.category}`
              }
              className="rounded-sm transition-colors duration-150 hover:text-site-fg"
            >
              {cat.label}
            </Link>
          </li>
          <li aria-hidden="true" className="opacity-60">
            /
          </li>
          <li aria-current="page" className="text-site-fg-2">
            {e.name}
          </li>
        </ol>
      </nav>

      <header className="grid gap-8 pb-10 pt-6 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <div className="site-in flex flex-wrap items-center gap-1.5 [--i:1]">
            <TierBadge tier={e.tier} />
            <Chip className="text-site-fg-3">
              {e.platform === "mobile" ? "React Native" : "React · Tailwind v4"}
            </Chip>
            {e.dependencies.map((d) => (
              <Chip
                key={d}
                className="normal-case tracking-normal text-site-fg-3"
              >
                {d}
              </Chip>
            ))}
          </div>
          <h1 className="site-in mt-5 text-[clamp(2.25rem,1.5rem+3vw,3.75rem)] font-semibold leading-[1] tracking-[-0.05em] [--i:2]">
            <span className="site-silver-text">{e.name}</span>
          </h1>
          <p className="site-in mt-4 max-w-[62ch] text-[16px] leading-relaxed text-site-fg-2 [--i:3]">
            {e.description}
          </p>
        </div>
        <dl className="site-in grid grid-cols-3 gap-px overflow-hidden rounded-[16px] border border-white/[0.08] bg-white/[0.08] [--i:4] lg:col-span-4">
          {[
            ["Category", cat.label],
            [
              "Added",
              new Date(e.added).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }),
            ],
            ["Licence", e.tier === "free" ? "MIT" : "Pro"],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0 bg-site-raised px-4 py-3.5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-site-fg-3">
                {k}
              </dt>
              <dd className="mt-1.5 text-[14px] font-medium leading-snug text-site-fg">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <section
        id="preview"
        aria-label={`${e.name} live preview`}
        className="site-in scroll-mt-24 [--i:5]"
      >
        {e.hasSource ? (
          <PreviewFrame
            slug={slug}
            name={e.name}
            height={e.previewHeight}
            platform={e.platform}
            theme={e.theme}
            tier={e.tier}
            hasDemo={!!e.demo}
            controls={e.controls}
            usage={e.usage}
            props={e.props}
            prompt={prompt}
          />
        ) : (
          <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-site-raised">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt={`${e.name} preview`} className="w-full" />
            ) : (
              <div className="site-dots flex h-80 items-center justify-center text-[14px] text-site-fg-3">
                Live preview available on {site.url.replace("https://", "")}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="mt-14 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-16">
        <article className="min-w-0 space-y-12 sm:space-y-16">
          {block && (
            <section id="built-from" className="scroll-mt-24">
              <SectionTitle>Built from</SectionTitle>
              <p className="mt-4 text-[15px] leading-relaxed text-site-fg-2">
                These components install with the block. Each keeps its own API,
                so you can change one part of the page without rebuilding the
                composition.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {(e.components ?? [])
                  .map((id) => getComponent(id))
                  .filter(Boolean)
                  .map((child) => (
                    <Link
                      key={child!.slug}
                      href={cataloguePath(child!)}
                      className="group rounded-xl border border-site-line bg-site-raised p-4 transition-colors hover:border-site-line-2 hover:bg-site-raised-2"
                    >
                      <span className="flex items-center justify-between gap-3 text-sm font-medium">
                        {child!.name}
                        <span
                          aria-hidden="true"
                          className="transition-transform group-hover:translate-x-0.5"
                        >
                          ↗
                        </span>
                      </span>
                      <span className="mt-2 block text-xs leading-relaxed text-site-fg-2">
                        {child!.description}
                      </span>
                    </Link>
                  ))}
              </div>
            </section>
          )}

          <section id="when-to-use" className="scroll-mt-24">
            <SectionTitle>When to use</SectionTitle>
            <p className="mt-4 max-w-[72ch] text-[15px] leading-[1.85] text-site-fg-2">
              {guide.useWhen}
            </p>
          </section>
          <section id="when-not-to-use" className="scroll-mt-24">
            <SectionTitle>When not to use</SectionTitle>
            <p className="mt-4 max-w-[72ch] text-[15px] leading-[1.85] text-site-fg-2">
              {guide.avoidWhen}
            </p>
          </section>
          <section id="installation" className="scroll-mt-24">
            <SectionTitle>Installation</SectionTitle>
            <div className="mt-5">
              <ComponentInstall
                slug={slug}
                name={e.name}
                tier={e.tier}
                text={install}
                html={installHtml}
                dependencies={e.dependencies}
                platform={e.platform}
                kind={e.kind}
              />
            </div>
          </section>
          <section id="usage" className="scroll-mt-24">
            <SectionTitle>Usage</SectionTitle>
            <p className="mt-4 text-[15px] leading-relaxed text-site-fg-2">
              Import the named export into your page. The default export powers
              this library's preview.
            </p>
            <div className="mt-5 overflow-hidden rounded-2xl border border-site-line bg-site-raised">
              <div className="flex items-center justify-between gap-3 border-b border-site-line px-4 py-3">
                <span className="font-mono text-xs text-site-fg-3">
                  example.tsx
                </span>
                <CopyButton text={e.usage} label="Copy usage" />
              </div>
              <div
                tabIndex={0}
                role="region"
                aria-label={`${e.name} usage example`}
                className="overflow-auto p-4 text-[13px] leading-[1.8] sm:p-5 [&_pre]:!bg-transparent"
                dangerouslySetInnerHTML={{ __html: usageHtml }}
              />
            </div>
          </section>
          <section id="integration" className="scroll-mt-24">
            <SectionTitle>Integration notes</SectionTitle>
            <ul className="mt-4 space-y-4 text-[15px] leading-[1.85] text-site-fg-2">
              {guide.integration.map((line) => (
                <li key={line} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-3 h-px w-3 shrink-0 bg-site-fg-3"
                  />
                  <span>{inlineCode(line)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section id="api" className="scroll-mt-24">
            <SectionTitle>API reference</SectionTitle>
            <p className="mt-4 text-[15px] leading-relaxed text-site-fg-2">
              Props for the production component. Callbacks and data stay under
              your application's control.
            </p>
            <div
              tabIndex={0}
              role="region"
              aria-label={`${e.name} props table`}
              className="mt-5 overflow-x-auto rounded-2xl border border-site-line bg-site-raised"
            >
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-site-line font-mono text-[11px] text-site-fg-3">
                    <th scope="col" className="px-4 py-4 font-medium">
                      Prop
                    </th>
                    <th scope="col" className="px-4 py-4 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-4 font-medium">
                      Default
                    </th>
                    <th scope="col" className="px-4 py-4 font-medium">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {e.props.map((p) => (
                    <tr
                      key={p.name}
                      className="border-b border-site-line last:border-0"
                    >
                      <th
                        scope="row"
                        className="px-4 py-4 font-mono text-[13px] font-normal text-site-fg"
                      >
                        {p.name}
                      </th>
                      <td className="px-4 py-4 font-mono text-xs text-site-fg-2">
                        {p.type}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-site-fg-3">
                        {p.default ?? "None"}
                      </td>
                      <td className="min-w-[240px] px-4 py-4 leading-relaxed text-site-fg-2">
                        {p.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section id="source" className="scroll-mt-24">
            <SectionTitle>Source and design briefs</SectionTitle>
            <p className="mt-4 text-[15px] leading-relaxed text-site-fg-2">
              Use the source directly, or give your agent the design brief and
              JSON prompt to adapt it to your product.
            </p>
            <div className="mt-5">
              <SourceTabs
                slug={slug}
                name={e.name}
                tier={e.tier}
                fileName={fileNameFor(e)}
                initial={null}
                installText={install}
                installHtml={installHtml}
              />
            </div>
          </section>
          <section id="ai-reference" className="scroll-mt-24">
            <SectionTitle>Notes for AI</SectionTitle>
            <p className="mt-4 text-[15px] leading-[1.85] text-site-fg-2">
              Give your coding agent the Markdown reference. It includes this
              guidance, installation instructions, the usage example and prop
              contract. Pro source and briefs require your licence through the
              registry or MCP server.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <CopyButton
                text={absoluteUrl(`${cataloguePath(e)}.md`)}
                label="Copy Markdown URL"
              />
              <Link
                href={`${cataloguePath(e)}.md`}
                className="rounded-sm text-sm text-site-fg-2 underline decoration-site-line-2 underline-offset-4 transition-colors hover:text-site-fg"
              >
                Read Markdown ↗
              </Link>
              <Link
                href="/docs/agents"
                className="rounded-sm text-sm text-site-fg-2 underline decoration-site-line-2 underline-offset-4 transition-colors hover:text-site-fg"
              >
                Connect your agent ↗
              </Link>
            </div>
          </section>
          {related.length > 0 && (
            <section id="related" className="scroll-mt-24">
              <div className="flex items-end justify-between gap-4">
                <SectionTitle>
                  {block ? "Related blocks" : "Related components"}
                </SectionTitle>
                <Link
                  href={
                    block
                      ? `/blocks#${e.blockType}`
                      : `/categories/${e.category}`
                  }
                  className="rounded-sm text-sm text-site-fg-2 transition-colors hover:text-site-fg"
                >
                  Browse {cat.label.toLowerCase()} ↗
                </Link>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {related.map((r) => (
                  <ComponentCard key={r.slug} c={toCard(r)} />
                ))}
              </div>
            </section>
          )}
        </article>
        <aside className="order-first lg:sticky lg:top-24 lg:order-last">
          <div className="hidden lg:block">
            <Toc headings={headings} />
          </div>
          <nav
            aria-label="Component sections"
            className="flex flex-wrap gap-x-5 gap-y-3 border-y border-site-line py-4 text-sm text-site-fg-2 lg:hidden"
          >
            {headings.slice(1).map((h) => (
              <a
                key={h.id}
                href={`#${h.id}`}
                className="rounded-sm transition-colors hover:text-site-fg"
              >
                {h.text}
              </a>
            ))}
          </nav>
          <div className="mt-7 hidden border-t border-site-line pt-6 lg:block">
            <p className="text-xs leading-relaxed text-site-fg-3">
              {e.tier === "free"
                ? "MIT licensed source."
                : "Source included with Pro."}{" "}
              Code, design brief and JSON prompt.
            </p>
            <Link
              href="/docs/license"
              className="mt-3 inline-block rounded-sm text-xs text-site-fg-2 underline decoration-site-line-2 underline-offset-4"
            >
              Licence details
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[22px] font-medium leading-snug tracking-[-0.035em] sm:text-2xl">
      {children}
    </h2>
  );
}

function inlineCode(text: string) {
  return text.split(/(`[^`]+`)/).map((part, index) =>
    part.startsWith("`") ? (
      <code
        key={index}
        className="rounded bg-site-raised-2 px-1.5 py-0.5 font-mono text-[12px] text-site-fg"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}
