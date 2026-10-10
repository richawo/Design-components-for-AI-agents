// Shared with yaps.ai and Post Yaps. English keeps its existing root URLs.
const rows = [
  ["en", "en", "en_US", "English"],
  ["es", "es-ES", "es_ES", "Español"], ["fr", "fr-FR", "fr_FR", "Français"],
  ["de", "de-DE", "de_DE", "Deutsch"], ["ja", "ja-JP", "ja_JP", "日本語", false],
  ["pt-br", "pt-BR", "pt_BR", "Português (Brasil)", true, "pt"],
  ["ru", "ru-RU", "ru_RU", "Русский", false], ["it", "it-IT", "it_IT", "Italiano"],
  ["nl", "nl-NL", "nl_NL", "Nederlands"], ["pl", "pl-PL", "pl_PL", "Polski"],
  ["sv", "sv-SE", "sv_SE", "Svenska"], ["fi", "fi-FI", "fi_FI", "Suomi"],
  ["da", "da-DK", "da_DK", "Dansk"], ["ro", "ro-RO", "ro_RO", "Română"],
  ["cs", "cs-CZ", "cs_CZ", "Čeština"], ["hr", "hr-HR", "hr_HR", "Hrvatski"],
  ["sl", "sl-SI", "sl_SI", "Slovenščina"], ["sk", "sk-SK", "sk_SK", "Slovenčina"],
  ["hu", "hu-HU", "hu_HU", "Magyar"], ["uk", "uk-UA", "uk_UA", "Українська", false],
  ["bg", "bg-BG", "bg_BG", "Български", false], ["el", "el-GR", "el_GR", "Ελληνικά", false],
  ["et", "et-EE", "et_EE", "Eesti"], ["lv", "lv-LV", "lv_LV", "Latviešu"],
  ["lt", "lt-LT", "lt_LT", "Lietuvių"], ["mt", "mt-MT", "mt_MT", "Malti"],
  ["ar", "ar", "ar_AR", "العربية", false], ["ko", "ko-KR", "ko_KR", "한국어", false],
  ["vi", "vi-VN", "vi_VN", "Tiếng Việt"], ["zh-hans", "zh-Hans", "zh_CN", "简体中文", false, "zh-CN"],
];
export const LOCALES = rows.map(([code, htmlLang, ogLocale, label, latinSlugs = true, translateAs = code]) => ({
  code, htmlLang, hreflang: htmlLang, ogLocale, label, latinSlugs, translateAs, direction: code === "ar" ? "rtl" : "ltr",
}));
export const localeByCode = (code) => LOCALES.find((locale) => locale.code === code);

export function asciiSlug(text) {
  const normalized = text.replace(/ß/g, "ss").replace(/[æÆ]/g, "ae").replace(/[øØ]/g, "o")
    .replace(/[đĐ]/g, "d").replace(/[łŁ]/g, "l").replace(/[ħĦ]/g, "h")
    .normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  let slug = "";
  for (const word of normalized.split("-").filter(Boolean).slice(0, 10)) {
    if (slug.length + word.length + (slug ? 1 : 0) > 80) break;
    slug += (slug ? "-" : "") + word;
  }
  return slug;
}
