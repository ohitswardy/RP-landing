import { useState } from 'react';
import { useAuth } from '../../cms/auth';
import { getToken } from '../../lib/api';
import { BtnGhost, BtnPrimary, Chip, DateField, ModuleHeader, RowAction, SelectField, useConfirm } from '../../cms/ui';
import { Modal } from '../../cms/kit/parts';
import { IconCheck, IconDownload, IconPen, IconPlus, IconTrash } from '../../cms/icons';
import { useCrms } from '../store';
import { FormError, Picker, SectionRule } from '../kit/fields';
import { useOptions } from '../kit/options';
import { errorText, useToast } from '../kit/toast';
import { TEMPLATE_CODES, type ReportTemplate, type ReportTemplateCode } from '../data';

/* ─────────────────────────────────────────────────────────────
   Reports (§7.3). Generic, Internal (analysts + sales sheets),
   or By Client through the template bound to that client. The
   date range is honoured server-side; the workbook downloads.
   Template bindings replace the legacy hard-coded client ids.
   ───────────────────────────────────────────────────────────── */

type ReportType = 'generic' | 'internal' | 'client';

const TYPES: { id: ReportType; label: string; blurb: string }[] = [
  { id: 'generic', label: 'Generic', blurb: 'Every interaction in range, one sheet, every column.' },
  { id: 'internal', label: 'Internal', blurb: 'Analysts and Sales sheets split by the Regis attendees\' desk, plus the full set.' },
  { id: 'client', label: 'By client', blurb: 'One client, in the layout their compliance team expects.' },
];

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function ReportsModule() {
  const { clients, reportTemplates, mutate, destroy } = useCrms();
  const { can } = useAuth();
  const options = useOptions();
  const { notify } = useToast();
  const [type, setType] = useState<ReportType>('generic');
  const [clientId, setClientId] = useState<string | null>(null);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tpl, setTpl] = useState<{ id: string | null; clientId: string | null; code: ReportTemplateCode; active: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [armed, confirm] = useConfirm();
  const admin = can('crms.admin');

  const boundTemplate = clientId ? reportTemplates.find((t) => t.clientId === clientId && t.active) : null;

  async function generate() {
    if (type === 'client' && !clientId) { setError('Pick the client the report is for.'); return; }
    if (from > to) { setError('The range ends before it starts.'); return; }
    setBusy(true); setError(null);
    try {
      const token = getToken('cms');
      const res = await fetch('/api/crms/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ type, clientId: type === 'client' ? Number(clientId) : null, from, to }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message ?? `Request failed (${res.status}).`);
      }
      const blob = await res.blob();
      const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'report.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = decodeURIComponent(name); a.click();
      URL.revokeObjectURL(url);
      notify('Report generated.');
    } catch (e) {
      setError(errorText(e, 'The report could not be generated.'));
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    if (!tpl || !tpl.clientId) return;
    setSaving(true);
    try {
      await mutate('reportTemplates', tpl.id ? `/crms/report-templates/${tpl.id}` : '/crms/report-templates', tpl.id ? 'PUT' : 'POST', { clientId: Number(tpl.clientId), code: tpl.code, active: tpl.active });
      notify('Template binding saved.');
      setTpl(null);
    } catch (e) { notify(errorText(e, 'The binding could not be saved.'), 'warn'); } finally { setSaving(false); }
  }

  async function removeTemplate(t: ReportTemplate) {
    try { await destroy('reportTemplates', `/crms/report-templates/${t.id}`, t.id); notify('Binding removed.'); }
    catch (e) { notify(errorText(e, 'Could not remove the binding.'), 'warn'); }
  }

  return (
    <div className="space-y-12">
      <ModuleHeader code="09 · Reports" title="Consumption reports" blurb="Excel workbooks of logged interactions for a date range — the evidence clients' compliance teams ask for. Every row in range is included regardless of who logged it, and the range is applied exactly." />

      <div className="grid gap-10 lg:grid-cols-12">
        <section className="space-y-6 lg:col-span-7">
          <div role="radiogroup" aria-label="Report type" className="grid gap-px border rule bg-[color:color-mix(in_oklab,var(--color-ink)_12%,transparent)] sm:grid-cols-3">
            {TYPES.map((t) => {
              const on = type === t.id;
              return (
                <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => setType(t.id)} className={`flex flex-col gap-2 p-5 text-left transition-colors ${on ? 'bg-navy text-paper' : 'bg-paper text-slate hover:bg-bone'}`}>
                  <span className={`mono text-[10px] uppercase tracking-[0.18em] ${on ? 'text-[color:var(--color-amber)]' : 'text-graphite'}`}>{t.id}</span>
                  <span className="text-[15px] font-medium tracking-[-0.01em]">{t.label}</span>
                  <span className={`text-[12.5px] leading-relaxed ${on ? 'text-paper/70' : 'text-graphite'}`}>{t.blurb}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <DateField label="From" value={from} onChange={setFrom} />
            <DateField label="To" value={to} onChange={setTo} />
          </div>

          {type === 'client' && (
            <div className="space-y-2">
              <Picker label="Client" options={options.clients} value={clientId} onChange={setClientId} />
              <p className="mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                Template · {boundTemplate ? TEMPLATE_CODES[boundTemplate.code] : clientId ? 'Generic layout (no binding)' : '—'}
              </p>
            </div>
          )}

          <FormError message={error} />
          <BtnPrimary onClick={() => void generate()} disabled={busy}><IconDownload size={14} /> {busy ? 'Generating…' : 'Generate workbook'}</BtnPrimary>
        </section>

        <aside className="space-y-4 lg:col-span-5">
          <SectionRule code="Bindings" title="Client report templates" actions={admin && <BtnGhost onClick={() => setTpl({ id: null, clientId: null, code: 'corpaxe', active: true })}><IconPlus size={12} /> Bind</BtnGhost>} />
          <p className="text-[12.5px] leading-relaxed text-graphite">Which layout a By-Client report uses. A client with no binding gets the generic layout.</p>
          {reportTemplates.length === 0 ? <p className="text-[13px] text-graphite">No bindings yet.</p> : (
            <ul className="divide-y rule border-y rule">
              {reportTemplates.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] text-ink">{t.clientName ?? clients.find((c) => c.id === t.clientId)?.name ?? `Client #${t.clientId}`}</p>
                    <p className="mono mt-0.5 text-[10px] uppercase tracking-[0.14em] text-graphite">{TEMPLATE_CODES[t.code]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone={t.active ? 'live' : 'muted'}>{t.active ? 'Active' : 'Off'}</Chip>
                    {admin && (
                      <>
                        <RowAction label="Edit binding" onClick={() => setTpl({ id: t.id, clientId: t.clientId, code: t.code, active: t.active })}><IconPen /></RowAction>
                        <RowAction label={armed === t.id ? 'Confirm' : 'Remove binding'} danger onClick={() => confirm(t.id, () => { void removeTemplate(t); })}>{armed === t.id ? <IconCheck /> : <IconTrash />}</RowAction>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {tpl && (
        <Modal open title={tpl.id ? 'Edit template binding' : 'Bind a client to a template'} onClose={() => setTpl(null)}
          footer={<><BtnGhost onClick={() => setTpl(null)}>Cancel</BtnGhost><BtnPrimary onClick={() => void saveTemplate()} disabled={saving || !tpl.clientId}>{saving ? 'Saving…' : 'Save binding'}</BtnPrimary></>}>
          <div className="space-y-5">
            <Picker label="Client" options={options.clients} value={tpl.clientId} onChange={(v) => setTpl({ ...tpl, clientId: v })} />
            <SelectField label="Template" value={TEMPLATE_CODES[tpl.code]} onChange={(v) => setTpl({ ...tpl, code: (Object.keys(TEMPLATE_CODES) as ReportTemplateCode[]).find((k) => TEMPLATE_CODES[k] === v) ?? 'corpaxe' })} options={Object.values(TEMPLATE_CODES)} />
            <SelectField label="Status" value={tpl.active ? 'Active' : 'Off'} onChange={(v) => setTpl({ ...tpl, active: v === 'Active' })} options={['Active', 'Off']} />
          </div>
        </Modal>
      )}
    </div>
  );
}
