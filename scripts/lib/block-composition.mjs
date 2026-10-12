import path from "node:path";
import { parse } from "@babel/parser";

export const BLOCK_TYPES = [
  "dashboard",
  "report",
  "settings",
  "landing-page",
  "workspace",
];

function imports(code) {
  const file = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
  return file.program.body.flatMap((node) => {
    if (
      ![
        "ImportDeclaration",
        "ExportNamedDeclaration",
        "ExportAllDeclaration",
      ].includes(node.type) ||
      !node.source ||
      node.source.type !== "StringLiteral"
    )
      return [];
    return [
      {
        specifier: node.source.value,
        start: node.source.start,
        end: node.source.end,
      },
    ];
  });
}

/** Blocks reuse declared catalogue files; an ordinary component remains standalone. */
export function validateComposition(meta, code, catalogue) {
  const errors = [];
  if (meta.kind !== undefined && !["component", "block"].includes(meta.kind))
    errors.push("kind must be component or block");
  const local = imports(code).filter((item) => item.specifier.startsWith("."));
  if (meta.kind !== "block") {
    if (meta.components !== undefined || meta.blockType !== undefined)
      errors.push("composition metadata is only supported on blocks");
    if (local.length)
      errors.push("standalone components cannot import local files");
    return errors;
  }
  if (meta.platform !== "web") errors.push("blocks currently target web");
  if (!BLOCK_TYPES.includes(meta.blockType))
    errors.push("blockType must name a supported page pattern");
  if (
    !Array.isArray(meta.components) ||
    meta.components.length < 2 ||
    new Set(meta.components).size !== meta.components.length
  ) {
    errors.push("blocks must declare at least two distinct component slugs");
    return errors;
  }
  const imported = new Set();
  for (const item of local) {
    const resolved = path.posix
      .normalize(`${meta.tier}/${meta.slug}/${item.specifier}`)
      .replace(/\.tsx$/, "");
    const entry = catalogue.find(
      (child) => `${child.tier}/${child.slug}/${child.slug}` === resolved,
    );
    if (!entry || !meta.components.includes(entry.slug))
      errors.push(
        `local import ${item.specifier} is not a declared catalogue dependency`,
      );
    else imported.add(entry.slug);
  }
  for (const slug of meta.components) {
    const child = catalogue.find((entry) => entry.slug === slug);
    if (!child || child.status === "draft")
      errors.push(`component ${slug} is not published`);
    else {
      if (child.platform !== "web")
        errors.push(`component ${slug} is not a web component`);
      if (meta.tier === "free" && child.tier === "pro")
        errors.push(`free block cannot depend on Pro component ${slug}`);
      if (!imported.has(slug))
        errors.push(`component ${slug} is declared but never imported`);
    }
  }
  const visit = (slug, ancestry) => {
    if (ancestry.has(slug)) {
      errors.push(`composition contains a cycle at ${slug}`);
      return;
    }
    const child = catalogue.find((entry) => entry.slug === slug);
    for (const id of child?.components ?? [])
      visit(id, new Set([...ancestry, slug]));
  };
  visit(meta.slug, new Set());
  return [...new Set(errors)];
}

/** In the installed project, composition files share components/design-for-ai/. */
export function installedBlockSource(meta, code) {
  if (meta.kind !== "block") return code;
  let result = code;
  for (const item of imports(code)
    .filter((item) => item.specifier.startsWith("."))
    .reverse()) {
    const slug = item.specifier
      .replace(/\.tsx$/, "")
      .split("/")
      .at(-1);
    if (!meta.components.includes(slug))
      throw new Error(`Undeclared composition import: ${slug}`);
    result =
      result.slice(0, item.start) +
      JSON.stringify(`./${slug}`) +
      result.slice(item.end);
  }
  return result;
}

export function compositionRegistryDependencies(meta, catalogue, siteUrl) {
  return (meta.components ?? []).map((slug) => {
    const child = catalogue.find((entry) => entry.slug === slug);
    if (!child) throw new Error(`Unknown composition dependency: ${slug}`);
    // The configured Pro namespace carries Authorization through shadcn's dependency resolution.
    return child.tier === "pro"
      ? `@design-for-ai-pro/${slug}`
      : `${siteUrl}/r/${slug}.json`;
  });
}
