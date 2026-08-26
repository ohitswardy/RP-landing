import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import Reveal from '../components/Reveal';
import Newsletter from '../components/Newsletter';
import TeamTabs, { type TeamTab } from '../components/TeamTabs';
import { type Person } from '../components/PersonCard';
import { useAboutContent, type AboutCopy } from '../lib/aboutContent';
import { TEAM_ORDER, type StaffProfile, type StaffTeam } from '../lib/peopleContent';

function CompanyOverview({ overview }: { overview: AboutCopy['overview'] }) {
  return (
    <section
      className="relative overflow-hidden text-paper"
      style={{ backgroundColor: 'var(--color-navy-deep)' }}
    >
      {/* Blueprint grid — atmosphere layer */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklab, var(--color-paper) 3%, transparent) 1px, transparent 1px),' +
            'linear-gradient(to bottom, color-mix(in oklab, var(--color-paper) 2%, transparent) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
        }}
      />

      {/* Amber atmospheric glow — far right */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          right: '-240px',
          top: '20%',
          width: '560px',
          height: '560px',
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, oklch(0.760 0.140 62 / 0.09) 0%, transparent 70%)',
        }}
      />

      {/* Whisper glow — left edge */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          left: '-160px',
          bottom: '10%',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, oklch(0.760 0.140 62 / 0.045) 0%, transparent 70%)',
        }}
      />

      <div
        className="container-fluid relative"
        style={{
          paddingTop:    'clamp(5rem, 8vw, 7.5rem)',
          paddingBottom: 'clamp(5rem, 8vw, 7.5rem)',
        }}
      >
        {/* ── Section Header ──────────────────────────────────── */}

        <Reveal delay={0.05}>
          <h2
            className="text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] tracking-[-0.028em] font-medium"
            style={{ maxWidth: '22ch' }}
          >
            {overview.heading}
          </h2>
        </Reveal>

        {/* Full-width amber-to-line divider */}
        <Reveal delay={0.09}>
          <div
            aria-hidden
            className="mt-12 mb-14"
            style={{
              height: '1px',
              background: 'linear-gradient(to right, var(--color-amber) 0%, var(--color-navy-line) 55%, transparent 100%)',
            }}
          />
        </Reveal>

        {/* ── Editorial Two-Column ────────────────────────────── */}
        <div className="grid grid-cols-12 gap-x-6 gap-y-14">

          {/* Left: narrative prose, an amber tick between paragraphs */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-8">
            {overview.paragraphs.flatMap((para, i) => {
              const nodes = [];
              if (i > 0) {
                nodes.push(
                  <Reveal key={`rule-${i}`} delay={0.08 + i * 0.06}>
                    <div
                      aria-hidden
                      style={{ height: '1px', width: '36px', background: 'var(--color-amber)', opacity: 0.5 }}
                    />
                  </Reveal>,
                );
              }
              nodes.push(
                <Reveal key={`para-${i}`} delay={0.11 + i * 0.06}>
                  <p
                    className="text-[17px] leading-[1.72]"
                    style={{ color: 'oklch(0.992 0.003 80 / 0.72)', maxWidth: '65ch' }}
                  >
                    {para}
                  </p>
                </Reveal>,
              );
              return nodes;
            })}
          </div>

          {/* Right: firm profile registry */}
          <Reveal delay={0.16} className="col-span-12 lg:col-span-5">
            <div className="lg:pl-12">
              <div
                className="border-t pt-8"
                style={{ borderColor: 'var(--color-navy-line)' }}
              >
                <div
                  style={{
                    fontFamily:    'var(--font-mono)',
                    fontSize:      '10.5px',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color:         'oklch(0.992 0.003 80 / 0.34)',
                    marginBottom:  '1.75rem',
                  }}
                >
                  Company Profile
                </div>

                <dl>
                  {overview.profile.map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex justify-between items-baseline gap-4 py-4 border-b"
                      style={{ borderColor: 'var(--color-navy-line)' }}
                    >
                      <dt
                        style={{
                          fontFamily:    'var(--font-mono)',
                          fontSize:      '10.5px',
                          letterSpacing: '0.09em',
                          textTransform: 'uppercase',
                          color:         'oklch(0.992 0.003 80 / 0.38)',
                          flexShrink:    0,
                        }}
                      >
                        {label}
                      </dt>
                      <dd
                        className="text-right"
                        style={{
                          fontSize:   '13.5px',
                          lineHeight: '1.45',
                          color:      'oklch(0.992 0.003 80 / 0.80)',
                        }}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Reveal>

        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   About Hero — cinematic split-panel with portrait lobby image
───────────────────────────────────────────────────────────── */
const heroEase = [0.25, 1, 0.5, 1] as const;

function AboutHero({ hero }: { hero: AboutCopy['hero'] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  /* Parallax layers — image drifts up, content holds steady */
  const imgY      = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const contentY  = useTransform(scrollYProgress, [0, 1], ['0%', '-5%']);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden text-paper flex items-center"
      style={{ minHeight: 'clamp(580px, 82vh, 820px)', backgroundColor: 'var(--color-navy)' }}
    >

      {/* ── Left panel: navy + blueprint grid ─────────────────── */}
      {/* With no photo it spans the full width — otherwise the grid would
          stop dead at 58% and leave a seam against flat navy. */}
      <div
        aria-hidden
        className={`absolute inset-0 ${hero.image ? 'lg:right-[42%]' : ''}`}
        style={{
          backgroundColor: 'var(--color-navy)',
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklab, var(--color-paper) 4%, transparent) 1px, transparent 1px),' +
            'linear-gradient(to bottom, color-mix(in oklab, var(--color-paper) 3%, transparent) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
        }}
      />

      {/* ── Amber atmospheric glow — bottom-left ─────────────── */}
      <div
        aria-hidden
        className="absolute -left-60 -bottom-60 w-225 h-225 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, oklch(0.760 0.140 62 / 0.22) 0%, transparent 70%)' }}
      />

      {/* ── Amber whisper accent — upper-left ────────────────── */}
      <div
        aria-hidden
        className="absolute left-[6%] top-[18%] w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, oklch(0.760 0.140 62 / 0.055) 0%, transparent 70%)' }}
      />

      {/* ── RIGHT PANEL: portrait image — desktop only ────────── */}
      {/* No photo set: the navy blueprint panel carries the hero on its own. */}
      {hero.image && (
      <div
        aria-hidden
        className="hidden lg:block absolute right-0 top-0 bottom-0"
        style={{ width: '44%' }}
      >
        <div className="absolute inset-0 overflow-hidden">

          {/* Parallax image — oversized for travel headroom */}
          <motion.div
            className="absolute"
            style={{ top: '-12%', bottom: '-12%', left: 0, right: 0, y: imgY }}
          >
            <img
              src={hero.image}
              alt=""
              aria-hidden
              className="w-full h-full object-cover"
              style={{ objectPosition: '50% 18%' }}
            />
          </motion.div>

          {/* Left-edge hard blend: navy → image (the panel seam) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to right,' +
                  'oklch(0.215 0.048 260 / 1.00)  0%,' +
                  'oklch(0.215 0.048 260 / 0.84) 10%,' +
                  'oklch(0.215 0.048 260 / 0.46) 26%,' +
                  'oklch(0.215 0.048 260 / 0.10) 46%,' +
                  'transparent 68%)',
            }}
          />

          {/* Right-edge fade to deep navy */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to left,' +
                  'oklch(0.165 0.040 260 / 0.72) 0%,' +
                  'oklch(0.165 0.040 260 / 0.22) 30%,' +
                  'transparent 58%)',
            }}
          />

          {/* Top vignette */}
          <div
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{
              height: '38%',
              background: 'linear-gradient(to bottom, oklch(0.215 0.048 260 / 0.84) 0%, transparent 100%)',
            }}
          />

          {/* Bottom vignette — blends to next section */}
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{
              height: '50%',
              background:
                'linear-gradient(to top,' +
                  'oklch(0.165 0.040 260 / 0.96) 0%,' +
                  'oklch(0.165 0.040 260 / 0.48) 50%,' +
                  'transparent 100%)',
            }}
          />

          {/* Navy tint for OKLCH colour-space harmony */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'oklch(0.215 0.048 260 / 0.14)', mixBlendMode: 'multiply' }}
          />
        </div>
      </div>
      )}

      {/* ── MOBILE: full-bleed image backdrop ────────────────── */}
      {hero.image && (
      <div aria-hidden className="lg:hidden absolute inset-0">
        <img
          src={hero.image}
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: '42% 22%' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(155deg,' +
                'oklch(0.165 0.040 260 / 0.97)  0%,' +
                'oklch(0.165 0.040 260 / 0.92) 42%,' +
                'oklch(0.215 0.048 260 / 0.80) 72%,' +
                'oklch(0.215 0.048 260 / 0.68) 100%)',
          }}
        />
      </div>
      )}

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="container-fluid relative w-full py-12">
        <motion.div style={{ y: contentY }}>

          {/* Eyebrow — an empty one is just a stray tick, so skip the block */}
          {hero.eyebrow && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: heroEase }}
              className="eyebrow eyebrow-paper mb-10"
            >
              {hero.eyebrow}
            </motion.div>
          )}

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, ease: heroEase, delay: 0.05 }}
            className="text-[clamp(2.5rem,6vw,5.5rem)] leading-[1.03] tracking-[-0.028em] font-medium"
            style={{ maxWidth: '18ch' }}
          >
            {hero.title}
          </motion.h1>

          {/* Amber gradient divider rule */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 1.0, ease: heroEase, delay: 0.38 }}
            aria-hidden
            className="origin-left mt-12 mb-10"
            style={{
              height: '1px',
              width: 'min(300px, 100%)',
              background: 'linear-gradient(to right, var(--color-amber), transparent)',
            }}
          />

        </motion.div>
      </div>
    </section>
  );
}

