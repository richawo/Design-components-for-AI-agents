/** Omit duplicate compiled bundles, retaining source identities and all mappings. */
export function compactGeneratedSourceMap(map) {
  const content = [...(map.sourcesContent ?? [])];
  let omitted = 0;
  for (let index = 0; index < (map.sources ?? []).length; index++) {
    const source = String(map.sources[index]).replaceAll("\\", "/");
    if (content[index] && /\.open-next\/(?:server-functions\/default|middleware)\/handler\.mjs$/.test(source)) {
      content[index] = null;
      omitted++;
    }
  }
  return { map: { ...map, ...(map.sourcesContent ? { sourcesContent: content } : {}) }, omitted };
}
