import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';
import { Link, useParams } from 'react-router-dom';
import Newsletter from '../components/Newsletter';
import { useServicesContent, type ServiceLine, type ServicePage } from '../lib/servicesContent';

export default function Services() {
  const { slug } = useParams();
  const content = useServicesContent();

  if (!content) return <ServicesSkeleton />;

  const key = slug?.toLowerCase();
  const service = key ? content.services.find((s) => s.slug.toLowerCase() === key) : undefined;

  return service
    ? <PracticePage service={service} />
    : <ServicesIndex page={content.page} services={content.services} />;
}

/* ── /services ─────────────────────────────────────────────── */

function ServicesIndex({ page, services }: { page: ServicePage; services: ServiceLine[] }) {
  return (
    <>
      <PageHeader
        eyebrow={page.eyebrow || undefined}
        title={page.title}
        dek={page.dek || undefined}
        bgImage={page.heroImage || undefined}
      />
      <section className="bg-paper">
        <div className="container-fluid py-24 md:py-32">
          <div className="grid grid-cols-1 md:grid-cols-2 border-t border-l rule">
            {services.map((s, i) => (
              <Reveal key={s.slug} delay={i * 0.06} className="border-r border-b rule p-10 md:p-12 hover:bg-bone transition-colors duration-500 group">
                <Link to={`/services/${s.slug}`} className="block">
                  <h3 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.08] tracking-[-0.022em] font-medium">
                    {s.title}
                  </h3>
                  <p className="mt-6 text-slate text-[15px] leading-relaxed max-w-[44ch]">{s.dek}</p>
                  <div className="mt-10 inline-flex items-center gap-3 text-[13.5px] text-ink group-hover:text-[color:var(--color-amber-deep)] transition-colors">
                    {page.cardCta}
                    <span className="block h-px w-10 bg-ink/30 group-hover:w-16 group-hover:bg-[color:var(--color-amber-deep)] transition-all duration-500" />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <Newsletter />
    </>
  );
}

/* ── /services/:slug ───────────────────────────────────────── */

function PracticePage({ service }: { service: ServiceLine }) {
  const slides = service.heroImages.length > 0 ? service.heroImages : service.img ? [service.img] : [];

  return (
    <>
      <PageHeader
        eyebrow={service.eyebrow || undefined}
        title={service.title}
        dek={service.dek || undefined}
        bgImage={slides.length === 1 ? slides[0] : undefined}
        bgImages={slides.length > 1 ? slides : undefined}
      />

      {service.proof.length > 0 && (
        <section className="bg-bone border-b rule">
          <div className="container-fluid">
            <dl className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x rule">
              {service.proof.map((p, i) => (
                <Reveal key={`${p.value}-${i}`} delay={i * 0.06} className="py-8 sm:py-10 sm:px-8 sm:first:pl-0 sm:last:pr-0">
                  <dt className="mono num text-[clamp(1.5rem,2.6vw,2.1rem)] leading-none tracking-[-0.02em] text-ink">
                    {p.value}
                  </dt>
                  <dd className="mono mt-3 text-[11px] uppercase tracking-[0.18em] text-graphite">{p.label}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>
      )}

      <section className="bg-paper">
        <div className="container-fluid py-24 md:py-32">
          <div className="grid grid-cols-12 gap-x-6 gap-y-12">
            <Reveal className="col-span-12 lg:col-span-4">
              {service.eyebrow && <div className="eyebrow mb-6">{service.eyebrow}</div>}
              <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.08] tracking-[-0.02em]">
                {service.introHeading}
              </h2>
            </Reveal>
            <ul className="col-span-12 lg:col-span-8 border-t rule">
              {service.pillars.map((p, i) => (
                <Reveal key={`${p.title}-${i}`} delay={i * 0.05} className="grid grid-cols-12 gap-x-6 items-baseline border-b rule py-8">
                  <div className="col-span-1 mono text-[11px] tracking-[0.16em] uppercase text-graphite">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="col-span-11 md:col-span-5 text-lg md:text-xl tracking-[-0.012em] font-medium">{p.title}</div>
                  <div className="col-span-12 md:col-span-6 text-slate text-[14.5px] leading-relaxed mt-2 md:mt-0">{p.body}</div>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Newsletter />
    </>
  );
}

/* ── First paint, before the content lands ─────────────────── */

function ServicesSkeleton() {
  return (
    <>
      <section className="bg-blueprint relative overflow-hidden">
        <div className="container-fluid pt-20 md:pt-28 pb-20 md:pb-28">
          <div className="h-3 w-32 skeleton-bar opacity-30" />
          <div className="mt-10 h-12 w-[min(560px,80%)] skeleton-bar opacity-30" />
          <div className="mt-9 h-3 w-[min(420px,70%)] skeleton-bar opacity-25" />
        </div>
      </section>
      <section className="bg-paper">
        <div className="container-fluid py-24 md:py-32">
          <div className="grid grid-cols-1 md:grid-cols-2 border-t border-l rule">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border-r border-b rule p-10 md:p-12">
                <div className="h-7 w-[60%] skeleton-bar" style={{ animationDelay: `${i * 90}ms` }} />
                <div className="mt-6 h-3 w-[85%] skeleton-bar" style={{ animationDelay: `${i * 90 + 60}ms` }} />
                <div className="mt-2.5 h-3 w-[70%] skeleton-bar" style={{ animationDelay: `${i * 90 + 120}ms` }} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
