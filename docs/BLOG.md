# Blog content and SEO

Editorial source lives in the private `richawo/Design-for-AI` repository:
`_site/blog/*.md`, `_site/config.json`, and `_site/i18n/{strings,slugs}/*.json`.
The public site reads its ignored `registry/pro/` checkout at build time.
Generated content and social cards stay out of the public Git index.

Use Node 24, matching production. Run `npm run blog:translate` after changing
editorial copy. It uses the same translation provider and token protection as
Post Yaps: complete sentences retain inline formatting, code is opaque, and
names, links and identifiers survive unchanged. Runs checkpoint into the private
repository and resume from existing translations. `--locales fr,de` limits a
run; `--dry-run` reports missing units; `--seed-dir <directory>` reuses matching
translations from an existing dictionary. Published localized slugs never change
when their titles are retranslated.

English retains `/blog/<slug>`. The other 29 languages use their own prefix.
Latin-script languages have translated ASCII slugs; other scripts retain the
English slug, following Post Yaps. Arabic uses right-to-left layout. Incomplete
editions are omitted rather than published under a misleading language URL.

Run `npm run blog:audit -- --require-source --require-locales` before a production
deployment. Errors cover missing metadata, invalid publication dates, unknown
authors or topics, duplicate titles and slugs, extra H1s and broken article links.
Warnings prompt editorial review of citations, primary queries and completeness.
Dates use the owner's London calendar. Never add filler to satisfy a word count.

Keep `dateModified` truthful, provide image alt text, use H2/H3 sections, and end
FAQ sections with one H3 question per answer. Drafts must not enter feeds or
search sitemaps. Topic hubs with fewer than three posts are kept out of the index.
