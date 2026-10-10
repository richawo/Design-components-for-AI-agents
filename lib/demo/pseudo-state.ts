/**
 * CSS :hover and :active for the live demo player.
 *
 * A script can dispatch pointer and mouse events, but the browser only sets
 * :hover and :active from real input, so a demo pointer gliding over a
 * `hover:bg-…` button changes nothing. The player works around it the only
 * general way there is: while a demo plays it copies every same-origin style
 * rule that uses :hover or :active, rewrites the pseudo-class to an attribute
 * (`[data-demo-hover]`, `[data-demo-active]`) and inserts the copy right after
 * the original. The player then sets those attributes on the element under its
 * pointer and that element's ancestors, exactly where the browser would match
 * the real pseudo-class. An attribute selector has the same specificity as a
 * pseudo-class and the copy sits at the original's place in the cascade, so the
 * result is the same styling a real pointer would get. Everything is removed
 * the moment the demo stops, so the visitor's own pointer is back to native
 * :hover with an untouched stylesheet.
 *
 * Limits: cross-origin sheets can't be read, styles inside shadow roots or
 * adoptedStyleSheets aren't seen, rules added after a sheet was first read (some
 * CSS-in-JS) aren't copied, and `:not(:hover)` copies match every unmarked
 * element rather than every unhovered one.
 */

export const HOVER_ATTR = "data-demo-hover";
export const ACTIVE_ATTR = "data-demo-active";

/** Unescaped `:hover` / `:active`, not part of a longer name and not inside an escaped class name like `hover\:bg-x`. */
const PSEUDO = /(?<!\\):(hover|active)(?![\w-])/g;

/** The selector with every :hover / :active swapped for its demo attribute, or null when it uses neither. */
export function mirrorSelector(selector: string): string | null {
  let hit = false;
  const out = selector.replace(PSEUDO, (_, p: string) => {
    hit = true;
    return `[${p === "hover" ? HOVER_ATTR : ACTIVE_ATTR}]`;
  });
  return hit ? out : null;
}

type RuleParent = { cssRules: CSSRuleList; insertRule(rule: string, index?: number): number; deleteRule(index: number): void };

function isStyleRule(r: CSSRule): r is CSSStyleRule {
  return typeof (r as CSSStyleRule).selectorText === "string";
}

function isGrouping(r: CSSRule): r is CSSRule & RuleParent {
  return "cssRules" in r && typeof (r as unknown as RuleParent).insertRule === "function";
}

export class PseudoStateMirror {
  private seen = new WeakSet<CSSStyleSheet>();
  private inserted: CSSRule[] = [];

  constructor(private readonly doc: Document) {}

  /** Copy the :hover / :active rules of every sheet not read yet. Cheap to call often. */
  sync() {
    for (const sheet of Array.from(this.doc.styleSheets)) this.sheet(sheet);
  }

  /** Remove every copied rule and every demo attribute. */
  dispose() {
    for (const rule of this.inserted.reverse()) {
      const parent = (rule.parentRule ?? rule.parentStyleSheet) as RuleParent | null;
      if (!parent) continue;
      const i = Array.prototype.indexOf.call(parent.cssRules, rule);
      if (i >= 0) parent.deleteRule(i);
    }
    this.inserted = [];
    this.seen = new WeakSet();
    clearMarks(this.doc, HOVER_ATTR);
    clearMarks(this.doc, ACTIVE_ATTR);
  }

  private sheet(s: CSSStyleSheet) {
    if (this.seen.has(s)) return;
    this.seen.add(s);
    let rules: CSSRuleList;
    try {
      rules = s.cssRules;
    } catch {
      return; // Cross-origin: unreadable, and nothing a demo depends on.
    }
    this.list(s as unknown as RuleParent, rules);
  }

  private list(parent: RuleParent, rules: CSSRuleList) {
    // Backwards, so inserting a copy after rule i never shifts a rule still to visit.
    for (let i = rules.length - 1; i >= 0; i--) {
      const r = rules[i];
      if (isStyleRule(r)) {
        const sel = mirrorSelector(r.selectorText);
        if (sel && r.cssText.startsWith(r.selectorText)) {
          try {
            parent.insertRule(sel + r.cssText.slice(r.selectorText.length), i + 1);
            this.inserted.push(parent.cssRules[i + 1]);
          } catch {
            // A selector this engine won't parse in the copy: leave it unmirrored.
          }
        }
        if (isGrouping(r) && r.cssRules.length) this.list(r, r.cssRules); // CSS nesting
      } else if ("styleSheet" in r && "href" in r) {
        const imported = (r as CSSImportRule).styleSheet;
        if (imported) this.sheet(imported);
      } else if (isGrouping(r)) {
        this.list(r, r.cssRules); // @media, @supports, @layer, @container…
      }
    }
  }
}

function clearMarks(doc: Document, attr: string) {
  for (const el of Array.from(doc.querySelectorAll(`[${attr}]`))) el.removeAttribute(attr);
}

/** The element and its ancestors: where the browser matches :hover / :active. */
export function ancestry(el: Element | null): Element[] {
  const out: Element[] = [];
  for (let n = el; n; n = n.parentElement) out.push(n);
  return out;
}

/** Move a demo attribute from one element's ancestry to another's, touching only what changes. */
export function moveMark(attr: string, from: Element | null, to: Element | null) {
  const a = ancestry(from);
  const b = ancestry(to);
  for (const n of a) if (!b.includes(n)) n.removeAttribute(attr);
  for (const n of b) if (!a.includes(n)) n.setAttribute(attr, "");
}
