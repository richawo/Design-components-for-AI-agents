// Build-only preview instrumentation. Downloaded component source stays standalone.
const { parse } = require("@babel/parser");

// These inputs are display copy, including copy painted into a canvas or
// split into individual letters. Keep editable values and domain records out.
const DISPLAY_INPUTS = {
  "text-decode": { TextDecode: ["text"] },
  "text-outline-fill": { TextOutlineFill: ["text"] },
  "text-optical-weight": { TextOpticalWeight: ["text"] },
  "hero-kinetic-type": { LetterStack: ["lines"] },
  "hero-prism": { Headline: ["text", "muted"] },
  "hero-blur-statement": { Statement: ["lead", "tail"] },
  "hero-marquee-screens": { HeroMarqueeScreens: ["headline"] },
  "cta-horizon": { Headline: ["text", "muted"] },
  "hero-signal-workbench": { HeroSignalWorkbench: ["heading"] },
  "footer-newsletter": { FooterNewsletter: ["title"], MorphText: ["text"] },
  "footer-wordmark": { FooterWordmark: ["headline"] },
  "ai-message-actions": { InkedParagraph: ["text"] },
  "ai-answer-compare": { Inline: ["text"] },
  "ai-search-answer": { SearchAnswer: ["answer"] },
  "mobile-onboarding": { CountUp: ["text"] },
  "editor-font-pairing": { ResetWords: ["text"] },
  "three-holo-card": { ThreeHoloCard: ["tier", "finePrint"] },
};

// Read display fields inside their view, retaining the original records and
// callback payloads. Streaming examples need translated text before tokenizing.
const DISPLAY_MEMBERS = {
  "three-voice-orb": { OrbCaption: ["copy.text"] },
  "diagram-rag-pipeline": { AnswerView: ["p.text"] },
  "mobile-chat": { BubbleText: ["m.text"] },
  "mobile-voice-memo": { TranscriptLine: ["segment.text"] },
  "ai-search-answer": { useScriptedSearch: ["search.answer"] },
};

