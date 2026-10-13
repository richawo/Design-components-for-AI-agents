---
name: design-yaps-articles
description: Research, write and publish Design for AI blog articles at design.yaps.ai with buying-intent keywords, useful comparisons and SEO, AEO and GEO metadata. Use for article batches, component-library alternatives, UI-kit buying guides and design MCP comparisons. Exclude Post Yaps articles and component development.
---

# Design for AI Articles

Work in `/Users/richardawoyemi/ai-prototypes/design-components-for-ai-agents`. Maintain this skill in `skills/design-yaps-articles/` and copy it to `~/.codex/skills/design-yaps-articles/` for discovery. Read both repositories' `AGENTS.md`, `docs/BLOG.md` and `docs/DEPLOY.md` before editing publication inputs.

Editorial source belongs in the private `registry/pro/_site/blog/` checkout, with dictionaries in `_site/i18n/` and assets in `_site/assets/`. Never copy private editorial or Pro component source into public Git. Keep dated research in private `_site/research/`; it does not request a deployment.

## Select and research

Inventory published posts and drafts. Give each new URL one primary keyword and a distinct reader decision. Prioritize alternatives, price and licence questions, required workflows and concrete purchase objections. Keep selection articles distinct from existing technical how-to guides.

Search current results for each candidate phrase and inspect several strong pages. Record query, date, retrieved pages, what they explain well, what is missing and the original value the new guide adds. Separate search-result wording from verified vendor facts. Do not invent monthly volume, difficulty, ranking position or hands-on results. Follow applicable provider-discovery instructions when comparing vendors.

Build related vocabulary around the decision: framework, source ownership, installation, accessibility, dependencies, seats, client work and update rights. Treat LSI as semantic topic coverage, without claiming a special LSI score or stuffing synonyms.

Use current primary documentation for technical and competitor claims. Retain full source URLs and retrieval dates in private research. Verify Design for AI against the live catalogue and pricing, `lib/pricing.ts`, `content/docs/license.md`, `content/docs/installation.md` and actual metadata. A screen, block, primitive library and application starter are different products; describe their boundaries accurately.

## Write the answer first

- Put the main answer in the description and opening. Follow with a useful comparison table, shortlist or essential steps before detailed explanation.
- Put **Design for AI first in every product listicle and product comparison table**. Keep all its plan rows before competitor plans. In column comparisons, keep the descriptive stub first, then Design for AI as the first product column. Preserve logical order in procedures and non-product data.
- Identify the team's affiliation and describe documentation-based comparisons honestly. First position is an editorial preference. Explain relevant limitations, including missing backends, unsupported frameworks and required integration work.
- Link readers only to owned tools and articles: relative site URLs, `yaps.ai` and its subdomains. Keep competitor names as plain text. Name primary documents and the check date in a visible Sources checked section; keep external URLs in private research. Do not create fake internal source pages. The existing audit's no-outbound-citation warning is expected under this policy.
- Make complex buying guides substantial, often around 1,800 to 2,400 words when warranted. Add specific fit and limitations, licence gates, evaluation tasks, cost arithmetic or migration steps. Remove repeated conclusions, unsupported superlatives and filler. Length is a guide, not a quota.
- Compare equivalent scopes, currencies and seat allowances. Distinguish annual payment from a monthly equivalent, lifetime access from perpetual use of downloaded files, and a free core from paid templates or advanced features.
- Keep named product sections in opening-table order. Use precise internal links and self-contained FAQ answers. Never use U+2014 in new prose.

## Metadata and images

Follow current posts and the blog contract for frontmatter. Keep the primary keyword first in `keywords` and natural in the title, description, opening and a useful heading. Use London's publication date. Preserve existing slugs and dates; update `dateModified` only for substantive changes.

Use semantic Markdown tables and the existing BlogPosting, BreadcrumbList and FAQPage generation. Add `howToSteps` only for an actual procedure with exact H2 names and visible opening paragraphs. Schema must describe visible content. Do not promise AI citations, rankings, FAQ rich results or benefits from special GEO markup. Check primary search-engine guidance if discussing it.

Use existing brand-consistent cover generation or a topic-specific asset in the current visual system. Set `heroAsset`, `heroImage` and meaningful alt text when appropriate. Keep source assets private and generated `public/blog-images/` files ignored. Inspect the rendered cover and article.

## Verify and publish

Use Node 24, matching deployment. Run `npm run blog:translate` after public copy changes; inspect coverage and repair failed units before publishing. Protect names and code with existing tooling. Keep stable localized slugs and required dictionaries with each article commit. Describe machine localization accurately; coverage is not professional linguistic review.

Run `npm run blog:audit -- --require-source --require-locales`, `node scripts/build-registry.mjs --strict`, `npm run typecheck` and `npm test` under the working agreement. Check rendered content for owned links and product ordering. Inspect mobile widths around 375 to 412 pixels and desktop, including loaded covers and tables that scroll within the article.

Commit and push each coherent verified slice on the current branch. Preserve pre-existing user changes. Fetch and incorporate upstream safely before every push. Private publication inputs request a Cloudflare build through `publish-blog.yml`; a successful hook request alone is insufficient.

Confirm `/.well-known/design-build.json` identifies the intended private commit. Check live article and Markdown URLs, self canonicals, FAQ data, covers, sitemap and RSS inclusion, and representative localized pages. Check `.md` links in `llms.txt` and `/sitemap.md`. Return article links, skill path and research record, with material publication or localization limitations. Never claim ranking or indexing from deployment success.
