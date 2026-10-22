# Hosted Design Yaps publication

The connected GitHub app already authorizes both repositories. A missing Git token
in a hosted shell is not a reason to copy a personal token or stop at a file-read
preflight. Use the existing connector to materialize a pinned private snapshot.

## Materialize source without a shell credential

1. Clone the public repository anonymously at its observed main revision. Use
   Node 24 and `npm ci`. Read its AGENTS.md, blog/deploy docs and article skill.
2. Through the connected GitHub tool, GET
   `https://api.github.com/repos/richawo/Design-for-AI/git/ref/heads/main`.
   Retain its exact commit SHA. GET `git/trees/<commit>?recursive=1` in that
   repository. Reject a truncated tree; enumerate subtrees if needed.
3. Create a local manifest `{repository:"richawo/Design-for-AI",commit,files}`.
   Each files item has the API tree's exact path, mode, type and blob sha.
   Include all regular files outside historical `_site/research/` bulk. Include
   current rules, queue, opportunity system, guidance inventory, selected batch
   research and every file referenced by its current approval. Retain the excluded
   historical paths and hashes in the manifest. Do not omit components, source
   metadata, prompts, blog files, assets, dictionaries, licences or draft inventory.
4. Start `node scripts/materialize-connected-pro.mjs registry/pro manifest.json`
   with an open stdin in a new empty private snapshot directory. Do not overwrite
   a checkout. Fetch each selected Git blob through the connected GitHub tool's
   generic GET, using its API tree url. Parse the returned JSON and retain the
   original base64 Git blob response. The generic Git blob endpoint preserves
   binary assets; the decoded text wrapper is unsuitable for binary data.
5. Batch independent connector reads. Deliver JSON lines `{path,blob}` directly
   to the materializer's stdin without printing source or credentials into chat.
   Finish with `{finish:true}`. The helper rejects changed bytes, traversal,
   symlinks, reserved metadata, duplicate entries and incomplete streams. It
   records a verified `.connected-pro-snapshot.json` and read-only Git revision
   metadata for existing build provenance. This is not an authenticated checkout.
6. Run generation, types, tests and the production build from the public root.
   Do not run `pro:sync` on a connector snapshot. That command belongs to the real
   Cloudflare checkout, where the existing private read-only deploy key is present.
   A snapshot's explicit file identities are the working-source evidence. Keep
   drafts separate until all applicable checks and affected editions are complete.

## Write and request publication

Use the connected GitHub Git Data operations to commit selected private paths:
create blobs, create a tree based on the observed current tree, create a commit
with that main head as parent, then update main using the expected old SHA.
Never force-push. On a concurrent head change, reread and preserve the other work.
Keep coherent source, research and localization checkpoints small.

After the final private source and approvals are committed, refresh the snapshot
at that observed commit and verify it. Run
`npm run publication:request -- --connected-snapshot`. The flag validates every
materialized source blob before using the private revision. A local authenticated
checkout uses the command without this flag and requires a clean publication tree.
Commit the generated public `publication/content-request.json` through the same
GitHub connector, preserving the latest public main. No GitHub Actions job or
new deployment credential is needed. This request starts the existing Cloudflare
production pipeline.

Verify the matching request in `/.well-known/design-build.json`, actual source and
localized HTML/Markdown, metadata and visible structured data, assets, internal
links, feeds/sitemaps, MCP reads and anonymous Pro guards. Record source identities
and failures. A successful schedule, commit, hook or IndexNow notification does not
prove delivery or indexing. Do not claim a local run proves a hosted run.

## Daily decisions

Read Richard's editable cloud queue and the current repository checklist. Repair
existing factual issues first, then select at most five distinct ready owners.
Count new articles already published on the current London date across retries.
Stop below five when quality or required translation, source or execution checks
remain blocked. Preserve the same request identity after an uncertain delivery.
Complete the maintained official Google guidance review at least weekly.
