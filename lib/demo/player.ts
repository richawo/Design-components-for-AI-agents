import { CURSOR_START } from "./cursor.mjs";
import { ACTIVE_ATTR, HOVER_ATTR, PseudoStateMirror, moveMark } from "./pseudo-state";
import { TIMING, targetSelector, type DemoTarget, type ParsedStep } from "./schema.mjs";

/**
 * Plays a demo script inside the preview frame with a virtual pointer:
 * real DOM events (pointer, mouse, keyboard, input) dispatched at the
 * elements under a drawn cursor, so components react exactly as they do to
 * a person. Browser-only.
 *
 * Script-dispatched events can't set CSS :hover or :active, so while a demo
 * plays the page's same-origin :hover / :active rules are mirrored onto
 * attributes the player sets under its pointer (./pseudo-state.ts). JS hover
 * (motion's whileHover, pointerenter handlers) gets the real events.
 *
 * Focus follows the pointer the way a mouse does: a scripted press focuses
 * what a real press would, but without the keyboard focus ring (see
 * focusFromPointer). Only scripted Tab presses show the ring.
 */

export type CursorHandle = {
  move(x: number, y: number): void;
  show(on: boolean): void;
  press(down: boolean): void;
  pulse(): void;
};

/** The id our virtual mouse uses. 1 is the id browsers give the real mouse. */
const POINTER_ID = 1;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export class DemoAborted extends Error {}

/** Text entry shows a focus ring however it was focused, so a press focuses it plainly. */
const TEXT_ENTRY = 'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="image"]), textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * Whether this engine reads FocusOptions.focusVisible (Chrome 135+, Firefox
 * 104+). Without it a script focus() can't say "this came from a pointer", and
 * Chrome-like heuristics treat it as keyboard focus and draw the ring.
 */
export function supportsFocusVisibleOption(el: Element): boolean {
  let read = false;
  const probe = {
    get focusVisible() {
      read = true;
      return false;
    },
    preventScroll: true,
  };
  // A detached element can't take focus, but the browser still reads the options it understands.
  el.ownerDocument.createElement("div").focus(probe as FocusOptions);
  return read;
}

/**
 * Resolves once the page renders smoothly (five frames in a row under ~30fps
 * budget), or after `maxMs`. A demo that starts while the page is still
 * hydrating would stutter and mistime its holds.
 */
export function whenSmooth(win: Window, maxMs = 2500): Promise<void> {
  return new Promise((resolve) => {
    const start = win.performance.now();
    let last = start;
    let run = 0;
    const tick = (now: number) => {
      run = now - last < 34 ? run + 1 : 0;
      last = now;
      if (run >= 5 || now - start > maxMs) resolve();
      else win.requestAnimationFrame(tick);
    };
    win.requestAnimationFrame(tick);
  });
}

export class DemoPlayer {
  private x: number;
  private y: number;
  private over: Element | null = null;
  private pressedOn: Element | null = null;
  private captured: Element | null = null;
  private restoreCapture: (() => void) | null = null;
  private readonly pseudo: PseudoStateMirror;
  /** Where a pointer press would have put focus, on engines that can't focus without the ring. */
  private pendingFocus: HTMLElement | null = null;
  private focusVisibleOption: boolean | null = null;

  constructor(
    private readonly win: Window,
    private readonly cursor: CursorHandle,
    private readonly signal: AbortSignal,
  ) {
    this.x = win.innerWidth * CURSOR_START[0];
    this.y = win.innerHeight * CURSOR_START[1];
    this.pseudo = new PseudoStateMirror(win.document);
  }

  async play(steps: ParsedStep[]): Promise<void> {
    this.patchCapture();
    this.pseudo.sync();
    try {
      this.cursor.move(this.x, this.y);
      this.cursor.show(true);
      await this.sleep(220);
      for (const step of steps) await this.run(step);
      await this.sleep(500);
    } finally {
      this.release();
    }
  }

  /** Let go of anything held, so a component never stays mid-press after a stop. */
  private release() {
    if (this.pressedOn) {
      const t = this.captured ?? this.pressedOn;
      this.fire(t, "pointercancel", {});
      this.pressedOn = null;
    }
    this.captured = null;
    this.pendingFocus = null;
    this.over = null;
    this.pseudo.dispose();
    this.cursor.press(false);
    this.cursor.show(false);
    this.restoreCapture?.();
    this.restoreCapture = null;
  }

