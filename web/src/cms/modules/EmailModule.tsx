import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../store';
import { apiFetch } from '../../lib/api';
import {
  BtnGhost, BtnPrimary, Chip, EmptyState, ModuleHeader, RowAction, SkeletonRows, Stat, useConfirm, EASE,
} from '../ui';
import { Modal } from '../kit/parts';
import { Segmented } from './access/parts';
import { IconCheck, IconCopy, IconEye, IconMail, IconPen, IconPlus, IconSearch, IconTrash, IconUndo } from '../icons';
import {
  BLAST_KIND, BLAST_STATUS, blastInFlight, blastLocked, fmtDate, timeAgo,
  type AudienceClient, type AudienceSubscriber, type AuditEntry, type BlastMonth, type BlastStatus, type BlastVariant,
  type DispatchInfo, type DistributionList, type EmailBlast, type EmailDelivery,
} from '../data';
import BlastComposer from './email/BlastComposer';
import ListsPanel from './email/ListsPanel';
import { previewInputFor, useRenderedPreview } from './email/usePreview';

/* ─────────────────────────────────────────────────────────────
   The Email desk. Every blast — newsletter issues, research
   reports, ad-hoc notes — is drafted, previewed, and edited here.
   It leaves one of two ways: "Send now" queues a server-side send
   through Microsoft Graph from the staff member's own mailbox,
   batched and logged per batch; the Outlook hand-off copies the
   email out by hand and marks the record sent. Saved distribution
   lists live on the second tab.
   ───────────────────────────────────────────────────────────── */

type Filter = 'all' | 'draft' | 'ready' | 'inflight' | 'sent' | 'failed';
const FILTERS: Array<{ key: Filter; label: string; match: (s: BlastStatus) => boolean }> = [
  { key: 'all', label: 'all', match: () => true },
  { key: 'draft', label: 'draft', match: (s) => s === 'draft' },
  { key: 'ready', label: 'ready', match: (s) => s === 'ready' },
  { key: 'inflight', label: 'in flight', match: (s) => s === 'queued' || s === 'sending' },
  { key: 'sent', label: 'sent', match: (s) => s === 'sent' },
  { key: 'failed', label: 'failed', match: (s) => s === 'failed' },
];

type Tab = 'blasts' | 'lists';
type Audience = { clients: AudienceClient[]; subscribers: AudienceSubscriber[]; lists: DistributionList[]; dispatch: DispatchInfo };
type Ledger = { items: EmailBlast[]; months: BlastMonth[] };
type ItemResponse = { item: EmailBlast; audit?: AuditEntry };

