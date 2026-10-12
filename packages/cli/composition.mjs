/** Resolve first so a missing or cyclic block never leaves a half-installed project. */
export function installationOrder(requested, catalogue) {
  const done = new Set(),
    active = new Set(),
    result = [];
  const bySlug = new Map(catalogue.map((entry) => [entry.slug, entry]));
  const visit = (slug) => {
    if (done.has(slug)) return;
    if (active.has(slug)) throw new Error(`Circular block dependency: ${slug}`);
    const entry = bySlug.get(slug);
    if (!entry) throw new Error(`Unknown component dependency: ${slug}`);
    active.add(slug);
    for (const dependency of entry.components ?? []) visit(dependency);
    active.delete(slug);
    done.add(slug);
    result.push(entry);
  };
  for (const slug of requested) visit(slug);
  return result;
}
