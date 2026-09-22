import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../cms/auth';
import { EmptyState, ModuleHeader } from '../../cms/ui';
import { IconArrowRight, IconSearch } from '../../cms/icons';
import { HELP_SECTIONS, type HelpSection } from '../help/content';

/* ─────────────────────────────────────────────────────────────
   Help. The in-app guide, rendered from help/content.ts: one
   anchored section per module (plus the basics), filtered
   client-side by the search box and by what the signed-in role
   can open. Nothing fetched; the content ships with the build.
   ───────────────────────────────────────────────────────────── */

function matches(s: HelpSection, q: string): boolean {
  if (!q) return true;
  const hay = [s.code, s.title, s.summary, ...s.actions, ...s.gotchas].join('\n').toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((term) => hay.includes(term));
}

function Mark({ text, q }: { text: string; q: string }) {
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  // One capture group, so split() interleaves the matches at the odd indices.
  return <>{text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i} className="bg-transparent text-ink underline decoration-[color:var(--color-amber)] decoration-2 underline-offset-2">{part}</mark> : <span key={i}>{part}</span>))}</>;
}

function Section({ s, q }: { s: HelpSection; q: string }) {
  return (
    <article id={s.id} className="scroll-mt-[calc(var(--cms-header-h,64px)+24px)] border-t rule pt-8">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-4">
          <span className="mono num text-[10.5px] tracking-[0.2em] text-silver">{s.code}</span>
          <h2 className="text-[19px] font-medium tracking-[-0.01em] text-ink"><Mark text={s.title} q={q} /></h2>
        </div>
        {s.to && (
          <Link to={s.to} className="mono inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink">
            Open module <IconArrowRight size={11} />
          </Link>
        )}
      </header>
      <p className="mt-4 max-w-[72ch] text-[14px] leading-relaxed text-slate"><Mark text={s.summary} q={q} /></p>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mono mb-3 text-[9.5px] uppercase tracking-[0.2em] text-graphite">What you do here</div>
          <ul className="space-y-2.5">
            {s.actions.map((a, i) => (
              <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-slate">
                <span className="mono num mt-[3px] shrink-0 text-[9.5px] text-silver">{String(i + 1).padStart(2, '0')}</span>
                <span><Mark text={a} q={q} /></span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mono mb-3 text-[9.5px] uppercase tracking-[0.2em]" style={{ color: 'var(--color-amber-deep)' }}>Worth knowing</div>
          <ul className="space-y-2.5">
            {s.gotchas.map((g, i) => (
              <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-slate">
                <span aria-hidden className="mt-[9px] block h-[2px] w-3 shrink-0" style={{ background: 'var(--color-amber)' }} />
                <span><Mark text={g} q={q} /></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export default function HelpModule() {
  const { can } = useAuth();
  const { hash } = useLocation();
  const [q, setQ] = useState('');

  const visible = useMemo(() => HELP_SECTIONS.filter((s) => !s.perm || can(s.perm)), [can]);
  const shown = useMemo(() => visible.filter((s) => matches(s, q.trim().toLowerCase())), [visible, q]);
  const hidden = HELP_SECTIONS.length - visible.length;

  // Deep links (/crms/help#events) land on their section once the page has rendered.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <div className="space-y-10">
      <ModuleHeader
        code="15 · Help"
        title="How the CRMS works"
        blurb="One entry per module: what it is for, what you do there, and the behaviour that catches people out. Search across all of it."
        actions={
          <label className="flex items-center gap-2 border rule bg-white px-3">
            <IconSearch size={13} className="text-silver" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the guide" className="w-[240px] bg-transparent py-2.5 text-[13px] outline-none placeholder:text-silver" aria-label="Search the guide" />
          </label>
        }
      />

      <div className="grid gap-12 lg:grid-cols-12">
        <nav aria-label="Guide sections" className="lg:col-span-3">
          <div className="lg:sticky lg:top-[calc(var(--cms-header-h,64px)+24px)]">
            <div className="mono mb-3 text-[9.5px] uppercase tracking-[0.2em] text-graphite">Contents</div>
            <ol className="space-y-1.5 border-l rule">
              {visible.map((s) => {
                const on = shown.includes(s);
                return (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className={`-ml-px flex items-baseline gap-3 border-l-2 py-0.5 pl-4 text-[12.5px] transition-colors ${on ? 'border-transparent text-slate hover:border-[color:var(--color-amber)] hover:text-ink' : 'border-transparent text-silver'}`}>
                      <span className="mono num text-[9.5px] tracking-[0.16em]">{s.code}</span>
                      <span className="truncate">{s.title}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
            <p className="mono mt-5 text-[9.5px] uppercase tracking-[0.16em] text-silver">
              {shown.length} of {visible.length} sections{hidden > 0 ? ` · ${hidden} hidden by role` : ''}
            </p>
          </div>
        </nav>

        <div className="space-y-10 lg:col-span-9">
          {shown.length === 0 ? (
            <EmptyState title="Nothing matches." hint="Try a module name, a status such as flagged or unlinked, or an error code like 409." />
          ) : shown.map((s) => <Section key={s.id} s={s} q={q.trim().toLowerCase()} />)}
        </div>
      </div>
    </div>
  );
}