  private async run(s: ParsedStep) {
    switch (s.cmd) {
      case "wait":
        return this.sleep(s.ms);
      case "move":
        return this.glide(s.point[0] * this.win.innerWidth, s.point[1] * this.win.innerHeight, TIMING.glide);
      case "hover":
        return this.glideTo(s.target);
      case "click":
        if (s.target) await this.glideTo(s.target);
        this.down();
        await this.sleep(TIMING.press);
        this.up();
        return;
      case "down":
        return this.down();
      case "up":
        return this.up();
      case "drag":
        this.down();
        await this.glide(s.point[0] * this.win.innerWidth, s.point[1] * this.win.innerHeight, TIMING.drag);
        this.up();
        return;
      case "tab":
        this.applyPendingFocus(); // Tab moves on from where the last press was.
        for (let i = 0; i < s.n; i++) {
          this.tab();
          await this.sleep(TIMING.tabGap);
        }
        return;
      case "key":
        this.applyPendingFocus();
        this.key(s.key);
        return this.sleep(TIMING.keyGap);
      case "type":
        this.applyPendingFocus();
        for (const ch of s.text) {
          this.typeChar(ch);
          await this.sleep(TIMING.typeGap);
        }
        return;
      case "scroll":
        this.win.scrollBy({ top: s.px, behavior: "smooth" });
        return this.sleep(TIMING.scrollSettle);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Pointer                                                            */
  /* ---------------------------------------------------------------- */

  private point(t: DemoTarget): [number, number] | null {
    const el = this.win.document.querySelector(targetSelector(t.name));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    const [fx, fy] = t.at ?? [0.5, 0.5];
    // Off screen (a tall preview): bring it into view first.
    if (r.bottom < 0 || r.top > this.win.innerHeight) {
      el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
      return this.point(t);
    }
    return [r.left + r.width * fx, r.top + r.height * fy];
  }

  private async glideTo(t: DemoTarget) {
    const p = this.point(t);
    if (!p) return; // A missing target is skipped, not fatal: the check script reports it.
    await this.glide(p[0], p[1], TIMING.glide);
  }

  private glide(x: number, y: number, ms: number) {
    const x0 = this.x;
    const y0 = this.y;
    return new Promise<void>((resolve, reject) => {
      const start = performance.now();
      const frame = (now: number) => {
        if (this.signal.aborted) return reject(new DemoAborted());
        const t = Math.min(1, (now - start) / ms);
        const e = ease(t);
        this.pointerAt(x0 + (x - x0) * e, y0 + (y - y0) * e);
        if (t < 1) this.win.requestAnimationFrame(frame);
        else resolve();
      };
      this.win.requestAnimationFrame(frame);
    });
  }

  private pointerAt(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.cursor.move(x, y);
    const el = this.win.document.elementFromPoint(x, y);
    if (el !== this.over) this.cross(this.over, el);
    const target = this.captured ?? el;
    if (target) {
      this.fire(target, "pointermove", {});
      this.fire(target, "mousemove", {}, true);
    }
  }

  /** Over/out and enter/leave, as a browser sends them when the pointer crosses elements. */
  private cross(from: Element | null, to: Element | null) {
    const chain = (el: Element | null) => {
      const out: Element[] = [];
      for (let n = el; n; n = n.parentElement) out.push(n);
      return out;
    };
    const fromChain = chain(from);
    const toChain = chain(to);
    if (from) {
      this.fire(from, "pointerout", { relatedTarget: to });
      this.fire(from, "mouseout", { relatedTarget: to }, true);
      for (const n of fromChain) if (!toChain.includes(n)) {
        this.fire(n, "pointerleave", { relatedTarget: to, bubbles: false });
        this.fire(n, "mouseleave", { relatedTarget: to, bubbles: false }, true);
      }
    }
    if (to) {
      this.fire(to, "pointerover", { relatedTarget: from });
      this.fire(to, "mouseover", { relatedTarget: from }, true);
      for (const n of [...toChain].reverse()) if (!fromChain.includes(n)) {
        this.fire(n, "pointerenter", { relatedTarget: from, bubbles: false });
        this.fire(n, "mouseenter", { relatedTarget: from, bubbles: false }, true);
      }
    }
    this.over = to;
    // :hover lives on the element under the pointer and all its ancestors.
    this.pseudo.sync();
    moveMark(HOVER_ATTR, from, to);
  }

  private down() {
    const el = this.win.document.elementFromPoint(this.x, this.y);
    if (!el) return;
    this.pressedOn = el;
    this.cursor.press(true);
    this.cursor.pulse();
    moveMark(ACTIVE_ATTR, null, el);
    const ok = this.fire(el, "pointerdown", { buttons: 1 });
    this.fire(el, "mousedown", { buttons: 1 }, true);
    // A real press focuses the nearest focusable ancestor (unless prevented).
    if (ok) {
      const f = el.closest<HTMLElement>(FOCUSABLE);
      if (f && this.win.document.activeElement !== f) this.focusFromPointer(f);
    }
  }

  /**
   * Focus as a mouse press does. A bare focus() from script reads as keyboard
   * focus to Chrome's :focus-visible heuristic (there's been no real input in
   * the frame yet), so every pressed button would wear its heavy keyboard ring
   * for the rest of the demo. `focusVisible: false` says "pointer". Text entry
   * keeps the plain call, because a real click shows its ring too.
   *
   * Engines that ignore the option get no focus on a pointer press at all
   * (as Safari does for buttons); the focus is remembered and applied just
   * before the next key or type step, which needs a focused element.
   */
  private focusFromPointer(f: HTMLElement) {
    this.pendingFocus = null;
    if (f.matches(TEXT_ENTRY)) {
      f.focus({ preventScroll: true });
      return;
    }
    this.focusVisibleOption ??= supportsFocusVisibleOption(f);
    if (this.focusVisibleOption) {
      f.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
      return;
    }
    // Leave the old focus, as a press anywhere else does, without drawing a ring on the new target.
    const active = this.win.document.activeElement as HTMLElement | null;
    if (active && active !== this.win.document.body && !active.contains(f)) active.blur();
    this.pendingFocus = f;
  }

  private applyPendingFocus() {
    const f = this.pendingFocus;
    this.pendingFocus = null;
    if (f?.isConnected && this.win.document.activeElement !== f) f.focus({ preventScroll: true });
  }

  private up() {
    const from = this.pressedOn;
    const el = this.captured ?? this.win.document.elementFromPoint(this.x, this.y);
    this.cursor.press(false);
    moveMark(ACTIVE_ATTR, from, null);
    if (!el) return;
    this.fire(el, "pointerup", { buttons: 0 });
    this.fire(el, "mouseup", { buttons: 0 }, true);
    this.pressedOn = null;
    this.captured = null;
    // Click goes to the nearest element containing both ends of the press.
    if (from) {
      let common: Element | null = from;
      while (common && !common.contains(el)) common = common.parentElement;
      if (common) this.fire(common, "click", { buttons: 0, detail: 1 }, true);
    }
  }

  private fire(el: Element, type: string, init: { relatedTarget?: Element | null; bubbles?: boolean; buttons?: number; detail?: number }, mouse = false) {
    const W = this.win as Window & typeof globalThis;
    const common = {
      bubbles: init.bubbles ?? true,
      cancelable: true,
      composed: true,
      clientX: this.x,
      clientY: this.y,
      screenX: this.x,
      screenY: this.y,
      button: type.includes("move") || type.includes("over") || type.includes("out") || type.includes("enter") || type.includes("leave") ? -1 : 0,
      buttons: init.buttons ?? (this.pressedOn ? 1 : 0),
      relatedTarget: init.relatedTarget ?? null,
      detail: init.detail ?? 0,
      view: W,
    };
    const ev = mouse ? new W.MouseEvent(type, common) : new W.PointerEvent(type, { ...common, pointerId: POINTER_ID, pointerType: "mouse", isPrimary: true, width: 1, height: 1, pressure: common.buttons ? 0.5 : 0 });
    return el.dispatchEvent(ev);
  }

  /**
   * While the demo plays, setPointerCapture for our pointer id records the
   * element instead of asking the browser (which would reject a pointer that
   * isn't really down). Restored the moment the demo stops.
   */
  private patchCapture() {
    const proto = (this.win as Window & typeof globalThis).Element.prototype;
    const set = proto.setPointerCapture;
    const rel = proto.releasePointerCapture;
    const has = proto.hasPointerCapture;
    const self = this;
    proto.setPointerCapture = function (this: Element, id: number) {
      if (id === POINTER_ID && self.pressedOn) self.captured = this;
      else set.call(this, id);
    };
    proto.releasePointerCapture = function (this: Element, id: number) {
      if (id === POINTER_ID && self.captured === this) self.captured = null;
      else if (has.call(this, id)) rel.call(this, id);
    };
    proto.hasPointerCapture = function (this: Element, id: number) {
      return (id === POINTER_ID && self.captured === this) || has.call(this, id);
    };
    this.restoreCapture = () => {
      proto.setPointerCapture = set;
      proto.releasePointerCapture = rel;
      proto.hasPointerCapture = has;
    };
  }

  /* ---------------------------------------------------------------- */
  /* Keyboard                                                           */
  /* ---------------------------------------------------------------- */

  private keyInit(key: string) {
    const named: Record<string, string> = { Space: " ", Esc: "Escape" };
    const k = named[key] ?? key;
    const code = k === " " ? "Space" : k.length === 1 ? (/[a-z]/i.test(k) ? `Key${k.toUpperCase()}` : /\d/.test(k) ? `Digit${k}` : k) : k;
    return { key: k, code, bubbles: true, cancelable: true, composed: true, view: this.win };
  }

  private focused(): HTMLElement {
    return (this.win.document.activeElement as HTMLElement | null) ?? this.win.document.body;
  }

  private key(name: string) {
    const W = this.win as Window & typeof globalThis;
    const el = this.focused();
    const init = this.keyInit(name);
    const ok = el.dispatchEvent(new W.KeyboardEvent("keydown", init));
    // The browser's default actions for activation keys.
    const activates = el.matches("button, a[href], [role='button'], [role='option'], [role='radio'], [role='tab'], [role='checkbox'], [role='switch']");
    if (ok && init.key === "Enter" && activates) el.click();
    // Implicit submission: Enter in a single-line field submits its form through the default button.
    else if (ok && init.key === "Enter" && el instanceof W.HTMLInputElement && el.form && el.matches(TEXT_ENTRY)) {
      const submit = el.form.querySelector<HTMLElement>('button:not([type]), button[type="submit"], input[type="submit"]');
      if (submit) {
        if (!submit.matches(":disabled")) submit.click();
      } else el.form.requestSubmit();
    }
    el.dispatchEvent(new W.KeyboardEvent("keyup", init));
    if (ok && init.key === " " && activates) el.click();
  }

  private typeChar(ch: string) {
    const W = this.win as Window & typeof globalThis;
    const el = this.focused();
    const init = this.keyInit(ch);
    const ok = el.dispatchEvent(new W.KeyboardEvent("keydown", init));
    if (ok) {
      if (el instanceof W.HTMLInputElement || el instanceof W.HTMLTextAreaElement) {
        const proto = el instanceof W.HTMLInputElement ? W.HTMLInputElement.prototype : W.HTMLTextAreaElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const next = el.value.slice(0, start) + ch + el.value.slice(end);
        // The native setter, so React's value tracker sees a real change.
        setter?.call(el, next);
        // email, number and a few other types have no selection API and throw on setSelectionRange.
        if (el.selectionStart !== null) el.setSelectionRange(start + 1, start + 1);
        el.dispatchEvent(new W.InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: ch }));
      } else if (el.isContentEditable) {
        this.win.document.execCommand("insertText", false, ch);
      }
    }
    el.dispatchEvent(new W.KeyboardEvent("keyup", init));
  }

