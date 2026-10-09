export type QA = { q: string; a: string };

export function Faq({ items }: { items: QA[] }) {
  return (
    <div className="site-disclosure divide-y divide-white/[0.07] border-y border-white/[0.07]">
      {items.map((it, i) => (
        <details key={it.q} className="site-reveal group" open={i === 0}>
          <summary className="group/s flex cursor-pointer list-none items-center justify-between gap-6 rounded-md py-5 text-[16px] font-medium tracking-[-0.015em] text-site-fg-2 transition-colors hover:text-site-fg group-open:text-site-fg [&::-webkit-details-marker]:hidden">
            {it.q}
            <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 transition duration-300 ease-site group-hover/s:border-white/25 group-hover/s:bg-white/[0.04] group-active/s:scale-95 group-open:rotate-180 group-open:border-white/20 group-open:bg-white/[0.06]" aria-hidden="true">
              <span className="absolute h-px w-2.5 bg-site-fg-2" />
              <span className="absolute h-2.5 w-px bg-site-fg-2 transition-transform duration-300 ease-site group-open:rotate-90" />
            </span>
          </summary>
          <p className="max-w-[68ch] pb-6 text-[15px] leading-relaxed text-site-fg-2">{it.a}</p>
        </details>
      ))}
    </div>
  );
}

export const faqJsonLd = (items: QA[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })),
});