/** Tab ids kept stable so the ?tab= deep links on the site still resolve. */
const TEAM_IDS: Record<StaffTeam, string> = {
  'Board of Directors': 'board',
  'Research': 'research',
  'Sales & Trading': 'sales',
  'Operations': 'operations',
};

/** Map a published profile onto the shape the card and dialog render. */
function toPerson(p: StaffProfile): Person {
  return {
    n: p.name,
    r: p.roles.length > 1 ? p.roles : (p.roles[0] ?? ''),
    e: p.bio,
    sectors: p.sectors.length > 0 ? p.sectors : undefined,
    phone: p.phone || undefined,
    email: p.email || undefined,
    img: p.img || undefined,
  };
}

function LeadershipSection({ heading, people }: { heading: string; people: StaffProfile[] | null }) {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') ?? undefined;

  // Only teams with someone published get a tab.
  const teamTabs: TeamTab[] = useMemo(() => {
    if (!people) return [];
    return TEAM_ORDER
      .map((team) => ({
        id: TEAM_IDS[team],
        label: team === 'Board of Directors' ? 'Board of Directors' : team,
        people: people.filter((p) => p.team === team).map(toPerson),
      }))
      .filter((t) => t.people.length > 0);
  }, [people]);

  const [activeLabel, setActiveLabel] = useState('');
  const resolvedLabel =
    activeLabel || teamTabs.find((t) => t.id === initialTab)?.label || teamTabs[0]?.label || '';

  return (
    <>
      <Reveal className="max-w-3xl mb-10">
        <div className="eyebrow mb-6">{resolvedLabel || 'Leadership'}</div>
        <h2 className="text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] tracking-tight">
          {heading}
        </h2>
      </Reveal>
      {people === null ? (
        <RosterSkeleton />
      ) : teamTabs.length === 0 ? (
        <p className="text-slate text-[14.5px]">The roster is being updated.</p>
      ) : (
        <TeamTabs
          key={teamTabs.map((t) => t.id).join('-')}
          tabs={teamTabs}
          onTabChange={setActiveLabel}
          initialTab={initialTab}
        />
      )}
    </>
  );
}

