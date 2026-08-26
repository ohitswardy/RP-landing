import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { ServiceLine, ServicePage } from '../../data';

const OVERLAY =
  'linear-gradient(to top, oklch(0.14 0.040 260 / 0.88) 0%, oklch(0.14 0.040 260 / 0.70) 50%, oklch(0.14 0.040 260 / 0.55) 100%)';

/** Browser-ish frame so the preview reads as the page, not as a card. */
export function PreviewFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden border rule bg-paper">
      <div className="flex items-center gap-2.5 border-b rule bg-bone px-3 py-2">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-silver)' }} />
          ))}
        </span>
        <span className="mono truncate text-[9.5px] tracking-[0.1em] text-graphite">regispartners.com{url}</span>
      </div>
      <div className="max-h-[62vh] overflow-y-auto">{children}</div>
    </div>
  );
}

/** Header band, mirroring PageHeader — including its 2.5s cross-fade. */
function Hero({ images, eyebrow, title, dek }: { images: string[]; eyebrow: string; title: string; dek: string }) {
  const [current, setCurrent] = useState(0);
  const slideshow = images.length > 1;

  useEffect(() => {
    setCurrent(0);
    if (!slideshow) return;
    const id = setInterval(() => setCurrent((c) => (c + 1) % images.length), 2500);
    return () => clearInterval(id);
  }, [slideshow, images.length]);

  return (
    <div className={`relative overflow-hidden px-5 py-8 text-paper ${images.length === 0 ? 'bg-blueprint' : ''}`}>
      {images.map((src, i) => (
        <motion.img
          key={`${src}-${i}`}
          src={src}
          alt=""
          aria-hidden
          animate={{ opacity: slideshow ? (i === current ? 1 : 0) : 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      ))}
      {images.length > 0 && <div aria-hidden className="absolute inset-0" style={{ background: OVERLAY }} />}

      <div className="relative">
        {eyebrow && <div className="eyebrow eyebrow-paper mb-4" style={{ fontSize: 9 }}>{eyebrow}</div>}
        <h2 className="max-w-[16ch] text-[22px] font-medium leading-[1.06] tracking-[-0.025em]">
          {title || 'Untitled page'}
        </h2>
        {dek && <p className="mt-4 max-w-[46ch] text-[11.5px] leading-[1.6] text-paper/70">{dek}</p>}
      </div>
    </div>
  );
}

/** The live shape of /services/:slug as the draft currently stands. */
export function ServicePreview({ draft }: { draft: Pick<ServiceLine, 'eyebrow' | 'title' | 'dek' | 'introHeading' | 'heroImages' | 'pillars' | 'proof'> }) {
  return (
    <div className="bg-paper">
      <Hero images={draft.heroImages} eyebrow={draft.eyebrow} title={draft.title} dek={draft.dek} />

      {draft.proof.length > 0 && (
        <div className="grid grid-cols-3 divide-x rule border-b rule bg-bone">
          {draft.proof.map((p, i) => (
            <div key={i} className="px-3 py-4">
              <div className="mono num text-[15px] leading-none tracking-[-0.02em] text-ink">{p.value || '—'}</div>
              <div className="mono mt-1.5 text-[8.5px] uppercase leading-tight tracking-[0.16em] text-graphite">{p.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-7">
        {draft.eyebrow && <div className="eyebrow mb-3" style={{ fontSize: 9 }}>{draft.eyebrow}</div>}
        <h3 className="max-w-[18ch] text-[17px] leading-[1.1] tracking-[-0.02em]">{draft.introHeading}</h3>

        <ul className="mt-6 border-t rule">
          {draft.pillars.map((p, i) => (
            <li key={i} className="grid grid-cols-12 gap-x-3 border-b rule py-3.5">
              <span className="mono col-span-2 text-[9px] uppercase tracking-[0.16em] text-graphite">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="col-span-10">
                <div className="text-[12.5px] font-medium leading-snug tracking-[-0.01em] text-ink">{p.title || 'Untitled row'}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-slate">{p.body}</div>
              </div>
            </li>
          ))}
          {draft.pillars.length === 0 && (
            <li className="border-b rule py-6 text-center text-[11.5px] text-graphite">No rows yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

/** The /services index: header band plus the practice cards, in order. */
export function LandingPreview({
  page, services,
}: {
  page: ServicePage;
  services: Array<Pick<ServiceLine, 'id' | 'title' | 'dek' | 'live'>>;
}) {
  const live = services.filter((s) => s.live);

  return (
    <div className="bg-paper">
      <Hero images={page.heroImage ? [page.heroImage] : []} eyebrow={page.eyebrow} title={page.title} dek={page.dek} />

      <div className="grid grid-cols-1 border-l border-t rule sm:grid-cols-2">
        {live.map((s) => (
          <div key={s.id} className="border-b border-r rule px-4 py-5">
            <div className="text-[14px] font-medium leading-tight tracking-[-0.02em] text-ink">{s.title}</div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate">{s.dek}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-[10.5px] text-ink">
              {page.cardCta}
              <span className="block h-px w-6 bg-ink/30" />
            </div>
          </div>
        ))}
        {live.length === 0 && (
          <div className="border-b border-r rule px-4 py-10 text-center text-[11.5px] text-graphite sm:col-span-2">
            Every practice is unpublished — the landing page would render empty.
          </div>
        )}
      </div>
    </div>
  );
}
