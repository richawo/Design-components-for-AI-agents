import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

export async function buildBlogImages(root, source) {
  if (!source.posts.length) return;
  const directory = path.join(root, "public", "blog-images");
  fs.mkdirSync(directory, { recursive: true });
  const write = (file, bytes) => {
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes)) fs.writeFileSync(file, bytes);
  };
  for (const seed of ["blog", ...source.posts.map((post) => post.data.slug)]) {
    const hash = createHash("sha256").update(seed).digest();
    const circles = Array.from({ length: 20 }, (_, i) => {
      const x = 370 + (hash[i % 32] / 255) * 710;
      const y = 60 + (hash[(i + 11) % 32] / 255) * 520;
      return `<circle cx="${x}" cy="${y}" r="${30 + i * 5}" fill="none" stroke="url(#silver)" stroke-width="${1 + i % 3}" opacity="${0.2 + (i % 4) * 0.14}"/>`;
    }).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="silver" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".5" stop-color="#9b9ba7"/><stop offset="1" stop-color="#353540"/></linearGradient><radialGradient id="glow"><stop stop-color="#272735"/><stop offset="1" stop-color="#060608"/></radialGradient></defs><rect width="1200" height="630" fill="#060608"/><rect width="1200" height="630" fill="url(#glow)"/>${circles}<path d="M70 76h48M70 76v48M1130 554h-48M1130 554v-48" fill="none" stroke="#cfcfd8" stroke-width="3"/><text x="72" y="356" fill="#fff" font-family="sans-serif" font-size="64" font-weight="700" letter-spacing="-3">Design for AI</text><text x="76" y="404" fill="#9d9da8" font-family="sans-serif" font-size="21" letter-spacing="3">DESIGN · COMPONENTS · AGENTS</text><text x="76" y="554" fill="#777782" font-family="monospace" font-size="18">design.yaps.ai</text></svg>`;
    write(path.join(directory, `${seed}.png`), await sharp(Buffer.from(svg)).png().toBuffer());
  }
  write(path.join(directory, "logo.png"), await sharp(path.join(root, "app", "icon.svg")).resize(512, 512).png().toBuffer());
}
