import { describe, expect, it } from "vitest";
import { sourceFaqHeading } from "../lib/blog/faq-heading";

describe("source-aligned translated FAQ sections", () => {
  it("resolves a translated short FAQ label without confusing ordinary H3s", () => {
    const source = "## Delivery\n\n### A normal subsection\n\nText.\n\n## FAQs\n\n### Can I adapt this?\n\nYes.\n\n## Sources checked\n";
    expect(sourceFaqHeading(source, [
      { level: 2, text: "Livraison" }, { level: 3, text: "Sous-section" },
      { level: 2, text: "FAQ" }, { level: 3, text: "Puis-je l’adapter ?" },
      { level: 2, text: "Sources vérifiées" },
    ])).toBe("FAQ");
  });
  it("supports the existing long heading and non-Latin translated labels", () => {
    expect(sourceFaqHeading("## Frequently asked questions\n", [{ level: 2, text: "الأسئلة الشائعة" }])).toBe("الأسئلة الشائعة");
  });
  it.each([
    ["permission matrices", "Preguntas sobre matrices de permisos"],
    ["contact-sheet reviews", "أسئلة حول مراجعة أوراق الصور"],
    ["release review", "有关发布审核的问题"],
    ["comment threads", "댓글 스레드에 관한 질문"],
    ["range calendars", "Questions sur les calendriers de plage"],
  ])("resolves the topic-specific FAQ section about %s", (topic, translated) => {
    const source = `## Workflow\n\n### What changes?\n\nA normal subsection.\n\n## Questions about ${topic}\n\n### Can I adapt this?\n\nYes.\n\n## Sources checked\n`;
    expect(sourceFaqHeading(source, [
      { level: 2, text: "Workflow" }, { level: 3, text: "What changes?" },
      { level: 2, text: translated }, { level: 3, text: "Can I adapt this?" },
      { level: 2, text: "Sources checked" },
    ])).toBe(translated);
  });
  it("resolves the English topic-specific section without translation", () => {
    expect(sourceFaqHeading("## Questions about comment threads\n", [
      { level: 2, text: "Questions about comment threads" },
    ])).toBe("Questions about comment threads");
  });
  it("requires a topic and an explicit H2 FAQ label", () => {
    const source = "## Questions about\n\n### Questions about permission matrices\n\nAnswer.\n";
    expect(sourceFaqHeading(source, [
      { level: 2, text: "Questions about" },
      { level: 3, text: "Questions about permission matrices" },
    ])).toBeUndefined();
  });
  it("ignores FAQ headings inside executable examples", () => {
    expect(sourceFaqHeading("```md\n## FAQs\n```\n\n## Guide\n", [{ level: 2, text: "Guide" }])).toBeUndefined();
  });
  it("does not turn arbitrary questions into an FAQ section", () => {
    expect(sourceFaqHeading("## Guide\n\n### A question?\n\nAnswer.\n", [{ level: 2, text: "Guide" }])).toBeUndefined();
  });
  it("fails closed when source and translated section counts differ", () => {
    expect(sourceFaqHeading("## Guide\n\n## FAQs\n", [{ level: 2, text: "FAQ" }])).toBeUndefined();
  });
});