/** First paint, before the roster lands. */
function RosterSkeleton() {
  return (
    <div>
      <div className="flex gap-6 border-b rule mb-14 pb-3.5">
        {[72, 62, 90, 74].map((w, i) => (
          <div key={i} className="h-3 skeleton-bar" style={{ width: w, animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i}>
            <div className="aspect-4/5 skeleton-bar mb-5" style={{ animationDelay: `${i * 90}ms` }} />
            <div className="h-4 w-[62%] skeleton-bar" style={{ animationDelay: `${i * 90 + 60}ms` }} />
            <div className="mt-2.5 h-3 w-[44%] skeleton-bar" style={{ animationDelay: `${i * 90 + 120}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function About() {
  const { copy, people } = useAboutContent();

  return (
    <>
      <AboutHero hero={copy.hero} />
      <CompanyOverview overview={copy.overview} />

      <section id="heritage" className="bg-paper scroll-mt-16">
        <div className="container-fluid py-24 md:py-32">
          <div className="grid grid-cols-12 gap-x-6 gap-y-12">
            <Reveal className="col-span-12 lg:col-span-4">
              {copy.heritage.eyebrow && <div className="eyebrow mb-6">{copy.heritage.eyebrow}</div>}
              <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.08] tracking-[-0.02em]">
                {copy.heritage.heading}
              </h2>
            </Reveal>
            <ol className="col-span-12 lg:col-span-8 border-t rule">
              {copy.heritage.timeline.map((e, i) => (
                <Reveal key={i} delay={i * 0.05} className="grid grid-cols-12 gap-x-6 items-baseline border-b rule py-7">
                  <div className="col-span-3 md:col-span-2 num text-2xl md:text-3xl tracking-[-0.02em]">{e.year}</div>
                  <div className="col-span-9 md:col-span-4 text-lg md:text-xl tracking-[-0.012em] font-medium">{e.title}</div>
                  <div className="col-span-12 md:col-span-6 text-slate text-[14.5px] leading-relaxed mt-2 md:mt-0">{e.body}</div>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="leadership" className="bg-bone scroll-mt-16">
        <div className="container-fluid py-24 md:py-32">
          <LeadershipSection heading={copy.leadership.heading} people={people} />
        </div>
      </section>

      <section id="awards" className="bg-paper scroll-mt-16">
        <div className="container-fluid py-24 md:py-32">
          <Reveal className="max-w-3xl mb-12">
            {copy.awards.eyebrow && <div className="eyebrow mb-6">{copy.awards.eyebrow}</div>}
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.05] tracking-[-0.02em]">
              {copy.awards.heading}
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
            {copy.awards.groups.map((group) => (
              <Reveal key={group.org} className="border-b rule pt-6 pb-8">
                <p
                  className="font-mono text-[13px] font-semibold tracking-[0.1em] uppercase mb-4"
                  style={{ color: 'var(--color-slate)' }}
                >
                  {group.org}
                </p>
                <ul>
                  {group.items.map((item) => (
                    <motion.li
                      key={item.name}
                      className="relative flex items-baseline justify-between gap-4 py-3 border-t rule first:border-t-0 cursor-default overflow-hidden"
                      whileHover="hovered"
                      initial="rest"
                    >
                      {/* Amber wash on hover */}
                      <motion.div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none"
                        style={{ backgroundColor: 'var(--color-amber)' }}
                        variants={{ rest: { opacity: 0 }, hovered: { opacity: 0.055 } }}
                        transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                      />
                      {/* Left accent bar */}
                      <motion.div
                        aria-hidden
                        className="absolute left-0 top-0 bottom-0 w-0.5 pointer-events-none"
                        style={{ backgroundColor: 'var(--color-amber)' }}
                        variants={{ rest: { scaleY: 0, originY: 0 }, hovered: { scaleY: 1, originY: 0 } }}
                        transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                      />
                      <motion.span
                        className="relative pl-3 text-[15px] tracking-[-0.01em] font-medium"
                        variants={{ rest: { x: 0 }, hovered: { x: 3 } }}
                        transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                      >
                        {item.name}
                      </motion.span>
                      <motion.span
                        className="relative text-[13px] text-right shrink-0 tabular-nums"
                        style={{ color: 'var(--color-slate)' }}
                        variants={{ rest: { opacity: 0.65 }, hovered: { opacity: 1 } }}
                        transition={{ duration: 0.2 }}
                      >
                        {item.years}
                      </motion.span>
                    </motion.li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Newsletter />
    </>
  );
}
