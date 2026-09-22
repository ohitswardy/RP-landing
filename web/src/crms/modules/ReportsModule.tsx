import { useState } from 'react';
import { useAuth } from '../../cms/auth';
import { BtnGhost, BtnPrimary, Chip, DateField, ModuleHeader, RowAction, SelectField, useConfirm } from '../../cms/ui';
import { Modal } from '../../cms/kit/parts';
import { IconCheck, IconDownload, IconPen, IconPlus, IconTrash, IconUpload } from '../../cms/icons';
import { useCrms } from '../store';
import { FormError, Picker, SectionRule } from '../kit/fields';
import { useOptions } from '../kit/options';
import { errorText, useToast } from '../kit/toast';
import { downloadFile } from '../kit/download';
import { SCOPE_LABELS } from '../kit/layout';
import { BINDABLE_CODES, TEMPLATE_CODES, type ReportTemplate, type ReportTemplateCode } from '../data';
import ReportLayoutImport from './ReportLayoutImport';

/* ─────────────────────────────────────────────────────────────
   Reports (§7.3). Generic, Internal (analysts + sales sheets),
   or By Client through the template bound to that client. The
   date range is honoured server-side; the workbook downloads.
   Template bindings replace the legacy hard-coded client ids.
   ───────────────────────────────────────────────────────────── */

type ReportType = 'generic' | 'internal' | 'client' | 'jefferies';