function transform(source, filename = "") {
  const slug = /(?:free|pro)[/\\]([^/\\]+)[/\\]/.exec(filename)?.[1];
  if (source.includes("useSiteI18n as __useSiteI18n") || (!source.includes("<") && !DISPLAY_MEMBERS[slug])) return source;
  const ast = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] });
  const edits = [];
  const parents = new WeakMap();
  let components = 0;
  let displayInputs = 0;
  const isFunction = (node) => /^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type);
  function walk(node, parent, owner) {
    if (!node || typeof node !== "object") return;
    if (parent) parents.set(node, parent);
    if (isFunction(node)) {
      let declaration = parent;
      while (declaration?.type === "CallExpression" && ["memo", "forwardRef"].includes(declaration.callee.name ?? declaration.callee.property?.name)) declaration = parents.get(declaration);
      const name = node.id?.name ?? (declaration?.type === "VariableDeclarator" ? declaration.id?.name : declaration?.type === "ExportDefaultDeclaration" ? "DefaultPreview" : "");
      const members = DISPLAY_MEMBERS[slug]?.[name] ?? [];
      owner = /^[A-Z]/.test(name ?? "") || members.length ? node : null;
      if (owner) {
        const returns = [];
        let ownJsx = false;
        function collect(value) {
          if (!value || typeof value !== "object" || (value !== owner && isFunction(value))) return;
          if (value.type === "JSXElement" || value.type === "JSXFragment") ownJsx = true;
          if (value.type === "ReturnStatement" && value.argument) returns.push(value.argument);
          for (const [key, child] of Object.entries(value)) if (!["loc", "extra", "comments"].includes(key)) {
            if (Array.isArray(child)) child.forEach(collect); else if (child && typeof child === "object") collect(child);
          }
        }
        collect(owner.body);
        if (owner.body.type !== "BlockStatement") returns.push(owner.body);
        if (ownJsx || members.length || returns.some((value) => source.slice(value.start, value.end).includes("<"))) {
          components++;
          const inputs = DISPLAY_INPUTS[slug]?.[name] ?? [];
          const parameter = owner.params[0]?.type === "AssignmentPattern" ? owner.params[0].left : owner.params[0];
          const aliases = [];
          if (parameter?.type === "ObjectPattern") for (const property of parameter.properties) {
            if (property.type !== "ObjectProperty" || !inputs.includes(property.key.name ?? property.key.value)) continue;
            const binding = property.value.type === "AssignmentPattern" ? property.value.left : property.value;
            if (binding.type !== "Identifier") continue;
            const raw = `__i18nInput_${binding.name}`;
            edits.push([binding.start, binding.end, property.shorthand ? `${source.slice(property.key.start, property.key.end)}: ${raw}` : raw]);
            aliases.push(`const ${binding.name} = __i18nMemo(() => __displayCopy(${raw}, __t), [${raw}, __t]);`);
          }
          if (aliases.length || members.length) displayInputs++;
          const setup = `const { localize: __localize${aliases.length || members.length ? ", t: __t" : ""} } = __useSiteI18n();\n${aliases.join("\n")}`;
          if (members.length) {
            const localizeMember = (value) => {
              if (!value || typeof value !== "object") return;
              if (value.type === "MemberExpression" && members.includes(source.slice(value.start, value.end))) {
                edits.push([value.start, value.end, `__displayCopy(${source.slice(value.start, value.end)}, __t)`]);
              }
              // Locale changes must also update memoized display tokens.
              if (value.type === "CallExpression" && ["useMemo", "useCallback"].includes(value.callee.name) && value.arguments[1]?.type === "ArrayExpression") {
                const deps = value.arguments[1];
                const trailingComma = /,\s*$/.test(source.slice(deps.start + 1, deps.end - 1));
                edits.push([deps.end - 1, deps.end - 1, `${deps.elements.length ? trailingComma ? " " : ", " : ""}__t`]);
              }
              for (const [key, child] of Object.entries(value)) if (!["loc", "extra", "comments"].includes(key)) {
                if (Array.isArray(child)) child.forEach(localizeMember); else if (child && typeof child === "object") localizeMember(child);
              }
            };
            localizeMember(owner.body);
          }
          if (owner.body.type === "BlockStatement") {
            edits.push([owner.body.start + 1, owner.body.start + 1, `\n${setup}\n`]);
            for (const value of returns) { edits.push([value.start, value.start, "__localize("]); edits.push([value.end, value.end, ")"]); }
          } else {
            const start = source.lastIndexOf("=>", owner.body.start) + 2;
            edits.push([start, owner.end, ` { ${setup}\nreturn __localize(${source.slice(owner.body.start, owner.body.end)}); }`]);
          }
        }
      }
    }
    for (const [key, child] of Object.entries(node)) if (!["loc", "extra", "comments"].includes(key)) {
      if (Array.isArray(child)) for (const value of child) walk(value, node, owner);
      else if (child && typeof child === "object") walk(child, node, owner);
    }
  }
  walk(ast);
  if (!components) return source;
  const at = ast.program.directives.at(-1)?.end ?? 0;
  edits.push([at, at, '\nimport { useSiteI18n as __useSiteI18n } from "@/components/site/site-i18n";\n']);
  if (displayInputs) edits.push([at, at, '\nimport { useMemo as __i18nMemo } from "react";\nimport { translateDisplay as __displayCopy } from "@/lib/i18n/translate";\n']);
  // Motion reads the media query during the first client render. A demo also
  // used on a server-rendered page must hydrate with the server snapshot,
  // including when its language changes which chunks load first.
  for (const declaration of ast.program.body) if (declaration.type === "ImportDeclaration" && declaration.source.value === "motion/react") {
    for (const specifier of declaration.specifiers) if (specifier.type === "ImportSpecifier" && specifier.imported.name === "useReducedMotion") {
      edits.push([specifier.start, specifier.end, "useReducedMotion as __unusedMotionReducedMotion"]);
      edits.push([at, at, `\nimport { useReducedMotion as ${specifier.local.name} } from "@/lib/use-reduced-motion";\n`]);
    }
  }
  for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0] || b[1] - a[1])) source = source.slice(0, start) + text + source.slice(end);
  return source;
}

module.exports = { transform };
