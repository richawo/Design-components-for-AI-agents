import { describe, expect, it } from "vitest";
import { isUntouched, hasUntranslatedClause, protectedIntact, translationMarkupIntact } from "../scripts/lib/translation-quality.mjs";

describe("unchanged translation detection", () => {
  it("rejects an unchanged sentence even when the source has escaped punctuation", () => {
    expect(isUntouched("The team&#39;s brief describes the visible component behaviour.", "The team's brief describes the visible component behaviour.")).toBe(true);
    expect(isUntouched("Choose &quot;Annual&quot; to review the full quote.", "Choose \"Annual\" to review the full quote.")).toBe(true);
  });

  it("accepts translated prose and unchanged short labels", () => {
    expect(isUntouched("The team&#39;s brief describes the visible component behaviour.", "Le document de l’équipe décrit le comportement visible du composant.")).toBe(false);
    expect(isUntouched("Brand team", "Brand team")).toBe(false);
  });

  it("rejects an English sentence hidden after a translated opening", () => {
    const source = "Choose the appropriate foundation. Existing Tailwind Plus owners should review their actual needs before migrating working code.";
    expect(isUntouched(source, "適切な基盤を選びます。 Existing Tailwind Plus owners should review their actual needs before migrating working code.")).toBe(true);
  });

  it("keeps literal code and translated prose out of the partial-sentence check", () => {
    const source = "Inspect the result. <code>Existing owners should review their actual needs before migrating working code.</code>";
    expect(isUntouched(source, "Vérifiez le résultat. <code>Existing owners should review their actual needs before migrating working code.</code>")).toBe(false);
  });
});

describe("translation structure", () => {
  it("detects an English clause before a semicolon after a translated opening", () => {
    const source = 'Our web stack is React. The shared font roles are described in <a href="/docs">installation</a>; colours remain part of each design.';
    const target = 'Unser Webstack nutzt React. The shared font roles are described in <a href="/docs">installation</a>; Farben bleiben Teil jedes Designs.';
    expect(isUntouched(source, target)).toBe(false);
    expect(hasUntranslatedClause(source, target)).toBe(true);
  });
  it("excludes literal code and protected product sequences from clause checks", () => {
    const source = 'Inspect <code>the shared font roles are described in the installation guide</code>. React Bits, Motion Primitives, Magic UI and Aceternity UI supply choices.';
    expect(hasUntranslatedClause(source, 'Prüfen Sie <code>the shared font roles are described in the installation guide</code>. React Bits, Motion Primitives, Magic UI und Aceternity UI bieten Optionen.')).toBe(false);
  });
  it("accepts a fully translated clause with the same owned link", () => {
    expect(hasUntranslatedClause('The shared font roles are described in <a href="/docs">installation</a>; colours remain part of each design.', 'Die gemeinsamen Schriftrollen beschreibt die <a href="/docs">Installationsanleitung</a>; Farben gehören zum jeweiligen Design.')).toBe(false);
  });
  it("requires every repeated protected product name", () => {
    expect(protectedIntact("React uses React.", "React utilise cette bibliothèque.")).toBe(false);
    expect(protectedIntact("React uses React.", "React utilise React.")).toBe(true);
  });
  it("preserves Radix as a product, including Radix-based wrappers", () => {
    const source = "Radix-based wrappers can differ from Radix components.";
    expect(protectedIntact(source, "基数ベースのラッパーは基数コンポーネントと異なる場合があります。")).toBe(false);
    expect(protectedIntact(source, "基数ベースのラッパーは Radix コンポーネントと異なる場合があります。")).toBe(false);
    expect(protectedIntact(source, "Radix ベースのラッパーは Radix コンポーネントと異なる場合があります。")).toBe(true);
    expect(protectedIntact("Compare Radix components.", "Võrrelge Radixi komponente.")).toBe(true);
  });
  it("preserves exact code markers, link destinations and nonempty anchor text", () => {
    const source = 'Inspect <a href="/docs">the guide</a> and {{0}}.';
    expect(translationMarkupIntact(source, 'Consultez <a href="/docs">le guide</a> et {{0}}.')).toBe(true);
    expect(translationMarkupIntact(source, 'Consultez <a href="/docs"></a> le guide et {{0}}.')).toBe(false);
    expect(translationMarkupIntact(source, 'Consultez <a href="/wrong">le guide</a> et {{0}}.')).toBe(false);
    expect(translationMarkupIntact(source, 'Consultez <a href="/docs">le guide</a> et {{1}}.')).toBe(false);
  });
});
