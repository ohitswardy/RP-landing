import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCms } from '../../store';
import { apiFetch } from '../../../lib/api';
import { BtnGhost, BtnPrimary, EmptyState, RowAction, TextField, useConfirm, EASE } from '../../ui';
import { Modal } from '../../kit/parts';
import { IconCheck, IconPen, IconPlus, IconTrash } from '../../icons';
import { timeAgo, type AudienceClient, type AudienceSubscriber, type AuditEntry, type DistributionList, type EmailRecipient } from '../../data';
import RecipientPicker from './RecipientPicker';

/* ─────────────────────────────────────────────────────────────
   Saved audiences. A list is a named set of contacts built from
   the same pool the composer draws on — Local banks desk, Foreign
   funds, the monthly circulation — so the desk picks a segment
   instead of rebuilding it for every blast.
   ───────────────────────────────────────────────────────────── */

type Draft = { id: string | null; name: string; description: string; contacts: EmailRecipient[] };
type ItemResponse = { item: DistributionList; audit?: AuditEntry };

export default function ListsPanel({ lists, clients, subscribers, onChange }: {
  lists: DistributionList[];
  clients: AudienceClient[];
  subscribers: AudienceSubscriber[];
  onChange: (next: DistributionList[]) => void;
}) {
  const { appendAudit } = useCms();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-[60ch] text-[12.5px] leading-relaxed text-graphite">
          Reusable audiences for the composer and the newsletter blast panel. Built from approved clients, verified subscribers, and typed addresses.
        </p>
        <BtnPrimary onClick={() => open()}><IconPlus size={14} /> New list</BtnPrimary>
      </div>

      {error && !draft && (
        <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>{error}</p>
      )}

      {lists.length === 0 ? (
        <EmptyState
          title="No distribution lists yet."
          hint="Save a segment once — Local banks desk, Foreign funds, the monthly circulation — and pick it in every blast after."
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
                  {l.createdByName ? `${l.createdByName} · ` : ''}{timeAgo(l.updatedAt)}
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
