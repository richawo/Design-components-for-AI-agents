# Blog content and SEO

Editorial source lives in the private `richawo/Design-for-AI` repository:
`_site/blog/*.md`, `_site/config.json`, and `_site/i18n/{strings,slugs}/*.json`.
The public site reads its ignored `registry/pro/` checkout at build time.
Generated content and social cards stay out of the public Git index.

The readable generated `content.json` remains available for audits. Runtime
routes import `content-packed.json`, a gzip/base64 pack decoded once per Worker
isolate through Node zlib. This keeps the multilingual corpus below the Worker
module limit without removing text or language editions. The content-pack test
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
cooldown before retrying rather than increasing request volume.

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

Private `_site/` changes trigger the private repository's publishing workflow.
It uses a scoped Cloudflare deployment hook stored as a GitHub secret; the hook
URL must never appear in public source or logs. Production builds run the blog
audit and tests before deploying. `/.well-known/design-build.json` identifies
the public and private commits used to build the site.

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