const NO_DISPATCH: DispatchInfo = { graphReady: false, sender: null, senderAllowed: false, senderDomain: '', batchSize: 500, attachmentMaxBytes: 0 };
const POLL_MS = 4000;

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export default function EmailModule() {
  const { appendAudit } = useCms();

  const [tab, setTab] = useState<Tab>('blasts');
  const [blasts, setBlasts] = useState<EmailBlast[]>([]);
  const [months, setMonths] = useState<BlastMonth[]>([]);
  const [audience, setAudience] = useState<Audience>({ clients: [], subscribers: [], lists: [], dispatch: NO_DISPATCH });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [composer, setComposer] = useState<{ editingId: string | null; base: EmailBlast | null } | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [armed, confirm] = useConfirm(4000);
  const alive = useRef(true);

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const [ledger, pool] = await Promise.all([
        apiFetch<Ledger>('/cms/email-blasts', { audience: 'cms' }),
        apiFetch<Audience>('/cms/email-blasts/audience', { audience: 'cms' }),
      ]);
      if (!alive.current) return;
      setBlasts(ledger.items);
      setMonths(ledger.months);
      setAudience(pool);
      setStatus('ready');
    } catch (e) {
      if (!alive.current) return;
      setLoadError(e instanceof Error ? e.message : 'The Email desk could not load.');
      setStatus('error');
    }
  }, []);

  /** A quiet refresh of the ledger alone — used while a send is in flight. */
  const refresh = useCallback(async () => {
    try {
      const ledger = await apiFetch<Ledger>('/cms/email-blasts', { audience: 'cms' });
      if (!alive.current) return;
      setBlasts(ledger.items);
      setMonths(ledger.months);
    } catch {
      /* the next tick tries again */
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [load]);

  const inFlight = useMemo(() => blasts.some(blastInFlight), [blasts]);
  useEffect(() => {
    if (!inFlight || composer) return;
    const t = window.setInterval(() => { void refresh(); }, POLL_MS);
    return () => window.clearInterval(t);
  }, [inFlight, composer, refresh]);

  const counts = useMemo(() => {
    const m = new Map<Filter, number>();
    for (const f of FILTERS) m.set(f.key, blasts.filter((b) => f.match(b.status)).length);
    return m;
  }, [blasts]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = FILTERS.find((f) => f.key === filter)?.match ?? (() => true);
    return blasts
      .filter((b) => match(b.status))
      .filter((b) => !q || b.subject.toLowerCase().includes(q) || (b.sentByName ?? '').toLowerCase().includes(q));
  }, [blasts, filter, query]);

  const viewing = useMemo(() => blasts.find((b) => b.id === viewingId) ?? null, [blasts, viewingId]);

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
      if (viewingId === b.id) setViewingId(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'The blast could not be deleted.');
    }
  }

  /** Queue a Graph send (or retry a failed one) straight from the ledger. */
  async function sendNow(b: EmailBlast) {
    setLoadError(null);
    try {
      const res = await apiFetch<ItemResponse>(`/cms/email-blasts/${b.id}/send`, { method: 'POST', audience: 'cms' });
      appendAudit(res.audit);
      upsert(res.item);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'The blast could not be queued.');
    }
  }

  const { dispatch } = audience;
  const canSend = dispatch.graphReady && Boolean(dispatch.sender) && dispatch.senderAllowed;
  const recipientTotal = (b: EmailBlast) => b.recipients.length + (b.recipientsForeign?.length ?? 0);

  /* Composing replaces the ledger entirely — the editor needs the room. */
  if (composer) {
    return (
      <BlastComposer
        editingId={composer.editingId}
        base={composer.base}
        clients={audience.clients}
        subscribers={audience.subscribers}
        lists={audience.lists}
        dispatch={dispatch}
        onSaved={upsert}
        onClose={() => setComposer(null)}
      />
    );
  }

  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];

  return (
    <div className="space-y-9 pb-4">
      <ModuleHeader
        code="07 / Email desk"
        title="Email desk"
        blurb={dispatch.graphReady
          ? 'Every blast that reaches clients — newsletter issues, research reports, and ad-hoc notes — drafted and previewed here, then sent from your own mailbox through Microsoft 365. Auto-matched recipients always stop here for review first.'
          : 'Every blast that reaches clients — newsletter issues, research reports, and ad-hoc notes — drafted and previewed here, sent through Outlook. Auto-matched recipients always stop here for review first.'}
        actions={
          <BtnPrimary onClick={() => setComposer({ editingId: null, base: null })}>
            <IconPlus size={14} /> New blast
          </BtnPrimary>
        }
      />

      <Segmented
        options={[
          { value: 'blasts' as Tab, label: 'Blasts', count: blasts.length },
          { value: 'lists' as Tab, label: 'Distribution lists', count: audience.lists.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'lists' ? (
        status === 'loading' ? <SkeletonRows rows={4} /> : (
          <ListsPanel
            lists={audience.lists}
            clients={audience.clients}
            subscribers={audience.subscribers}
            onChange={(lists) => setAudience((a) => ({ ...a, lists }))}
          />
        )
      ) : (
        <>
          {status === 'ready' && blasts.length > 0 && (
            <div className="grid grid-cols-2 gap-6 border-b rule pb-8 md:grid-cols-4">
              <Stat value={String(blasts.length)} label="Blasts" />
              <Stat value={String(counts.get('inflight') ?? 0)} label="In flight" />
              <Stat value={String(counts.get('sent') ?? 0)} label="Sent" delta={counts.get('failed') ? `${counts.get('failed')} failed` : undefined} />
              <Stat
                value={String(thisMonth?.recipients ?? 0)}
                label={`Reached · ${thisMonth ? monthLabel(thisMonth.month) : 'this month'}`}
                delta={lastMonth ? `${lastMonth.recipients} in ${monthLabel(lastMonth.month)}` : undefined}
              />
            </div>
          )}

          {/* Filter rail */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`mono border px-3 py-1.5 text-[10.5px] uppercase tracking-[0.14em] transition-colors duration-300 active:translate-y-px ${
                    filter === f.key ? 'border-navy bg-navy text-paper' : 'rule bg-transparent text-graphite hover:text-ink'
                  }`}
                >
                  {f.label}
                  <span className="ml-2 opacity-50">{counts.get(f.key) ?? 0}</span>
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
                {rows.map((b, i) => {
                  const st = BLAST_STATUS[b.status];
                  const locked = blastLocked(b);
                  const flying = blastInFlight(b);
                  const n = recipientTotal(b);
                  const meta = flying && b.batches
                    ? `${b.batches.sent}/${b.batches.total} batch${b.batches.total === 1 ? '' : 'es'} out`
                    : b.status === 'failed'
                      ? `${b.failedCount} of ${n} failed`
                      : b.status === 'sent' && b.sentAt
                        ? `sent ${fmtDate(b.sentAt.slice(0, 10))} · ${b.channel === 'graph' ? 'Microsoft 365' : 'Outlook'}`
                        : timeAgo(b.updatedAt);
                  return (
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
                          onClick={() => setViewingId(b.id)}
                          className="block max-w-full truncate text-left text-[14.5px] text-ink transition-colors hover:text-[color:var(--color-amber-deep)]"
                        >
                          {b.subject}
                        </button>
                        <p className="mono mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-silver">
                          {n} recipient{n === 1 ? '' : 's'}
                          {b.recipientsForeign ? ` (${b.recipients.length} local · ${b.recipientsForeign.length} foreign)` : ''}
                          {' · '}{meta}
                        </p>
                      </div>
                      <span
                        className="col-span-4 hidden truncate text-[13px] text-slate lg:col-span-3 lg:block"
                        style={b.status === 'failed' ? { color: 'var(--color-warn)' } : undefined}
                        title={b.status === 'failed' ? b.sendError ?? undefined : undefined}
                      >
                        {b.status === 'failed'
                          ? b.sendError ?? 'Some batches did not go out.'
                          : locked
                            ? `${b.sentByName ?? '—'}${b.senderOutlook ? ` · ${b.senderOutlook}` : ''}`
                            : b.notes ?? ''}
                      </span>
                      <span className="col-span-6 md:col-span-2 md:justify-self-end lg:col-span-1">
                        <Chip tone={st.tone} pulse={st.pulse}>{st.label}</Chip>
                      </span>
                      <div className="col-span-12 flex items-center gap-1.5 md:col-span-4 md:justify-end md:justify-self-end lg:col-span-3">
                        <RowAction label="View blast" onClick={() => setViewingId(b.id)}><IconEye /></RowAction>
                        {!locked && (
                          <RowAction label="Edit blast" onClick={() => setComposer({ editingId: b.id, base: b })}><IconPen /></RowAction>
                        )}
                        {canSend && !locked && (
                          <RowAction
                            label={armed === `send:${b.id}` ? `Confirm · send to ${n}` : 'Send now'}
                            onClick={() => confirm(`send:${b.id}`, () => { void sendNow(b); })}
                            disabled={n === 0}
                          >
                            {armed === `send:${b.id}` ? <IconCheck /> : <IconMail />}
                          </RowAction>
                        )}
                        {canSend && b.status === 'failed' && (
                          <RowAction
                            label={armed === `send:${b.id}` ? 'Confirm · retry failed batches' : 'Retry failed batches'}
                            onClick={() => confirm(`send:${b.id}`, () => { void sendNow(b); })}
                          >
                            {armed === `send:${b.id}` ? <IconCheck /> : <IconUndo />}
                          </RowAction>
                        )}
                        <RowAction label="Duplicate into a new blast" onClick={() => setComposer({ editingId: null, base: { ...b, status: 'draft' } })}>
                          <IconCopy />
                        </RowAction>
                        <RowAction
                          label={armed === b.id ? 'Confirm delete' : 'Delete blast'}
                          danger
                          disabled={flying}
                          onClick={() => confirm(b.id, () => { void remove(b); })}
                        >
                          {armed === b.id ? <IconCheck /> : <IconTrash />}
                        </RowAction>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </>
      )}

      {viewing && (
        <BlastViewer
          blast={viewing}
          canSend={canSend}
          onClose={() => setViewingId(null)}
          onEdit={() => { setComposer({ editingId: viewing.id, base: viewing }); setViewingId(null); }}
          onDuplicate={() => { setComposer({ editingId: null, base: { ...viewing, status: 'draft' } }); setViewingId(null); }}
          onSend={() => void sendNow(viewing)}
        />
      )}
    </div>
  );
}

/* ── Read-only viewer: the rendered mail plus the delivery log ── */

function BlastViewer({ blast, canSend, onClose, onEdit, onDuplicate, onSend }: {
  blast: EmailBlast;
  canSend: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onSend: () => void;
}) {
  const [variant, setVariant] = useState<BlastVariant>('local');
  const [deliveries, setDeliveries] = useState<EmailDelivery[] | null>(null);
  const [armed, confirm] = useConfirm(4000);
  const preview = useRenderedPreview(previewInputFor(blast, blast.recipientsForeign ? variant : 'local'));
  const locked = blastLocked(blast);
  const n = blast.recipients.length + (blast.recipientsForeign?.length ?? 0);

  useEffect(() => {
    if (blast.channel !== 'graph' || !blast.batches) { setDeliveries(null); return; }
    let on = true;
    apiFetch<{ items: EmailDelivery[] }>(`/cms/email-blasts/${blast.id}/deliveries`, { audience: 'cms' })
      .then((res) => { if (on) setDeliveries(res.items); })
      .catch(() => { if (on) setDeliveries([]); });
    return () => { on = false; };
  }, [blast.id, blast.channel, blast.status, blast.batches]);

  const sendLabel = blast.status === 'failed'
    ? (armed === 'send' ? 'Confirm · retry failed batches' : 'Retry failed batches')
    : (armed === 'send' ? `Confirm · send to ${n}` : 'Send now');

  return (
    <Modal
      open
      title={`${blast.subject}${blast.sentAt ? ` · ${blast.status === 'failed' ? 'attempted' : 'sent'} ${fmtDate(blast.sentAt.slice(0, 10))}` : ''}`}
      onClose={onClose}
      wide
      footer={
        <>
          {!locked && (
            <BtnPrimary onClick={onEdit}><IconPen size={13} /> Edit blast</BtnPrimary>
          )}
          {canSend && (!locked || blast.status === 'failed') && (
            <BtnGhost onClick={() => confirm('send', onSend)} disabled={n === 0}>
              <IconMail size={13} /> {sendLabel}
            </BtnGhost>
          )}
          {locked && (
            <BtnGhost onClick={onDuplicate}><IconCopy size={13} /> Duplicate</BtnGhost>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="mono flex flex-wrap gap-x-6 gap-y-1 text-[10.5px] uppercase tracking-[0.14em] text-graphite">
          <span>{BLAST_KIND[blast.kind]}</span>
          <span>{n} recipient{n === 1 ? '' : 's'}{blast.recipientsForeign ? ` · ${blast.recipients.length} local / ${blast.recipientsForeign.length} foreign` : ''}</span>
          {blast.channel && <span>{blast.channel === 'graph' ? 'Microsoft 365' : 'Outlook'}</span>}
          {blast.senderOutlook && <span className="normal-case">From {blast.senderOutlook}</span>}
          {blast.sentByName && <span>By {blast.sentByName}</span>}
          {blast.attachReport && <span>PDF attached</span>}
          {blast.externalLink && <span className="normal-case">External: {blast.externalLink}</span>}
        </div>

        {blast.status === 'failed' && blast.sendError && (
          <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
            {blast.sendError}
          </p>
        )}

        {/* Delivery log */}
        {deliveries && deliveries.length > 0 && (
          <div className="border rule bg-white">
            <div className="flex items-center justify-between border-b rule px-4 py-2.5">
              <span className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite">Deliveries</span>
              <span className="mono num text-[10px] text-silver">
                {blast.sentCount} sent{blast.failedCount ? ` · ${blast.failedCount} failed` : ''}
              </span>
            </div>
            <ul className="max-h-[220px] divide-y rule overflow-y-auto">
              {deliveries.map((d) => (
                <li key={d.id} className="grid grid-cols-12 items-center gap-3 px-4 py-2 text-[12px]">
                  <span className="mono col-span-2 text-[10px] uppercase tracking-[0.12em] text-graphite">{d.variant} · {d.batch}</span>
                  <span className="mono col-span-2 text-[10px] uppercase tracking-[0.12em] text-silver">{d.envelope}</span>
                  <span className="col-span-5 truncate text-slate" title={d.recipients.join(', ')}>
                    {d.envelope === 'direct' ? d.recipients[0] : `${d.recipientCount} recipient${d.recipientCount === 1 ? '' : 's'} BCC`}
                    {d.error ? <span style={{ color: 'var(--color-warn)' }}> · {d.error}</span> : null}
                  </span>
                  <span className="col-span-3 justify-self-end">
                    <Chip tone={d.status === 'sent' ? 'live' : d.status === 'failed' ? 'warn' : 'amber'} pulse={d.status === 'pending' && blastInFlight(blast)}>
                      {d.status}
                    </Chip>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {blast.recipientsForeign && (
          <Segmented
            options={[
              { value: 'local' as BlastVariant, label: 'Local', count: blast.recipients.length },
              { value: 'foreign' as BlastVariant, label: 'Foreign', count: blast.recipientsForeign.length },
            ]}
            value={variant}
            onChange={setVariant}
          />
        )}
        {preview.html ? (
          <iframe title="Blast content" srcDoc={preview.html} sandbox="" className="h-[56vh] w-full border rule bg-white" />
        ) : (
          <p className="border border-dashed rule px-5 py-8 text-[13px] text-graphite">
            {preview.busy ? 'Rendering…' : preview.error ?? 'This blast has no body yet.'}
          </p>
        )}
        {blast.notes && (
          <p className="text-[12.5px] leading-relaxed text-graphite"><span className="mono uppercase tracking-[0.14em] text-[10px]">Notes · </span>{blast.notes}</p>
        )}
      </div>
    </Modal>
  );
}
