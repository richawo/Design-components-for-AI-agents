/** Apply a licensed palette default while retaining explicitly edited control values. */
export function materialDefaultProps(encoded: string | undefined, palette: Record<string, string>, overrides: Record<string, unknown>): Record<string, string> {
  if (!encoded) return {};
  let defaults: unknown;
  try { defaults = JSON.parse(encoded); } catch { return {}; }
  if (!Array.isArray(defaults)) return {};
  const props: Record<string, string> = {};
  for (const setting of defaults) {
    if (!setting || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(setting.prop) || !Object.hasOwn(palette, setting.role)) continue;
    if (!Object.hasOwn(overrides, setting.prop) || overrides[setting.prop] === setting.value) props[setting.prop] = palette[setting.role];
  }
  return props;
}
