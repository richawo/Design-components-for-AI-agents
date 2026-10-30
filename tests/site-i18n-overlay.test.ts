import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LOCALES } from "../lib/blog/locales.mjs";
import { unpackContent } from "../scripts/lib/content-pack.mjs";
import { publicationInputs, publicationInputsFromGitTree } from "../scripts/lib/publication-request.mjs";
import { buildSiteI18n, loadSiteDictionary, siteCorpus } from "../scripts/lib/site-i18n.mjs";

const metadataKey = "Persist { ticketId, priority, assigneeId }. If rejected, show the failure and restore the previous route or inbox unless a newer host routing state takes precedence.";
const guideKey = "A rejected route shows an error and restores the previous route or returns a previously unrouted ticket to the inbox unless the host supplied a newer route or cleared it while saving. The undo callback must persist restoration of the earlier route in the host before it resolves.";
const metadataFr = "Enregistrer { ticketId, priority, assigneeId }. En cas de rejet, afficher l’erreur et rétablir la route précédente ou la boîte de réception, sauf si un état de routage plus récent du système hôte prévaut.";
const guideFr = "Un routage refusé affiche une erreur et rétablit la route précédente ou remet un ticket auparavant non routé dans la boîte de réception, sauf si le système hôte a fourni une route plus récente ou l’a effacée pendant l’enregistrement. Le rappel d’annulation doit enregistrer la restauration dans le système hôte avant de se terminer.";
const overrideKey = "Choose a route";
const preserveKey = "Keep this label";
const legacyKey = "Existing public sentence";
const tokenKey = "Open {{0}} panel";
const secret = "Private unused sentinel should not be emitted";
const roots: string[] = [];
const write = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
};
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const repo = process.cwd();
const script = (name: string, root: string, ...args: string[]) => execFileSync(process.execPath, [path.join(repo, "scripts", name), ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "design-site-overlay-"));
  roots.push(root);
  write(path.join(root, "content/components/guides.json"), {
    triage: { useWhen: "Use this workspace", avoidWhen: "Avoid this workspace", integration: [guideKey, overrideKey, preserveKey, legacyKey, tokenKey] },
  });
  write(path.join(root, "registry/__generated__/index.json"), [{
    slug: "saas-support-triage", name: "Support Triage", description: "A support workspace", props: [{ description: metadataKey }], controls: [],
  }]);
  write(path.join(root, "content/site-i18n-overrides.json"), {
    _preserve: [preserveKey],
    fr: { [overrideKey]: "Valeur révisée", [preserveKey]: "Valeur à préserver" },
  });
  for (const locale of LOCALES.filter((item) => item.code !== "en")) {
    const dictionary = Object.fromEntries(siteCorpus(root).keys.map((key) => [key, key]));
    if (locale.code === "fr") {
      delete dictionary[metadataKey];
      delete dictionary[guideKey];
      delete dictionary[overrideKey];
      delete dictionary[tokenKey];
      dictionary[legacyKey] = "Ancienne valeur publique";
    }
    write(path.join(root, "content/site-i18n", `${locale.code}.json`), dictionary);
  }
  const overlay = {
    [metadataKey]: metadataFr,
    [guideKey]: guideFr,
    [overrideKey]: "Valeur privée inférieure",
    [preserveKey]: "Valeur privée à préserver",
    [legacyKey]: "Valeur privée actuelle",
    [tokenKey]: "Ouvrir le panneau {{0}}",
    "Unreferenced overlay key": secret,
  };
  for (const locale of LOCALES.filter((item) => item.code !== "en")) {
    write(path.join(root, "registry/pro/_site/i18n/site", `${locale.code}.json`), overlay);
  }
  return { root, overlay };
}

afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe("private site translation overlay", () => {
  it("renders corpus entries with override and preserve precedence without emitting unused private entries", () => {
    const { root } = fixture();
    const before = fs.readFileSync(path.join(root, "content/site-i18n/fr.json"), "utf8");
    const { dictionary } = loadSiteDictionary(root, "fr");
    expect(dictionary[metadataKey]).toBe(metadataFr);
    expect(dictionary[guideKey]).toBe(guideFr);
    expect(dictionary[legacyKey]).toBe("Valeur privée actuelle");
    expect(dictionary[overrideKey]).toBe("Valeur révisée");
    expect(dictionary[preserveKey]).toBe(preserveKey);
    buildSiteI18n(root);
    const generated = read(path.join(root, "registry/__generated__/site-i18n.json"));
    const serverKeys = unpackContent(generated.keys) as string[];
    const siteAsset = read(path.join(root, "public", generated.dictionaries.fr));
    expect(siteAsset.values[serverKeys.indexOf(guideKey)]).toBe(guideFr);
    expect(siteAsset.values[serverKeys.indexOf(overrideKey)]).toBe("Valeur révisée");
    expect(siteAsset.values[serverKeys.indexOf(preserveKey)]).toBe("");
    const previewAsset = read(path.join(root, "public", siteAsset.previews["saas-support-triage"]));
    expect(previewAsset[metadataKey]).toBe(metadataFr);
    for (const file of fs.readdirSync(path.join(root, "public/locale-previews/fr"))) {
      expect(fs.readFileSync(path.join(root, "public/locale-previews/fr", file), "utf8")).not.toContain(secret);
    }
    expect(fs.readFileSync(path.join(root, "content/site-i18n/fr.json"), "utf8")).toBe(before);
  });

  it("audits effective overlay values and never copies them into public dictionaries during translation seeding", () => {
    const { root, overlay } = fixture();
    expect(script("audit-site-i18n.mjs", root)).toContain("Site localisation complete");
    expect(script("translate-site.mjs", root, "--locales", "fr", "--seed-only")).toContain("without network requests");
    const publicDictionary = read(path.join(root, "content/site-i18n/fr.json"));
    expect(publicDictionary).not.toHaveProperty(metadataKey);
    expect(publicDictionary).not.toHaveProperty(guideKey);
    expect(publicDictionary).not.toHaveProperty(overrideKey);
    expect(publicDictionary).not.toHaveProperty(tokenKey);
    expect(publicDictionary[legacyKey]).toBe("Ancienne valeur publique");
    expect(loadSiteDictionary(root, "fr").dictionary[legacyKey]).toBe("Valeur privée actuelle");
    write(path.join(root, "registry/pro/_site/i18n/site/fr.json"), { ...overlay, [tokenKey]: "Ouvrir le panneau" });
    expect(() => script("audit-site-i18n.mjs", root)).toThrow();
    expect(() => script("translate-site.mjs", root, "--locales", "fr", "--seed-only")).toThrow(/Command failed/);
    const after = read(path.join(root, "content/site-i18n/fr.json"));
    expect(after).not.toHaveProperty(tokenKey);
  });

  it("uses supplied private units during a full translation run without contacting a provider", () => {
    const { root } = fixture();
    const publicFile = path.join(root, "content/site-i18n/fr.json");
    write(publicFile, {
      ...read(publicFile),
      "Support Triage": "Support Triage",
      "A support workspace": "Espace de support",
      "Use this workspace": "Utiliser cet espace",
      "Avoid this workspace": "Éviter cet espace",
    });
    const guard = path.join(root, "deny-network.mjs");
    fs.writeFileSync(guard, 'globalThis.fetch = () => { console.error("Unexpected network request"); process.exit(91); };\n');
    expect(() => execFileSync(process.execPath, ["--import", guard, path.join(repo, "scripts/translate-site.mjs"), "--locales", "fr"], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    })).not.toThrow();
    const publicDictionary = read(publicFile);
    expect(publicDictionary).not.toHaveProperty(metadataKey);
    expect(publicDictionary).not.toHaveProperty(guideKey);
    expect(loadSiteDictionary(root, "fr").dictionary[metadataKey]).toBe(metadataFr);
    expect(loadSiteDictionary(root, "fr").dictionary[guideKey]).toBe(guideFr);
  });

  it("does not publish a missing private unit when another locale owns it privately", () => {
    const { root, overlay } = fixture();
    const incomplete = { ...overlay } as Record<string, string>;
    delete incomplete[guideKey];
    write(path.join(root, "registry/pro/_site/i18n/site/fr.json"), incomplete);
    const publicFile = path.join(root, "content/site-i18n/fr.json");
    write(publicFile, { ...read(publicFile), [guideKey]: "Valeur publique périmée" });
    const before = fs.readFileSync(publicFile, "utf8");
    expect(() => script("translate-site.mjs", root, "--locales", "fr", "--seed-only")).toThrow();
    expect(() => buildSiteI18n(root)).toThrow(/Missing or invalid private site translation for fr/);
    expect(fs.readFileSync(publicFile, "utf8")).toBe(before);
    expect(read(publicFile)[guideKey]).toBe("Valeur publique périmée");
  });

  it("binds private site overlay changes into the publication fingerprint", () => {
    const { root, overlay } = fixture();
    const base = path.join(root, "registry/pro/_site");
    fs.mkdirSync(path.join(base, "blog"), { recursive: true });
    fs.mkdirSync(path.join(base, "assets"), { recursive: true });
    fs.writeFileSync(path.join(base, "blog/guide.md"), "Guide\n");
    fs.writeFileSync(path.join(base, "assets/cover.svg"), "<svg/>\n");
    write(path.join(base, "config.json"), {});
    const before = publicationInputs(root);
    expect(before.files.some(([file]) => file === "i18n/site/fr.json")).toBe(true);
    const tree = { truncated: false, tree: before.files.map(([file, hash]) => ({ path: `_site/${file}`, type: "blob", mode: "100644", sha: hash })) };
    expect(publicationInputsFromGitTree(tree).sha256).toBe(before.sha256);
    write(path.join(base, "i18n/site/fr.json"), { ...overlay, [guideKey]: `${guideFr} Modifié.` });
    expect(publicationInputs(root).sha256).not.toBe(before.sha256);
  });
});
