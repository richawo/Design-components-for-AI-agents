/** Select an installation default without duplicating the licensed source packs. */
export function selectStyleTheme(source, theme) {
  if (theme === "light") return source;
  const json = JSON.parse(source.promptJson), style = json.visualStyle;
  const palette = style?.themes?.[theme];
  if (!palette) throw new Error("This style does not include the requested theme");
  const defaults = `\n:where([data-dfa-style="crayon"]){--dfa-crayon-scheme:${theme};${Object.entries(palette).map(([role,value])=>`--dfa-crayon-${role === "onInk" ? "on-ink" : role}:${value};`).join("")}}`;
  const css = source.styleCss + defaults;
  let code = source.code;
  if (style.platform === "mobile") {
    const marker = 'const DFA_CRAYON_THEME = "light" as "light" | "dark";';
    if (!code.includes(marker)) throw new Error("Native style is missing its theme default");
    code = code.replace(marker, 'const DFA_CRAYON_THEME = "dark" as "light" | "dark";');
  } else {
    const marker = "const DFA_LICENSED_VISUAL_CSS = " + JSON.stringify(source.styleCss) + ";";
    if (!code.includes(marker)) throw new Error("Web style is missing its scoped material");
    code = code.replace(marker, "const DFA_LICENSED_VISUAL_CSS = " + JSON.stringify(css) + ";");
  }
  return {...source, code, styleCss:css, prompt:source.prompt + `\n\nSelected Crayon theme: ${theme}. Both themes remain available; preserve host theme overrides.`, promptJson:JSON.stringify({...json,visualStyle:{...style,appearance:theme,palette}},null,2)};
}
