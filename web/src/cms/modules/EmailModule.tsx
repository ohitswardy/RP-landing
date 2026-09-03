import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../store';
import { apiFetch } from '../../lib/api';
import {
  BtnGhost, BtnPrimary, Chip, EmptyState, ModuleHeader, RowAction, SkeletonRows, Stat, useConfirm, EASE,
} from '../ui';
import { Modal } from '../kit/parts';
import { IconCheck, IconCopy, IconEye, IconPen, IconPlus, IconSearch, IconTrash } from '../icons';
import {
  BLAST_KIND, BLAST_STATUS, fmtDate, timeAgo,
  type AudienceClient, type AudienceSubscriber, type AuditEntry, type BlastStatus, type EmailBlast,
} from '../data';
import BlastComposer from './email/BlastComposer';

/* ─────────────────────────────────────────────────────────────
   The Email desk. Every blast — newsletter issues, research
   reports, ad-hoc notes — is drafted, previewed, and edited here
   before it goes out through Outlook. Nothing is dispatched from
   the server: sending is copy-into-Outlook, then the blast is
   marked sent, recording who sent it and from which account.
   ───────────────────────────────────────────────────────────── */

type Filter = 'all' | BlastStatus;
const FILTERS: Filter[] = ['all', 'draft', 'ready', 'sent'];

type Audience = { clients: AudienceClient[]; subscribers: AudienceSubscriber[] };