  private tab() {
    const W = this.win as Window & typeof globalThis;
    const el = this.focused();
    const ok = el.dispatchEvent(new W.KeyboardEvent("keydown", { ...this.keyInit("Tab") }));
    if (!ok) return;
    const all = [...this.win.document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.tabIndex >= 0 && n.getClientRects().length > 0);
    const i = all.indexOf(el);
    // Keyboard focus: the one scripted step that should show the ring.
    all[(i + 1) % all.length]?.focus({ focusVisible: true } as FocusOptions);
  }

  /**
   * Wait, then let two frames render before the next step. Components animate
   * on animation frames, so on a busy main thread a bare timer could act on a
   * frame that hasn't caught up (releasing a hold before its fill completes).
   */
  private sleep(ms: number) {
    return new Promise<void>((resolve, reject) => {
      if (this.signal.aborted) return reject(new DemoAborted());
      let raf = 0;
      const id = this.win.setTimeout(() => {
        raf = this.win.requestAnimationFrame(() => (raf = this.win.requestAnimationFrame(() => resolve())));
      }, ms);
      this.signal.addEventListener(
        "abort",
        () => {
          this.win.clearTimeout(id);
          this.win.cancelAnimationFrame(raf);
          reject(new DemoAborted());
        },
        { once: true },
      );
    });
  }
}
