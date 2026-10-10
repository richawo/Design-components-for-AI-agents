import { marked } from "marked";

export function auditBlog(source, now = new Date()) {
  const errors = [], warnings = [], slugs = new Set(), titles = new Set();
  const published = new Set(source.posts.filter((p) => !p.data.draft).map((p) => p.data.slug));
  // Editorial dates use the owner's calendar, including the hour after BST midnight.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  for (const post of source.posts) {
    const label = post.file, data = post.data;
    const fail = (message) => errors.push(`${label}: ${message}`);
    const warn = (message) => warnings.push(`${label}: ${message}`);
    for (const field of ["title", "slug", "description", "date", "category", "author"]) if (!data[field]) fail(`${field} is required`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug) || `${data.slug}.md` !== post.file) fail("slug must match its Markdown filename");
    if (slugs.has(data.slug)) fail("duplicate slug"); slugs.add(data.slug);
    const title = String(data.title ?? "").toLowerCase();
    if (titles.has(title)) fail("duplicate title"); titles.add(title);
    if (String(data.title ?? "").length > 70) fail("title exceeds 70 characters");
    if (String(data.description ?? "").length < 50 || String(data.description ?? "").length > 170) fail("description must be 50 to 170 characters");
    for (const field of ["date", "dateModified"]) {
      const value = String(data[field] ?? data.date);
      const date = new Date(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) fail(`${field} must be a real YYYY-MM-DD date`);
      if (!data.draft && value > today) fail(`${field} is in the future`);
    }
    if (data.dateModified < data.date) fail("dateModified is earlier than date");
    if (!Object.values(source.config.categories ?? {}).some((category) => category.name === data.category)) fail("unknown category");
    if (data.author !== source.config.author?.name) fail("unknown author");
    const tokens = marked.lexer(post.content), headings = [], links = [], images = [];
    marked.walkTokens(tokens, (token) => {
      if (token.type === "heading") headings.push(token);
      if (token.type === "link") links.push(token.href);
      if (token.type === "image") images.push(token);
    });
    if (headings.some((h) => h.depth === 1)) fail("the page title must be the only H1");
    for (const href of links) {
      const match = href.replace(/^https:\/\/design\.yaps\.ai/, "").match(/^\/blog\/([\w-]+)(?:\/?|#.*)$/);
      if (match && !["category", "page"].includes(match[1]) && !published.has(match[1])) fail(`link points to unpublished article ${match[1]}`);
    }
    for (const slug of data.related ?? []) if (!published.has(slug)) fail(`related article is unpublished: ${slug}`);
    for (const image of images) if (!image.text?.trim()) fail(`image has no alt text: ${image.href}`);
    if (data.heroImage && !data.heroImageAlt) fail("heroImage needs alt text");
    if (!data.heroImage) warn("no hero image");
    if (!headings.some((h) => h.depth === 2 && h.text.toLowerCase() === "frequently asked questions")) warn("no FAQ section");
    if (links.filter((link) => link.startsWith("/")).length < 2) warn("fewer than two internal links");
    if (!links.some((link) => /^https?:/.test(link) && !link.includes("design.yaps.ai"))) warn("no outbound citation");
    if (post.content.split(/\s+/).length < 600) warn("under 600 words; review whether the guide answers the query fully");
    if (post.content.includes("\u2014")) warn("uses an em dash");
    const primary = String(data.keywords ?? "").split(",")[0]?.trim().toLowerCase();
    if (!primary) warn("no primary keyword");
    else for (const [field, value] of [["title", data.title], ["description", data.description], ["opening paragraph", tokens.find((t) => t.type === "paragraph")?.text ?? ""]]) if (!String(value).toLowerCase().includes(primary)) warn(`primary keyword is absent from ${field}`);
  }
  return { errors, warnings };
}
