import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../../store';
import { useAuth } from '../../auth';
import { apiFetch } from '../../../lib/api';
import { BtnGhost, BtnPrimary, EmptyState, RowAction, TextField, useConfirm, EASE } from '../../ui';
import { Modal } from '../../kit/parts';
import { IconCheck, IconPen, IconPlus, IconTrash } from '../../icons';
import {
  RESEARCH_SCOPE, timeAgo,
  type AudienceClient, type AudienceSubscriber, type AuditEntry, type DistributionList, type EmailRecipient, type ResearchGroup,
} from '../../data';
import RecipientPicker from './RecipientPicker';

/* ─────────────────────────────────────────────────────────────
   The second tab of the desk, in two parts.

   Research distribution — the CRMS hierarchy (Research-Domestics /
   Research-Foreign, each sector with its tickers) and, per sector,
   how many tagged contacts a blast can actually reach through a
   linked portal account. Edited in the CRMS; shown here so the desk
   sees the same thing the report matcher walks.

   My lists — the staff member's own saved audiences, built from the
   same pool the composer draws on. Every Administrator and Analyst
   keeps their own; nobody else sees them.
   ───────────────────────────────────────────────────────────── */

type Draft = { id: string | null; name: string; description: string; contacts: EmailRecipient[] };
type ItemResponse = { item: DistributionList; audit?: AuditEntry };

