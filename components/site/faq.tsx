export type QA = { q: string; a: string };

export function Faq({ items }: { items: QA[] }) {
  return (
    <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
      {items.map((it, i) => (
        <details key={it.q} className="group" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[16px] font-medium tracking-[-0.015em] text-site-fg transition-colors hover:text-white [&::-webkit-details-marker]:hidden">
            {it.q}
            <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 transition-colors group-open:border-white/20 group-open:bg-white/[0.04]" aria-hidden="true">
              <span className="absolute h-px w-2.5 bg-site-fg-2" />
              <span className="absolute h-2.5 w-px bg-site-fg-2 transition-transform duration-300 group-open:rotate-90" />
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
