# Blog content and SEO

Editorial source lives in the private `richawo/Design-for-AI` repository:
`_site/blog/*.md`, `_site/config.json`, and `_site/i18n/{strings,slugs}/*.json`.
The public site reads its ignored `registry/pro/` checkout at build time.
Generated content and social cards stay out of the public Git index.

The readable generated `content.json` remains available for audits. Runtime
routes import `content-packed.json`, a gzip/base64 pack decoded once per Worker
isolate through Node zlib. This keeps the multilingual corpus below the Worker
module limit without removing text or language editions. Registry generation also
writes the ignored `@design-yaps/public-content-runtime` package in `node_modules`.
Next treats it as server external so independently compiled routes share one
packed editorial payload. Development retains the directly watched JSON bundle.
The final deployment rejects a missing or duplicated public pack. The content-pack test
checks the complete generated payload against the readable source.

Use Node 24, matching production. Run `npm run blog:translate` after changing
editorial copy. It uses the same translation provider and token protection as
Post Yaps: complete sentences retain inline formatting, code is opaque, and
names, links and identifiers survive unchanged. Runs checkpoint into the private
repository and resume from existing translations. `--locales fr,de` limits a
run; `--dry-run` reports missing units; `--seed-dir <directory>` reuses matching
translations from an existing dictionary. Published localized slugs never change
when their titles are retranslated.

For a throttled translation run, use `--workers 1 --interval-ms 1500` to reduce
parallel requests and increase spacing. Existing checkpoints resume without
retranslating completed units. If the provider still returns HTTP 429, allow a
cooldown before retrying rather than increasing request volume. The documented browser
translation workbench can preserve the same source and token checks. Clear the
provider input and verify it matches the work item; keep its unique job marker
in the copied response so the workbench rejects results from another item.

English retains `/blog/<slug>`. The other 29 languages use their own prefix.
Latin-script languages have translated ASCII slugs; other scripts retain the
English slug, following Post Yaps. Arabic uses right-to-left layout. Incomplete
editions are omitted rather than published under a misleading language URL.

Every edition renders its language and direction on the server. Its HTML has a
self canonical, reciprocal language alternates including `x-default`, translated
search snippets, Open Graph and Twitter cards, and article, FAQ and breadcrumb
structured data. Source-language aliases redirect to the stable local URL.
Language navigation and related article links work without JavaScript.

`/sitemap.xml` indexes one XML sitemap per language under `/sitemaps/`. Only
indexable HTML pages enter those files. Entries include truthful modification
dates, image URLs and language alternates. `/sitemap.md` indexes the Markdown
companions. Blog hubs, topics, pagination and articles support both `.md` URLs
and `Accept: text/markdown`; feeds live at `/blog/rss.xml` and each localised
equivalent, with `/rss.xml` retained for existing subscribers. Social images are
generated as real 1200 by 630 PNGs, with a separate 512px publisher logo.

The hub paginates after 12 articles. Each page has its own canonical. Invalid
articles, locales, topics and page numbers return a real 404. A public-only
checkout builds successfully with the blog unavailable; production builds
require the private source and complete translation coverage.

Agents can discover every language through `llms.txt` and `/sitemap.md`. The
remote MCP `get_page` tool reads the same localized hubs and articles as their
Markdown routes, including canonical provenance.

## Source-bound editorial publication

Normal daily publication, including weekends, uses the existing public-repository
Cloudflare integration, independently of GitHub Actions billing. The private hook is a
manual fallback. The public request contains hashes and owner slugs only.

Complete private source, all affected dictionaries, original evidence, current
editorial verdicts and five to ten substantive leading-page reviews per owner.
Commit `_site/publication/approved-batch.json` with scope `prepublication` and
source-bound reviews. A clean authenticated checkout runs
`npm run publication:request`, then commits and pushes only
`publication/content-request.json` to request the production pipeline.

Version-2 requests fingerprint sorted publication paths and their Git blob
identities with SHA-256. Hosted authors can derive the same value from a complete
pinned private Git tree using `publicationInputsFromGitTree`. Cloudflare computes
it from every actual blog, dictionary, asset and configuration file. Missing
large binary payloads in the author shell do not require omitting source.

Registry generation rejects changed inputs, stale approvals/rules, missing or
failed verdicts, pending editorial checks, incomplete peer review sets and a
sixth new owner dated on the same London day. Uncertain delivery resumes the same
request. Preserve original publication dates and count already published owners.
New scheduled requests use `mode: daily`. Legacy `weekday` requests remain valid
on every day for compatibility; their identities and dates must stay unchanged.

`cf:build` runs the source/locales audit, strict generation, types, tests and
production build sequentially under Node 24. Only success writes a receipt bound
to the exact sources, rulebook and request. `cf:deploy` refuses an editorial
request without that matching receipt, then applies the unchanged package guards.
Cloudflare's existing private read-only deploy key materializes the full source.

R29 can await the explicit mandatory build phase. R30/R37 remain pending only in
the delivery phase with a complete verification and failure plan. Those pending
statuses are not completed checks. Other pending checks block release. Retain
the immutable pre-publication review and a separate final delivery record.

Match the request in `/.well-known/design-build.json` and verify actual editions,
metadata, assets, links, discovery routes, MCP and licence boundaries before
marking delivered. See the hosted procedure in
`skills/design-yaps-articles/references/cloud-publishing.md`.

`npm run cf:deploy` deploys the built Worker and submits indexable sitemap URLs
to IndexNow after verifying the live build and public key file. `npm run
blog:index -- --all --dry-run` previews the URL count. The public repository's
manual IndexNow workflow can retry a failed submission. IndexNow receipt
confirms notification, not inclusion in a search index.

Run `npm run blog:audit -- --require-source --require-locales` before a production
deployment. Errors cover missing metadata, invalid publication dates, unknown
authors or topics, duplicate titles and slugs, extra H1s and broken article links.
Warnings prompt editorial review of citations, primary queries and completeness.
Dates use the owner's London calendar. Never add filler to satisfy a word count.

Keep `dateModified` truthful, provide image alt text, use H2/H3 sections, and end
FAQ sections with one H3 question per answer. Drafts must not enter feeds or
search sitemaps. Topic hubs with fewer than three posts are kept out of the index.