const TYPES: { id: ReportType; label: string; blurb: string }[] = [
  { id: 'generic', label: 'Generic', blurb: 'The flat T1C / Salesforce extract — one sheet, headers on row 1, ready to upload as-is.' },
  { id: 'internal', label: 'Internal', blurb: 'The call report: Bespoke and Official events detail, Summary rankings, a firm × month pivot, and Sales / Analysts sheets by who logged each row.' },
  { id: 'client', label: 'By client', blurb: 'One client, in their own Excel template filled with the system\u2019s data: the Schroders and JPM Commcise workbooks ship with the CRMS; any other client\u2019s is imported in the Form builder.' },
  { id: 'jefferies', label: 'Jefferies upload', blurb: 'Jefferies\u2019 own bulk-upload workbook filled with every foreign-client interaction in range: their Instructions and Lookup tabs, dropdowns and Errors check exactly as sent.' },
];

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function ReportsModule() {
  const { clients, reportTemplates, meta, mutate, destroy } = useCrms();
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
  /** The client whose Excel template is being imported or re-mapped; '' = pick one in the modal. */
  const [importing, setImporting] = useState<string | null>(null);

  const boundTemplate = clientId ? reportTemplates.find((t) => t.clientId === clientId && t.active) : null;
  const templateLabel = (t: ReportTemplate) => t.layout
    ? `Imported · ${t.layout.file ?? 'workbook'} · ${t.layout.columns.filter((c) => c.source !== 'blank').length} columns${t.layout.scope !== 'client' ? ` · ${SCOPE_LABELS[t.layout.scope].toLowerCase()}` : ''}`
    : t.bundled
      ? `Bundled workbook · ${t.bundled.file}`
      : TEMPLATE_CODES[t.code];
  const boundWorkbook = boundTemplate?.layout ?? boundTemplate?.bundled ?? null;

  /** The binding the Jefferies upload renders through (the client named Jefferies), else the bundled workbook as Jefferies sent it. */
  const jefferiesTemplate = reportTemplates.find((t) => t.active && t.id === meta.jefferies.templateId)
    ?? reportTemplates.find((t) => t.active && t.code === 'jefferies')
    ?? reportTemplates.find((t) => t.active && t.clientId === meta.jefferies.clientId && t.layout?.scope === 'foreign')
    ?? null;
  const jefferiesWorkbook = jefferiesTemplate?.layout ?? jefferiesTemplate?.bundled ?? meta.jefferies.bundled;

  async function downloadJefferies() {
    const path = jefferiesTemplate?.layout ? `/crms/report-templates/${jefferiesTemplate.id}/layout/file` : '/crms/report-templates/bundled/jefferies/file';
    try { await downloadFile(path, {}, jefferiesWorkbook?.file ?? 'jefferies.xlsx'); } catch (e) { notify(errorText(e, 'The workbook could not be downloaded.'), 'warn'); }
  }

  async function generate() {
    if (type === 'client' && !clientId) { setError('Pick the client the report is for.'); return; }
    if (from > to) { setError('The range ends before it starts.'); return; }
    setBusy(true); setError(null);
    try {
      await downloadFile('/crms/reports/generate', { method: 'POST', body: { type, clientId: type === 'client' ? Number(clientId) : null, from, to } }, 'report.xlsx');
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
          <div role="radiogroup" aria-label="Report type" className="grid gap-px border rule bg-[color:color-mix(in_oklab,var(--color-ink)_12%,transparent)] sm:grid-cols-2 xl:grid-cols-4">
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
                Template · {boundTemplate ? templateLabel(boundTemplate) : clientId ? 'Generic layout (no binding)' : '—'}
              </p>
              {boundWorkbook && (
                <p className="text-[12px] leading-relaxed text-graphite">
                  The client’s own workbook is filled in place: rows from row {boundWorkbook.dataStart} of the <span className="text-ink">{boundWorkbook.sheet}</span> tab; {boundWorkbook.sheets.filter((s) => s !== boundWorkbook.sheet).join(', ')} and every style and rule come back exactly as in the file.
                </p>
              )}
            </div>
          )}

          {type === 'jefferies' && (
            <div className="space-y-2">
              <p className="mono text-[10px] uppercase tracking-[0.16em] text-graphite">
                Workbook · {jefferiesTemplate?.layout ? templateLabel(jefferiesTemplate) : jefferiesWorkbook ? `Jefferies’ own · ${jefferiesWorkbook.file}` : '—'}
              </p>
              {jefferiesWorkbook && (
                <p className="text-[12px] leading-relaxed text-graphite">
                  Every Foreign client’s interactions in range go from row {jefferiesWorkbook.dataStart} of the <span className="text-ink">{jefferiesWorkbook.sheet}</span> tab; {jefferiesWorkbook.sheets.filter((s) => s !== jefferiesWorkbook.sheet).join(', ')}, the dropdowns and the Errors check come back exactly as in the file.
                </p>
              )}
              {admin && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <BtnGhost onClick={() => void downloadJefferies()}><IconDownload size={12} /> Original</BtnGhost>
                  <BtnGhost onClick={() => { if (meta.jefferies.clientId) setImporting(meta.jefferies.clientId); }} disabled={!meta.jefferies.clientId}><IconUpload size={12} /> {jefferiesTemplate?.layout ? 'Replace or re-map' : 'Import a newer download'}</BtnGhost>
                  {!meta.jefferies.clientId && <span className="mono text-[10px] uppercase tracking-[0.14em] text-graphite">Add a client named “Jefferies” to import a newer workbook</span>}
                </div>
              )}
            </div>
          )}

          <FormError message={error} />
          <BtnPrimary onClick={() => void generate()} disabled={busy}><IconDownload size={14} /> {busy ? 'Generating…' : 'Generate workbook'}</BtnPrimary>
        </section>

        <aside className="space-y-4 lg:col-span-5">
          <SectionRule code="Bindings" title="Client report templates" actions={admin && (
            <>
              <BtnGhost onClick={() => setImporting('')}><IconUpload size={12} /> Import Excel</BtnGhost>
              <BtnGhost onClick={() => setTpl({ id: null, clientId: null, code: 'corpaxe', active: true })}><IconPlus size={12} /> Bind</BtnGhost>
            </>
          )} />
          <p className="text-[12.5px] leading-relaxed text-graphite">Which layout a By-Client report uses: a client’s own imported Excel template (managed with their form in the Form builder) or a built-in layout. A client with no binding gets the generic layout. The Jefferies upload is bound the same way, to the client named Jefferies, so a newer workbook from Jefferies can be imported over the bundled one.</p>
          {reportTemplates.length === 0 ? <p className="text-[13px] text-graphite">No bindings yet.</p> : (
            <ul className="divide-y rule border-y rule">
              {reportTemplates.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] text-ink">{t.clientName ?? clients.find((c) => c.id === t.clientId)?.name ?? `Client #${t.clientId}`}</p>
                    <p className="mono mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] text-graphite">{templateLabel(t)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone={t.active ? 'live' : 'muted'}>{t.active ? 'Active' : 'Off'}</Chip>
                    {admin && (
                      <>
                        {t.layout
                          ? <RowAction label="Re-map or replace the workbook" onClick={() => setImporting(t.clientId)}><IconPen /></RowAction>
                          : <RowAction label="Edit binding" onClick={() => setTpl({ id: t.id, clientId: t.clientId, code: t.code, active: t.active })}><IconPen /></RowAction>}
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
            <SelectField label="Template" value={TEMPLATE_CODES[tpl.code]} onChange={(v) => setTpl({ ...tpl, code: BINDABLE_CODES.find((k) => TEMPLATE_CODES[k] === v) ?? 'corpaxe' })} options={BINDABLE_CODES.map((k) => TEMPLATE_CODES[k])} helper="An imported Excel template is bound by importing it, not here." />
            <SelectField label="Status" value={tpl.active ? 'Active' : 'Off'} onChange={(v) => setTpl({ ...tpl, active: v === 'Active' })} options={['Active', 'Off']} />
          </div>
        </Modal>
      )}

      {/* Mounted only while open: toggling `open` would leave the faded overlay in the DOM. */}
      {importing !== null && <ReportLayoutImport clientId={importing === '' ? null : importing} onClose={() => setImporting(null)} />}
    </div>
  );
}
