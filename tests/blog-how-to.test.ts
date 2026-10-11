import { describe, expect, it } from "vitest";
import { visibleHowToSteps } from "@/lib/blog/how-to";
import { highlight } from "@/lib/highlight";

describe("visible procedural content", () => {
  it("uses localized step text and its actual anchor without including code or adjacent sections", () => {
    const html = '<h2 id="premier"><a>Première étape</a></h2><p>Choisissez <strong>un fichier</strong> &amp; vérifiez.</p><pre>secret code</pre><h2 id="ثان"><a>الخطوة الثانية</a></h2><p>افحص النتيجة.</p><h2 id="faq">FAQ</h2><p>Other content</p>';
    expect(visibleHowToSteps(html, ["Première étape", "الخطوة الثانية"])).toEqual([
      { name: "Première étape", text: "Choisissez un fichier & vérifiez.", id: "premier" },
      { name: "الخطوة الثانية", text: "افحص النتيجة.", id: "ثان" },
    ]);
    expect(visibleHowToSteps(html)).toEqual([]);
  });
  it("rejects markup for an invisible or incomplete procedure", () => {
    expect(() => visibleHowToSteps('<h2 id="x">A step</h2><pre>code only</pre>', ["A step"])).toThrow(/visible/);
    expect(() => visibleHowToSteps("<p>No heading</p>", ["Missing"])).toThrow(/visible/);
  });
  it("highlights HTML without interpreting the example as page markup", async () => {
    const html = await highlight('<button type="button">Save</button>', "html");
    expect(html).toContain("shiki");
    expect(html).toMatch(/&lt;|&#(?:x0*3c|0*60);/i);
    expect(html).not.toContain('<button type="button">');
  });
});