export default function EmailModule() {
  const { appendAudit } = useCms();

  const [blasts, setBlasts] = useState<EmailBlast[]>([]);
  const [audience, setAudience] = useState<Audience>({ clients: [], subscribers: [] });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [composer, setComposer] = useState<{ editingId: string | null; base: EmailBlast | null } | null>(null);
  const [viewing, setViewing] = useState<EmailBlast | null>(null);
  const [armed, confirm] = useConfirm();
  const alive = useRef(true);

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const [ledger, pool] = await Promise.all([
        apiFetch<{ items: EmailBlast[] }>('/cms/email-blasts', { audience: 'cms' }),
        apiFetch<Audience>('/cms/email-blasts/audience', { audience: 'cms' }),
      ]);
      if (!alive.current) return;
      setBlasts(ledger.items);
      setAudience(pool);
      setStatus('ready');
    } catch (e) {
      if (!alive.current) return;
      setLoadError(e instanceof Error ? e.message : 'The Email desk could not load.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [load]);

  const counts = useMemo(() => {
    const m = new Map<BlastStatus, number>();
    for (const b of blasts) m.set(b.status, (m.get(b.status) ?? 0) + 1);
    return m;
  }, [blasts]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return blasts
      .filter((b) => filter === 'all' || b.status === filter)
      .filter((b) => !q || b.subject.toLowerCase().includes(q) || (b.sentByName ?? '').toLowerCase().includes(q));
  }, [blasts, filter, query]);

  function upsert(item: EmailBlast, _audit?: AuditEntry) {
    setBlasts((list) => {
      const i = list.findIndex((b) => b.id === item.id);
      if (i === -1) return [item, ...list];
      const next = list.slice();
      next[i] = item;
      return next;
    });
  }

  async function remove(b: EmailBlast) {
    try {
      const res = await apiFetch<{ audit?: AuditEntry }>(`/cms/email-blasts/${b.id}`, {
        method: 'DELETE', audience: 'cms',
      });
      appendAudit(res.audit);
      setBlasts((list) => list.filter((x) => x.id !== b.id));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'The blast could not be deleted.');
    }
  }

  /* Composing replaces the ledger entirely — the editor needs the room. */
  if (composer) {
    return (
      <BlastComposer
        editingId={composer.editingId}
        base={composer.base}
        clients={audience.clients}
        subscribers={audience.subscribers}
        onSaved={upsert}
        onClose={() => setComposer(null)}
      />
    );
  }

  const sentCount = counts.get('sent') ?? 0;

  return (
    <div className="space-y-9 pb-4">
      <ModuleHeader
        code="07 / Email desk"
        title="Email desk"
        blurb="Every blast that reaches clients — newsletter issues, research reports, and ad-hoc notes — drafted and previewed here, sent through Outlook. Auto-matched recipients always stop here for review first."
        actions={
          <BtnPrimary onClick={() => setComposer({ editingId: null, base: null })}>
            <IconPlus size={14} /> New blast
          </BtnPrimary>
        }
      />

      {status === 'ready' && blasts.length > 0 && (
        <div className="grid grid-cols-2 gap-6 border-b rule pb-8 md:grid-cols-4">
          <Stat value={String(blasts.length)} label="Blasts" />
          <Stat value={String(counts.get('draft') ?? 0)} label="Drafts" />
          <Stat value={String(counts.get('ready') ?? 0)} label="Ready" />
          <Stat value={String(sentCount)} label="Sent" />
        </div>
      )}

      {/* Filter rail */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`mono border px-3 py-1.5 text-[10.5px] uppercase tracking-[0.14em] transition-colors duration-300 active:translate-y-px ${
                filter === f ? 'border-navy bg-navy text-paper' : 'rule bg-transparent text-graphite hover:text-ink'
              }`}
            >
              {f}
              <span className="ml-2 opacity-50">
                {f === 'all' ? blasts.length : counts.get(f) ?? 0}
              </span>
            </button>
          ))}
        </div>
        <label className="relative block w-full md:w-[260px]">
          <span className="sr-only">Search blasts</span>
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Subject or sender…"
            className="w-full border rule bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
          />
        </label>
      </div>

      {loadError && (
        <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
          {loadError} <button type="button" className="underline" onClick={() => void load()}>Retry</button>
        </p>
      )}

      {/* Ledger */}
      {status === 'loading' ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={query ? 'Nothing matches that search.' : filter !== 'all' ? 'No blasts in this state.' : 'No blasts yet.'}
          hint={query
            ? 'Search covers the subject line and the sender.'
            : 'Draft one here, or start from a report (Copy blast link) or a filed newsletter issue (Email blast).'}
          action={query || filter !== 'all'
            ? <BtnGhost onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</BtnGhost>
            : <BtnPrimary onClick={() => setComposer({ editingId: null, base: null })}><IconPlus size={14} /> New blast</BtnPrimary>}
        />
      ) : (
        <ul className="divide-y rule border-y rule">
          <AnimatePresence initial={false}>
            {rows.map((b, i) => (
              <motion.li
                key={b.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: Math.min(i * 0.03, 0.2) } }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}
                className="group grid grid-cols-12 items-center gap-4 py-4"
              >
                <span className="mono col-span-6 text-[10.5px] uppercase tracking-[0.16em] text-graphite md:col-span-1">
                  {BLAST_KIND[b.kind]}
                </span>
                <div className="col-span-12 min-w-0 md:col-span-5 lg:col-span-4">
                  <button
                    type="button"
                    onClick={() => setViewing(b)}
                    className="block max-w-full truncate text-left text-[14.5px] text-ink transition-colors hover:text-[color:var(--color-amber-deep)]"
                  >
                    {b.subject}
                  </button>
                  <p className="mono mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-silver">
                    {b.recipients.length} recipient{b.recipients.length === 1 ? '' : 's'}
                    {b.status === 'sent' && b.sentAt ? ` · sent ${fmtDate(b.sentAt.slice(0, 10))}` : ` · ${timeAgo(b.updatedAt)}`}
                  </p>
                </div>
                <span className="col-span-4 hidden truncate text-[13px] text-slate lg:col-span-3 lg:block">
                  {b.status === 'sent'
                    ? `${b.sentByName ?? '—'}${b.senderOutlook ? ` · ${b.senderOutlook}` : ''}`
                    : b.notes ?? ''}
                </span>
                <span className="col-span-6 md:col-span-2 md:justify-self-end lg:col-span-1">
                  <Chip tone={BLAST_STATUS[b.status].tone}>{BLAST_STATUS[b.status].label}</Chip>
                </span>
                <div className="col-span-12 flex items-center gap-1.5 md:col-span-4 md:justify-end md:justify-self-end lg:col-span-3">
                  <RowAction label="View blast" onClick={() => setViewing(b)}><IconEye /></RowAction>
                  {b.status !== 'sent' && (
                    <RowAction label="Edit blast" onClick={() => setComposer({ editingId: b.id, base: b })}><IconPen /></RowAction>
                  )}
                  <RowAction label="Duplicate into a new blast" onClick={() => setComposer({ editingId: null, base: { ...b, status: 'draft' } })}>
                    <IconCopy />
                  </RowAction>
                  <RowAction label={armed === b.id ? 'Confirm delete' : 'Delete blast'} danger onClick={() => confirm(b.id, () => { void remove(b); })}>
                    {armed === b.id ? <IconCheck /> : <IconTrash />}
                  </RowAction>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* Read-only viewer */}
      {viewing && (
        <Modal
          open
          title={`${viewing.subject}${viewing.sentAt ? ` · sent ${fmtDate(viewing.sentAt.slice(0, 10))}` : ''}`}
          onClose={() => setViewing(null)}
          wide
          footer={
            viewing.status !== 'sent' ? (
              <BtnPrimary onClick={() => { setComposer({ editingId: viewing.id, base: viewing }); setViewing(null); }}>
                <IconPen size={13} /> Edit blast
              </BtnPrimary>
            ) : (
              <BtnGhost onClick={() => { setComposer({ editingId: null, base: { ...viewing, status: 'draft' } }); setViewing(null); }}>
                <IconCopy size={13} /> Duplicate
              </BtnGhost>
            )
          }
        >
          <div className="space-y-4">
            <div className="mono flex flex-wrap gap-x-6 gap-y-1 text-[10.5px] uppercase tracking-[0.14em] text-graphite">
              <span>{BLAST_KIND[viewing.kind]}</span>
              <span>{viewing.recipients.length} recipient{viewing.recipients.length === 1 ? '' : 's'}</span>
              {viewing.senderOutlook && <span>From {viewing.senderOutlook}</span>}
              {viewing.sentByName && <span>By {viewing.sentByName}</span>}
              {viewing.externalLink && <span className="normal-case">External: {viewing.externalLink}</span>}
            </div>
            {viewing.htmlBody ? (
              <iframe
                title="Blast content"
                srcDoc={/^\s*<!doctype/i.test(viewing.htmlBody)
                  ? viewing.htmlBody
                  : `<!doctype html><html><body style="margin:0;padding:18px 22px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#2b2b2b">${viewing.htmlBody}</body></html>`}
                sandbox=""
                className="h-[60vh] w-full border rule bg-white"
              />
            ) : (
              <p className="border border-dashed rule px-5 py-8 text-[13px] text-graphite">This blast has no body yet.</p>
            )}
            {viewing.notes && (
              <p className="text-[12.5px] leading-relaxed text-graphite"><span className="mono uppercase tracking-[0.14em] text-[10px]">Notes · </span>{viewing.notes}</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
