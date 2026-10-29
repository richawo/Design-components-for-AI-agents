/** Resolve recorder pointer targets inside their actual scrolling panes. */
export function createRecordTargetResolver({ page, targetSelector, onProblem, advance }) {
  return async (t, moving = false) => {
    const lookup = page.evaluate(({ sel, moving }) => new Promise(resolve => {
      let previous, stable = 0, frame;
      const finish = value => { clearTimeout(timer); cancelAnimationFrame(frame); resolve(value); };
      const timer = setTimeout(() => finish(null), 2500);
      const sample = () => {
        const el = [...document.querySelectorAll(sel)].find(node =>
          !node.closest('[inert], [hidden]') && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
        if (el) {
          let b = el.getBoundingClientRect();
          const outsideViewport = b.top < 0 || b.bottom > innerHeight || b.left < 0 || b.right > innerWidth;
          let clipped = false;
          for (let parent = el.parentElement; parent; parent = parent.parentElement) {
            if (parent.scrollWidth <= parent.clientWidth && parent.scrollHeight <= parent.clientHeight) continue;
            const style = getComputedStyle(parent);
            const bounds = parent.getBoundingClientRect();
            if (
              (["auto", "scroll"].includes(style.overflowX) && (b.left < bounds.left || b.right > bounds.right)) ||
              (["auto", "scroll"].includes(style.overflowY) && (b.top < bounds.top || b.bottom > bounds.bottom))
            ) {
              clipped = true;
              break;
            }
          }
          if (outsideViewport || clipped) {
            const align = outsideViewport ? "center" : "nearest";
            el.scrollIntoView({block:align,inline:align,behavior:'instant'});
            b = el.getBoundingClientRect();
          }
          const next = {x:b.x,y:b.y,w:b.width,h:b.height};
          stable = previous && Object.keys(next).every(key => Math.abs(next[key]-previous[key]) <= 0.5) ? stable + 1 : 0;
          previous = next;
          if (b.width && b.height && (moving || stable >= 2)) return finish(next);
        } else { previous = undefined; stable = 0; }
        frame = requestAnimationFrame(sample);
      };
      frame = requestAnimationFrame(sample);
    }), { sel: targetSelector(t.name), moving });
    if(advance){let done=false;lookup.then(()=>{done=true;},()=>{done=true;});while(!done)await advance(1000/60);}
    const r=await lookup;
    if (!r) {
      onProblem(`demo target @${t.name} unavailable or still moving when its step ran`);
      return null;
    }
    const [fx, fy] = t.at ?? [0.5, 0.5];
    return [r.x + r.w * fx, r.y + r.h * fy];
  };
}