export default function ListsPanel({ lists, research, clients, subscribers, onChange }: {
  lists: DistributionList[];
  research: ResearchGroup[];
  clients: AudienceClient[];
  subscribers: AudienceSubscriber[];
  onChange: (next: DistributionList[]) => void;
}) {
  const { appendAudit } = useCms();
  const { session, can } = useAuth();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, confirm] = useConfirm();

  const open = (l?: DistributionList) => {
    setError(null);
    setDraft(l
      ? { id: l.id, name: l.name, description: l.description ?? '', contacts: l.contacts }
      : { id: null, name: '', description: '', contacts: [] });
  };

  async function save() {
    if (!draft) return;
    if (draft.name.trim().length < 2) { setError('Give the list a name.'); return; }
    setSaving(true);
    setError(null);
    const body = { name: draft.name.trim(), description: draft.description.trim() || null, contacts: draft.contacts };
    try {
      const res = draft.id
        ? await apiFetch<ItemResponse>(`/cms/distribution-lists/${draft.id}`, { method: 'PUT', audience: 'cms', body })
        : await apiFetch<ItemResponse>('/cms/distribution-lists', { method: 'POST', audience: 'cms', body });
      appendAudit(res.audit);
      const next = draft.id ? lists.map((l) => (l.id === res.item.id ? res.item : l)) : [...lists, res.item];
      onChange(next.slice().sort((a, b) => a.name.localeCompare(b.name)));
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The list could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(l: DistributionList) {
    try {
      const res = await apiFetch<{ audit?: AuditEntry }>(`/cms/distribution-lists/${l.id}`, { method: 'DELETE', audience: 'cms' });
      appendAudit(res.audit);
      onChange(lists.filter((x) => x.id !== l.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The list could not be deleted.');
    }
  }

  const reachable = research.reduce((n, g) => n + g.recipients.length, 0);
  const unlinked = research.reduce((n, g) => n + g.unlinkedCount, 0);

  return (
    <div className="space-y-12">
      {/* ── Research distribution (CRMS, read-only) ─────────────── */}
      <section className="space-y-6">
        <div className="flex flex-col gap-3 border-b rule pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="mono block text-[9.5px] uppercase tracking-[0.2em] text-silver">CRMS · read-only</span>
            <h3 className="mt-1 text-[17px] tracking-[-0.01em] text-ink">Research distribution</h3>
            <p className="mt-1 max-w-[64ch] text-[12.5px] leading-relaxed text-graphite">
              The sector hierarchy every client contact is tagged into, per audience, down to the tickers each sector covers.
              A sector counts only the contacts it can reach — those linked to an approved portal account — which is the same
              path the report matcher takes.
            </p>
          </div>
          {can('crms.access') && (
            <Link to="/crms/distribution-list" className="mono shrink-0 text-[10.5px] uppercase tracking-[0.14em] text-graphite underline-offset-4 transition-colors hover:text-ink hover:underline">
              Edit in CRMS →
            </Link>
          )}
        </div>

        {research.length === 0 ? (
          <EmptyState
            title="The research hierarchy is not available."
            hint="Either the CRMS database is empty or the desk cannot reach it. Seed it with `php artisan crms:distribution-list`, or build the sectors in the CRMS."
          />
        ) : (
          <>
            <div className="grid gap-10 lg:grid-cols-2">
              {(['domestic', 'foreign'] as const).map((scope) => {
                const groups = research.filter((g) => g.scope === scope).sort((a, b) => a.position - b.position);
                return (
                  <div key={scope} className="space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">{RESEARCH_SCOPE[scope].code}</span>
                      <span className="mono num text-[10px] text-silver">{groups.reduce((n, g) => n + g.recipients.length, 0)} reachable</span>
                    </div>
                    {groups.length === 0 ? (
                      <p className="text-[12.5px] text-silver">No sectors defined for this audience.</p>
                    ) : (
                      <ul className="divide-y rule border-y rule">
                        {groups.map((g) => (
                          <li key={g.id} className="grid grid-cols-12 gap-3 py-3">
                            <span className="mono num col-span-1 pt-0.5 text-[10.5px] text-silver">{String(g.position).padStart(2, '0')}</span>
                            <div className="col-span-8 min-w-0">
                              <p className="text-[13.5px] text-ink">{g.name}</p>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {g.tickers.length === 0
                                  ? <span className="text-[11.5px] text-silver">Sector-wide · no single ticker</span>
                                  : g.tickers.map((t) => (
                                    <span key={t} className="mono border rule bg-paper px-1.5 py-0.5 text-[10px] tracking-[0.04em] text-slate">{t}</span>
                                  ))}
                              </div>
                            </div>
                            <div className="col-span-3 text-right">
                              <span className="mono num block text-[14px] tracking-[-0.01em] text-ink">{g.recipients.length}</span>
                              <span className="mono block text-[9px] uppercase tracking-[0.12em] text-silver">
                                of {g.contactCount} tagged
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[12px] leading-relaxed text-graphite">
              <span className="num text-ink">{reachable}</span> contact{reachable === 1 ? '' : 's'} reachable across both audiences.
              {unlinked > 0 && (
                <> <span className="num text-ink">{unlinked}</span> tagged contact{unlinked === 1 ? ' has' : 's have'} no approved portal account and will not be added — link them from their CRMS contact record.</>
              )}
              {' '}Each sector is also a one-click pool in the composer.
            </p>
          </>
        )}
      </section>

      {/* ── My lists (personal) ────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex flex-col gap-3 border-b rule pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="mono block text-[9.5px] uppercase tracking-[0.2em] text-silver">{session?.name ? `${session.name} · private` : 'Private'}</span>
            <h3 className="mt-1 text-[17px] tracking-[-0.01em] text-ink">My lists</h3>
            <p className="mt-1 max-w-[64ch] text-[12.5px] leading-relaxed text-graphite">
              Your own saved audiences, built from approved clients, verified subscribers, research sectors and typed addresses.
              Every Administrator and Analyst keeps their own; nobody else sees yours.
            </p>
          </div>
          <BtnPrimary onClick={() => open()}><IconPlus size={14} /> New list</BtnPrimary>
        </div>

        {error && !draft && (
          <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>{error}</p>
        )}

        {lists.length === 0 ? (
          <EmptyState
            title="You have no lists yet."
            hint="Save a segment once — your banks coverage, the funds you speak to, a monthly circulation — and pick it in every blast after."
            action={<BtnGhost onClick={() => open()}><IconPlus size={14} /> New list</BtnGhost>}
          />
        ) : (
          <ul className="divide-y rule border-y rule">
            <AnimatePresence initial={false}>
              {lists.map((l, i) => (
                <motion.li
                  key={l.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: Math.min(i * 0.03, 0.2) } }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}
                  className="group grid grid-cols-12 items-center gap-4 py-4"
                >
                  <span className="mono num col-span-3 text-[15px] tracking-[-0.01em] text-ink md:col-span-1">
                    {l.count}
                  </span>
                  <div className="col-span-9 min-w-0 md:col-span-6">
                    <button type="button" onClick={() => open(l)} className="block max-w-full truncate text-left text-[14.5px] text-ink transition-colors hover:text-[color:var(--color-amber-deep)]">
                      {l.name}
                    </button>
                    <p className="mono mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-silver">
                      {l.description || `${l.count} contact${l.count === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  <span className="col-span-8 hidden truncate text-[12.5px] text-slate md:col-span-3 md:block">
                    {l.ownerId === null ? 'Unowned · ' : ''}{timeAgo(l.updatedAt)}
                  </span>
                  <div className="col-span-12 flex items-center gap-1.5 md:col-span-2 md:justify-end md:justify-self-end">
                    <RowAction label="Edit list" onClick={() => open(l)}><IconPen /></RowAction>
                    <RowAction label={armed === l.id ? 'Confirm delete' : 'Delete list'} danger onClick={() => confirm(l.id, () => { void remove(l); })}>
                      {armed === l.id ? <IconCheck /> : <IconTrash />}
                    </RowAction>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {draft && (
        <Modal
          open
          title={draft.id ? `Edit list · ${draft.name || 'Untitled'}` : 'New distribution list'}
          onClose={() => setDraft(null)}
          wide
          footer={
            <>
              <BtnGhost onClick={() => setDraft(null)}>Cancel</BtnGhost>
              <BtnPrimary onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create list'}
              </BtnPrimary>
            </>
          }
        >
          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2">
              <TextField label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Local banks desk" />
              <TextField label="Description" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} placeholder="Who this reaches, and when to use it" />
            </div>
            <RecipientPicker
              clients={clients}
              subscribers={subscribers}
              lists={lists.filter((l) => l.id !== draft.id)}
              research={research}
              value={draft.contacts}
              onChange={(contacts) => setDraft({ ...draft, contacts })}
              label="Contacts"
            />
            {error && <p className="text-[12.5px]" style={{ color: 'var(--color-warn)' }}>{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
