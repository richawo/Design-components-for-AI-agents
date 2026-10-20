import { describe, expect, it } from "vitest";
import { isUntouched } from "../scripts/lib/translation-quality.mjs";

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
