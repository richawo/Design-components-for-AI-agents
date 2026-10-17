#!/bin/bash
# usage: TRAILER="<commit trailer lines>" MSGDIR=<dir> commit-batch.sh "<pro slugs>" "<free slugs>"
# Commits each slug separately in the Pro repo, then in the public repo with only that slug's manifest and guide
# entries (via pick.mjs), and pushes both. Per-slug commit messages are read from $MSGDIR/<slug>.txt.
set -u
R=${REPO:-/home/user/Design-components-for-AI-agents}; T="$(cd "$(dirname "$0")" && pwd)"
export PICK_DIR=${PICK_DIR:-${TMPDIR:-/tmp}/review-pick}; mkdir -p "$PICK_DIR"
C=${TRAILER:?set TRAILER to the commit trailer lines}
PRO="$1"; FREE="$2"
MSGDIR=${MSGDIR:?set MSGDIR to the folder of <slug>.txt commit messages}
for s in $PRO $FREE; do [ -s "$MSGDIR/$s.txt" ] || { echo "missing message for $s"; exit 1; }; done
cd $R/registry/pro && git pull --rebase --autostash -q origin main
for s in $PRO; do git add -A "$s" && git commit -q -m "$(cat $MSGDIR/$s.txt)

$C" -- "$s" && echo "pro: $s"; done
git push -q origin main || echo "PRO PUSH FAILED"
cd $R && cp registry/pro-manifest.json $PICK_DIR/full-manifest.json && cp content/components/guides.json $PICK_DIR/full-guides.json
git pull --rebase --autostash -q origin main
for s in $PRO $FREE; do
  node $T/pick.mjs $s
  files=""; [ -d registry/free/$s ] && files="registry/free/$s"
  for ext in webp mp4; do [ -f public/previews/$s.$ext ] && files="$files public/previews/$s.$ext"; done
  git add -A $files registry/pro-manifest.json content/components/guides.json
  git commit -q -m "$(cat $MSGDIR/$s.txt)

$C" -- $files registry/pro-manifest.json content/components/guides.json && echo "public: $s"
done
git push -q origin main || echo "PUBLIC PUSH FAILED"
cp $PICK_DIR/full-manifest.json registry/pro-manifest.json; cp $PICK_DIR/full-guides.json content/components/guides.json
