#!/bin/bash
# usage: save-wip.sh <slug>...
# Parks unfinished rebuilds without shipping them: writes registry/pro/_wip/<slug>/ (the component diff against
# HEAD, the working guides.json entry and any changed pro-50 probe), then restores the slug to HEAD in both repos.
# Resume with: git -C registry/pro apply _wip/<slug>/component.patch, then copy guide.json/probe.mjs back.
set -eu
R=${REPO:-/home/user/Design-components-for-AI-agents}
for s in "$@"; do
  W=$R/registry/pro/_wip/$s; mkdir -p "$W"
  git -C "$R/registry/pro" add -N "$s" 2>/dev/null || true
  git -C "$R/registry/pro" diff HEAD --binary -- "$s" > "$W/component.patch"
  node -e 'const g=require(process.argv[1]); const e=g[process.argv[2]]; if(e) require("fs").writeFileSync(process.argv[3], JSON.stringify(e,null,2)+"\n")' \
    "$R/content/components/guides.json" "$s" "$W/guide.json"
  p=$R/tests/browser/pro-50/$s.mjs
  if [ -f "$p" ] && ! git -C "$R" diff --quiet -- "tests/browser/pro-50/$s.mjs"; then cp "$p" "$W/probe.mjs"; git -C "$R" checkout -- "tests/browser/pro-50/$s.mjs"; fi
  git -C "$R/registry/pro" checkout HEAD -- "$s"
  for ext in webp mp4; do git -C "$R" checkout -- "public/previews/$s.$ext" 2>/dev/null || true; done
  echo "parked $s ($(wc -l < "$W/component.patch") patch lines)"
done
