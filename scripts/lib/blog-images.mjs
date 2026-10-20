import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { marked } from "marked";

export async function buildBlogImages(root, source) {
  if (!source.posts.length) return {};
  const images = {};
  const directory = path.join(root, "public", "blog-images");
  fs.mkdirSync(directory, { recursive: true });
  const write = (file, bytes) => {
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes)) fs.writeFileSync(file, bytes);
  };
  const asset = (relative) => {
    const base = fs.realpathSync(source.base);
    const candidate = path.resolve(base, relative);
    if (!candidate.startsWith(base + path.sep) || !fs.existsSync(candidate)) throw new Error(`Missing or out-of-scope editorial image: ${relative}`);
    const resolved = fs.realpathSync(candidate);
    if (!resolved.startsWith(base + path.sep)) throw new Error(`Out-of-scope editorial image: ${relative}`);
    return resolved;
  };
  for (const seed of ["blog", ...source.posts.filter((post) => !post.data.draft).map((post) => post.data.slug)]) {
    const hash = createHash("sha256").update(seed).digest();
    const circles = Array.from({ length: 20 }, (_, i) => {
      const x = 370 + (hash[i % 32] / 255) * 710;
      const y = 60 + (hash[(i + 11) % 32] / 255) * 520;
      return `<circle cx="${x}" cy="${y}" r="${30 + i * 5}" fill="none" stroke="url(#silver)" stroke-width="${1 + i % 3}" opacity="${0.2 + (i % 4) * 0.14}"/>`;
    }).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="silver" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".5" stop-color="#9b9ba7"/><stop offset="1" stop-color="#353540"/></linearGradient><radialGradient id="glow"><stop stop-color="#272735"/><stop offset="1" stop-color="#060608"/></radialGradient></defs><rect width="1200" height="630" fill="#060608"/><rect width="1200" height="630" fill="url(#glow)"/>${circles}<path d="M70 76h48M70 76v48M1130 554h-48M1130 554v-48" fill="none" stroke="#cfcfd8" stroke-width="3"/><text x="72" y="356" fill="#fff" font-family="sans-serif" font-size="64" font-weight="700" letter-spacing="-3">Design for AI</text><text x="76" y="404" fill="#9d9da8" font-family="sans-serif" font-size="21" letter-spacing="3">DESIGN · COMPONENTS · AGENTS</text><text x="76" y="554" fill="#777782" font-family="monospace" font-size="18">design.yaps.ai</text></svg>`;
    const post = source.posts.find((post) => post.data.slug === seed);
    const input = post?.data.heroAsset ? asset(post.data.heroAsset) : Buffer.from(svg);
    const picture = sharp(input);
    const dimensions = await picture.metadata();
    if (post?.data.heroAsset && (!dimensions.width || !dimensions.height || dimensions.width < 1200 || dimensions.height < 630)) throw new Error(`Hero image needs at least 1200 by 630 pixels: ${seed}`);
    write(path.join(directory, `${seed}.png`), await picture.resize(1200, 630, { fit: "cover" }).png().toBuffer());
    images[`/blog-images/${seed}.png`] = { width: 1200, height: 630 };
    if (post?.data.heroAsset) {
      write(path.join(directory, `${seed}.webp`), await sharp(input).resize(1200, 630, { fit: "cover" }).webp({ quality: 85, effort: 6 }).toBuffer());
      images[`/blog-images/${seed}.webp`] = { width: 1200, height: 630 };
    }
  }
  write(path.join(directory, "logo.png"), await sharp(path.join(root, "app", "icon.svg")).resize(512, 512).png().toBuffer());
  images["/blog-images/logo.png"] = { width: 512, height: 512 };
  const referenced = new Set();
  for (const post of source.posts.filter((post) => !post.data.draft)) marked.walkTokens(marked.lexer(post.content), (token) => {
    if (token.type === "image" && token.href.startsWith("/blog-images/")) referenced.add(token.href);
  });
  for (const href of referenced) {
    if (images[href]) continue;
    const name = href.slice("/blog-images/".length);
    if (!/^[a-z0-9][a-z0-9._-]*\.(?:png|jpg|jpeg|webp|svg)$/.test(name)) throw new Error(`Invalid editorial image filename: ${href}`);
    const file = asset(`assets/${name}`), dimensions = await sharp(file).metadata();
    if (!dimensions.width || !dimensions.height) throw new Error(`Image has no dimensions: ${href}`);
    const expectedFormat = { ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp", ".svg": "svg" }[path.extname(name)];
    if (dimensions.format !== expectedFormat) throw new Error(`Image format does not match filename: ${href} contains ${dimensions.format}`);
    write(path.join(directory, name), fs.readFileSync(file));
    images[href] = { width: dimensions.width, height: dimensions.height };
  }
  return images;
}
