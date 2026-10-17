// Stage only the given slugs' entries from the working-tree manifest and guides into HEAD's versions.
// usage: node pick.mjs slug... (prefix - to delete). Writes registry/pro-manifest.json and content/components/guides.json
// as HEAD + chosen entries, reading the full working versions that commit-batch.sh saved to $PICK_DIR.
import { execSync } from "node:child_process";
import fs from "node:fs";
const root = process.env.REPO ?? "/home/user/Design-components-for-AI-agents";
const S = (process.env.PICK_DIR ?? "/tmp/review-pick") + "/";
const slugs = process.argv.slice(2);
const head = (p) => JSON.parse(execSync(`git show HEAD:${p}`, { cwd: root, maxBuffer: 1 << 28 }).toString());
const work = (p) => JSON.parse(fs.readFileSync(`${root}/${p}`, "utf8"));
// manifest (array)
{
  const p = "registry/pro-manifest.json";
  const w = JSON.parse(fs.readFileSync(S + "full-manifest.json", "utf8"));
  const map = new Map(head(p).map((e) => [e.slug, e]));
  for (const s of slugs) { if (s.startsWith("-")) { map.delete(s.slice(1)); continue; } const e = w.find((x) => x.slug === s); if (e) map.set(s, e); }
  const order = w.map((e) => e.slug);
  const out = [...map.values()].sort((a, b) => (order.indexOf(a.slug) + 1 || 1e9) - (order.indexOf(b.slug) + 1 || 1e9));
  fs.writeFileSync(`${root}/${p}`, JSON.stringify(out, null, 2) + "\n");
}
// guides (object) - preserve working key order, HEAD values except chosen
{
  const p = "content/components/guides.json";
  const raw = fs.readFileSync(S + "full-guides.json", "utf8");
  const w = JSON.parse(raw); const h = head(p); const out = {};
  const keys = [...new Set([...Object.keys(h), ...Object.keys(w)])].sort();
  const keysInOrder = Object.keys(h).concat(Object.keys(w).filter((k) => !(k in h)));
  for (const k of keysInOrder) {
    if (slugs.includes("-" + k)) continue;
    if (slugs.includes(k)) { if (k in w) out[k] = w[k]; }
    else if (k in h) out[k] = h[k];
  }
  const indent = raw.match(/\n( +)"/)?.[1]?.length ?? 2;
  fs.writeFileSync(`${root}/${p}`, JSON.stringify(out, null, indent) + (raw.endsWith("\n") ? "\n" : ""));
  void keys;
}
