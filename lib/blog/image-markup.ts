/** Both Markdown images and translated HTML reserve the same intrinsic space. */
export function imageDimensions(html: string, images: Record<string, { width: number; height: number }> = {}) {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /\bsrc="([^"]+)"/.exec(tag)?.[1], dimensions = src && images[src];
    if (!dimensions) return tag;
    return tag.replace(/\s(?:width|height|loading|decoding)="[^"]*"/g, "")
      .replace(/\s*\/?>(?=$)/, ` width="${dimensions.width}" height="${dimensions.height}" loading="lazy" decoding="async">`);
  });
}
