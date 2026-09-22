import { useState } from 'react';
import { useAuth } from '../../cms/auth';
import { BtnGhost, BtnPrimary, ModuleHeader, RowAction, SelectField, TextField, useConfirm } from '../../cms/ui';
import { Modal } from '../../cms/kit/parts';
import { IconCheck, IconPen, IconPlus, IconTrash } from '../../cms/icons';
import { useCrms, useLookups } from '../store';
import { FormError, MultiPicker, NumberField, SectionRule } from '../kit/fields';
import { useOptions } from '../kit/options';
import { errorText, useToast } from '../kit/toast';
import type { SectorGroup, SectorScope } from '../data';

/* ─────────────────────────────────────────────────────────────
   Research distribution list (§7.8): the editable Domestic /
   Foreign hierarchy of sectors and the tickers under each. A
   client contact subscribes to groups on their own record; the
   CMS Email desk does the sending — its report matcher reads
   these tags for every contact linked to a portal account.
   ───────────────────────────────────────────────────────────── */

type Draft = { id: string | null; name: string; scope: SectorScope; position: number | null; corporateIds: string[] };

export default function DistributionListModule() {
  const { sectorGroups, clientContacts, mutate, destroy } = useCrms();
  const { corporateById } = useLookups();
  const { can } = useAuth();
  const options = useOptions();
  const { notify } = useToast();
  const manage = can('crms.contacts.manage');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, confirm] = useConfirm();

  const open = (g?: SectorGroup, scope: SectorScope = 'domestic') => {
    setError(null);
    setDraft(g ? { id: g.id, name: g.name, scope: g.scope, position: g.position, corporateIds: g.corporateIds } : { id: null, name: '', scope, position: null, corporateIds: [] });
  };

  async function save() {
    if (!draft) return;
    if (draft.name.trim().length < 2) { setError('Name the sector.'); return; }
    setSaving(true); setError(null);
    try {
      await mutate('sectorGroups', draft.id ? `/crms/sector-groups/${draft.id}` : '/crms/sector-groups', draft.id ? 'PUT' : 'POST', {
        name: draft.name, scope: draft.scope, position: draft.position, corporateIds: draft.corporateIds.map(Number),
      });
      notify('Sector group saved.');
      setDraft(null);
    } catch (e) { setError(errorText(e, 'The group could not be saved.')); } finally { setSaving(false); }
  }

  async function remove(g: SectorGroup) {
    try { await destroy('sectorGroups', `/crms/sector-groups/${g.id}`, g.id); notify(`${g.name} removed.`); }
    catch (e) { notify(errorText(e, 'Could not remove the group.'), 'warn'); }
  }

  const unwired = clientContacts.filter((c) => c.sectorGroupIds.length > 0 && !c.portalUserId).length;

  return (
    <div className="space-y-10">
      <ModuleHeader code="08 · Distribution list" title="Research distribution list" blurb="The sector hierarchy each client contact is tagged into, held separately for domestic and foreign audiences, down to the tickers in each sector. Sending stays with the CMS Email desk, whose report matcher reads these tags for contacts linked to a portal account."
        actions={manage && <BtnPrimary onClick={() => open()}><IconPlus size={14} /> New sector</BtnPrimary>} />

      {unwired > 0 && (
        <p className="border-l-2 pl-4 text-[13px] leading-relaxed text-slate" style={{ borderColor: 'var(--color-amber)' }}>
          <span className="text-ink">{unwired} contact{unwired === 1 ? '' : 's'}</span> carry sector selections but have no linked portal account, so the Email desk matcher cannot reach them. Link them from their contact record.
        </p>
      )}

      <div className="grid gap-12 lg:grid-cols-2">
        {(['domestic', 'foreign'] as SectorScope[]).map((scope) => {
          const groups = sectorGroups.filter((g) => g.scope === scope).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
          return (
            <section key={scope} className="space-y-4">
              <SectionRule code={scope === 'domestic' ? 'Research-Domestics · local clients' : 'Research-Foreign · foreign clients'} title={scope === 'domestic' ? 'Domestic' : 'Foreign'} actions={manage && <BtnGhost onClick={() => open(undefined, scope)}><IconPlus size={12} /> Add</BtnGhost>} />
              {groups.length === 0 ? <p className="text-[13px] text-graphite">No sectors defined for this audience.</p> : (
                <ul className="divide-y rule border-b rule">
                  {groups.map((g) => (
                    <li key={g.id} className="group grid grid-cols-12 gap-3 py-4">
                      <span className="mono num col-span-1 pt-0.5 text-[10.5px] text-silver">{String(g.position).padStart(2, '0')}</span>
                      <div className="col-span-9 min-w-0">
                        <p className="text-[14px] text-ink">{g.name} <span className="mono ml-2 text-[10px] uppercase tracking-[0.14em] text-silver">{g.subscriberCount} subscriber{g.subscriberCount === 1 ? '' : 's'}</span></p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {g.corporateIds.length === 0 && <span className="text-[12px] text-silver">Sector-wide — no tickers, so the Email desk matcher cannot reach this group on its own</span>}
                          {g.corporateIds.map((id) => {
                            const c = corporateById.get(id);
                            return <span key={id} className="mono border rule bg-paper px-1.5 py-0.5 text-[11px] tracking-[0.04em] text-slate" title={c?.name}>{c?.ticker ?? c?.name ?? `#${id}`}</span>;
                          })}
                        </div>
                      </div>
                      {manage && (
                        <div className="col-span-2 flex justify-end gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
                          <RowAction label="Edit" onClick={() => open(g)}><IconPen /></RowAction>
                          <RowAction label={armed === g.id ? 'Confirm delete' : 'Delete'} danger onClick={() => confirm(g.id, () => { void remove(g); })}>{armed === g.id ? <IconCheck /> : <IconTrash />}</RowAction>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {draft && (
        <Modal open wide title={draft.id ? `Edit · ${draft.name}` : 'New sector group'} onClose={() => setDraft(null)}
          footer={<><BtnGhost onClick={() => setDraft(null)}>Cancel</BtnGhost><BtnPrimary onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save sector'}</BtnPrimary></>}>
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-[1fr_160px_120px]">
              <TextField label="Sector" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Banks" />
              <SelectField label="Audience" value={draft.scope === 'domestic' ? 'Domestic' : 'Foreign'} onChange={(v) => setDraft({ ...draft, scope: v === 'Domestic' ? 'domestic' : 'foreign' })} options={['Domestic', 'Foreign']} />
              <NumberField label="Order" value={draft.position} onChange={(v) => setDraft({ ...draft, position: v })} placeholder="auto" />
            </div>
            <MultiPicker label="Tickers in this sector" options={options.corporates} value={draft.corporateIds} onChange={(ids) => setDraft({ ...draft, corporateIds: ids })} placeholder="Add a corporate" />
            <FormError message={error} />
          </div>
        </Modal>
      )}
    </div>
  );
}
