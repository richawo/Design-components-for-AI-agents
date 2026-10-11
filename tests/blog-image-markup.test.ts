import { describe, expect, it } from "vitest";
import { imageDimensions } from "@/lib/blog/image-markup";

describe("article image markup", () => {
  it("reserves intrinsic space without changing a translated alt description", () => {
    const html = '<p><img src="/blog-images/scope.svg" alt="Un schéma &quot;cuivré&quot;" width="20" height="10"></p>';
    const rendered = imageDimensions(html, { "/blog-images/scope.svg": { width: 900, height: 460 } });
    expect(rendered).toContain('alt="Un schéma &quot;cuivré&quot;"');
    expect(rendered).toContain('width="900" height="460" loading="lazy" decoding="async"');
    expect(rendered.match(/width=/g)).toHaveLength(1);
  });
  it("leaves unsupported external images alone", () => {
    const html = '<img src="https://example.com/image.png" alt="Example">';
    expect(imageDimensions(html)).toBe(html);
  });
});
