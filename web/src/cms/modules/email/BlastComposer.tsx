import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useCms } from '../../store';
import { apiFetch } from '../../../lib/api';
import { writeClipboard, writeClipboardHtml, outlookCompose } from '../../../lib/clipboard';
import { downloadEmlDraft } from '../../../lib/eml';
import { BtnGhost, BtnPrimary, Chip, TextField, Switch, EASE } from '../../ui';
import { TinyBtn } from '../../kit/parts';
import { Segmented } from '../access/parts';
import RichTextField from '../../kit/RichTextField';
import { IconCheck, IconCopy, IconMail } from '../../icons';
import {
  BLAST_KIND, fmtDate,
  type AudienceClient, type AudienceSubscriber, type AuditEntry, type BlastKind, type BlastVariant,
  type DispatchInfo, type DistributionList, type EmailBlast, type EmailRecipient,
} from '../../data';
import { renderIssueHtml } from '../newsletter/emailHtml';
import RecipientPicker from './RecipientPicker';
import { useRenderedPreview } from './usePreview';

/* ─────────────────────────────────────────────────────────────
   One blast, composed and previewed before anything goes out.
   Report blasts carry one subject and body for two legs: Local
   clients get the login-gated portal deep link, Foreign clients
   get the Jefferies link. Newsletter blasts carry the rendered
   issue; ad-hoc blasts carry whatever the desk writes.

   Two ways out. "Send now" hands the blast to the API, which
   sends it from this staff member's own mailbox through Microsoft
   Graph in batches. The Outlook hand-off downloads the whole thing
   as a ready-to-send draft, and stays as the fallback while Graph
   consent is pending.
   ───────────────────────────────────────────────────────────── */

type ItemResponse = { item: EmailBlast; audit?: AuditEntry };
type CopyState = 'idle' | 'ok' | 'fail';

function htmlToPlain(html: string): string {
  const host = document.createElement('div');
  host.innerHTML = html;
  return (host.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtMb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(bytes >= 10 * 1048576 ? 0 : 1)} MB`;
}

export default function BlastComposer({ editingId, base, clients, subscribers, lists, dispatch, onSaved, onClose }: {
  editingId: string | null;
  base: EmailBlast | null;
  clients: AudienceClient[];
  subscribers: AudienceSubscriber[];
  lists: DistributionList[];
  dispatch: DispatchInfo;
  onSaved: (item: EmailBlast, audit?: AuditEntry) => void;
  onClose: () => void;
}) {
  const { reports, newsletters, appendAudit } = useCms();

  const [kind, setKind] = useState<BlastKind>(base?.kind ?? 'report');
  const [subject, setSubject] = useState(base?.subject ?? '');
  const [htmlBody, setHtmlBody] = useState(base?.htmlBody ?? '');
  const [reportId, setReportId] = useState(base?.reportId ?? '');
  const [issueId, setIssueId] = useState(base?.newsletterIssueId ?? '');
  const [externalLink, setExternalLink] = useState(base?.externalLink ?? '');
  const [attachReport, setAttachReport] = useState(base?.attachReport ?? false);
  const [recipients, setRecipients] = useState<EmailRecipient[]>(base?.recipients ?? []);
  const [foreignRecipients, setForeignRecipients] = useState<EmailRecipient[] | null>(base?.recipientsForeign ?? null);
  const [notes, setNotes] = useState(base?.notes ?? '');
  const [ready, setReady] = useState(base?.status === 'ready');
  const [showPreview, setShowPreview] = useState(true);
  const [previewVariant, setPreviewVariant] = useState<BlastVariant>('local');
  const [matching, setMatching] = useState(false);
  const [matchNote, setMatchNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendArmed, setSendArmed] = useState(false);
  const [showOutlook, setShowOutlook] = useState(!dispatch.graphReady);
  const [copied, setCopied] = useState<CopyState>('idle');
  const [bccCopied, setBccCopied] = useState<CopyState>('idle');
  const [foreignBccCopied, setForeignBccCopied] = useState<CopyState>('idle');
  const [drafted, setDrafted] = useState<CopyState>('idle');
  /** The record this composer writes to — set after the first save of a new blast
      so a retried send never creates a second copy. */
  const [savedId, setSavedId] = useState<string | null>(editingId);
  const timers = useRef<number[]>([]);

  const report = useMemo(() => reports.find((r) => r.id === reportId) ?? null, [reports, reportId]);
  const issue = useMemo(() => newsletters.find((n) => n.id === issueId) ?? null, [newsletters, issueId]);

  const split = kind === 'report' && foreignRecipients !== null;
  const foreignCount = foreignRecipients?.length ?? 0;
  const total = recipients.length + foreignCount;

  const preview = useRenderedPreview({
    kind,
    subject: subject || 'REGIS',
    htmlBody,
    reportId: kind === 'report' ? reportId || null : null,
    externalLink: kind === 'report' ? externalLink.trim() || null : null,
    variant: split ? previewVariant : 'local',
  });

  const canSend = dispatch.graphReady && Boolean(dispatch.sender) && dispatch.senderAllowed;
  const attachable = report ? !report.fileUrl && report.fileSize > 0 && report.fileSize <= dispatch.attachmentMaxBytes : false;

  const flash = (set: (s: CopyState) => void, ok: boolean) => {
    set(ok ? 'ok' : 'fail');
    timers.current.push(window.setTimeout(() => set('idle'), 2200));
  };

  /* ── Kind-specific helpers ─────────────────────────────────── */

  function pickReport(id: string) {
    setReportId(id);
    const r = reports.find((x) => x.id === id);
    if (!r) return;
    if (!subject.trim()) setSubject(`REGIS Research: ${r.title}`);
    if (!htmlBody.trim()) {
      // The mailer adds the title line, the "view report" button for each
      // leg, and the analyst's signature; the body is just the desk's note.
      setHtmlBody(
        '<p>Dear client,</p>'
        + '<p>Please find our latest research below.</p>'
        + (r.summary ? `<p>${escapeHtml(r.summary)}</p>` : '')
        + '<p>Best regards,<br/>REGIS Partners Research</p>',
      );
    }
  }

  function pickIssue(id: string) {
    setIssueId(id);
    const n = newsletters.find((x) => x.id === id);
    if (!n) return;
    setSubject(n.subject);
    setHtmlBody(renderIssueHtml(n));
  }

  async function prefillMatches() {
    if (!report) return;
    setMatching(true);
    setMatchNote(null);
    try {
      const res = await apiFetch<{ clients: AudienceClient[] }>(
        `/cms/email-blasts/match?report=${report.id}`,
        { audience: 'cms' },
      );
      const have = new Set([...recipients, ...(foreignRecipients ?? [])].map((r) => r.email.toLowerCase()));
      const added = res.clients.filter((c) => !have.has(c.email.toLowerCase()));
      setRecipients([
        ...recipients,
        ...added.map((c) => ({ email: c.email.toLowerCase(), name: c.name, userId: c.id, source: 'client' as const })),
      ]);
      setMatchNote(added.length > 0
        ? `${added.length} matched client${added.length === 1 ? '' : 's'} added — prune before sending.`
        : res.clients.length > 0
          ? 'Every matched client is already on the list.'
          : 'No local client preferences match this report’s sector or analyst.');
    } catch (e) {
      setMatchNote(e instanceof Error ? e.message : 'Matching failed. Try again.');
    } finally {
      setMatching(false);
    }
  }

  /** Move every Foreign-typed client to the foreign leg and everyone else to the local leg. */
  function sortByClientType() {
    const typeOf = (r: EmailRecipient) => clients.find((c) =>
      (r.userId && c.id === r.userId) || c.email.toLowerCase() === r.email.toLowerCase())?.clientType ?? null;
    const seen = new Set<string>();
    const local: EmailRecipient[] = [];
    const foreign: EmailRecipient[] = [];
    for (const r of [...recipients, ...(foreignRecipients ?? [])]) {
      const e = r.email.toLowerCase();
      if (seen.has(e)) continue;
      seen.add(e);
      (typeOf(r) === 'Foreign' ? foreign : local).push(r);
    }
    setRecipients(local);
    setForeignRecipients(foreign);
  }

  /* ── Persistence ───────────────────────────────────────────── */

  function payload() {
    return {
      kind,
      subject: subject.trim(),
      htmlBody: htmlBody || null,
      reportId: kind === 'report' && reportId ? Number(reportId) : null,
      newsletterIssueId: kind === 'newsletter' && issueId ? Number(issueId) : null,
      externalLink: kind === 'report' && externalLink.trim() ? externalLink.trim() : null,
      attachReport: kind === 'report' && attachReport && attachable,
      recipients,
      recipientsForeign: split ? foreignRecipients : null,
      status: ready ? 'ready' : 'draft',
      notes: notes.trim() || null,
    };
  }

  function validate(): string | null {
    if (!subject.trim()) return 'The blast needs a subject line.';
    if (kind === 'report' && !reportId) return 'Pick the report this blast carries.';
    if (kind === 'newsletter' && !issueId) return 'Pick the newsletter issue this blast carries.';
    return null;
  }

  /** What still stands between this blast and the send button. */
  function sendProblem(): string | null {
    if (!htmlBody.trim()) return 'The blast has no body yet.';
    if (total === 0) return 'Add at least one recipient.';
    if (split && foreignCount > 0 && !externalLink.trim()) return 'Foreign recipients need the external (Jefferies) link.';
    return null;
  }

  async function save(): Promise<EmailBlast | null> {
    const problem = validate();
    if (problem) { setError(problem); return null; }
    setSaving(true);
    setError(null);
    try {
      const res = savedId
        ? await apiFetch<ItemResponse>(`/cms/email-blasts/${savedId}`, { method: 'PUT', audience: 'cms', body: payload() })
        : await apiFetch<ItemResponse>('/cms/email-blasts', { method: 'POST', audience: 'cms', body: payload() });
      setSavedId(res.item.id);
      appendAudit(res.audit);
      onSaved(res.item, res.audit);
      return res.item;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving failed. Try again.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndClose() {
    const item = await save();
    if (item) onClose();
  }

  /** Save (so the record matches what goes out), then queue the Graph send. Two clicks: arm, confirm. */
  async function sendNow() {
    const problem = validate() ?? sendProblem();
    if (problem) { setError(problem); setSendArmed(false); return; }
    if (!sendArmed) {
      setSendArmed(true);
      timers.current.push(window.setTimeout(() => setSendArmed(false), 5000));
      return;
    }
    setSendArmed(false);
    setSending(true);
    try {
      const item = await save();
      if (!item) return;
      const res = await apiFetch<ItemResponse>(`/cms/email-blasts/${item.id}/send`, { method: 'POST', audience: 'cms' });
      appendAudit(res.audit);
      onSaved(res.item, res.audit);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The blast could not be queued.');
    } finally {
      setSending(false);
    }
  }

  /** Save (so the record matches what went out), then mark it sent by hand. */
  async function markSent() {
    setSending(true);
    try {
      const item = await save();
      if (!item) return;
      const res = await apiFetch<ItemResponse>(`/cms/email-blasts/${item.id}/sent`, {
        method: 'POST', audience: 'cms',
      });
      appendAudit(res.audit);
      onSaved(res.item, res.audit);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The blast could not be marked sent.');
    } finally {
      setSending(false);
    }
  }

  /* ── Outlook hand-off ──────────────────────────────────────── */

  async function copyRich() {
    if (!preview.html) { flash(setCopied, false); return; }
    flash(setCopied, await writeClipboardHtml(preview.html, htmlToPlain(preview.html)));
  }

  async function copyBcc(list: EmailRecipient[], set: (s: CopyState) => void) {
    flash(set, await writeClipboard(list.map((r) => r.email).join(';')));
  }

  /** The leg the hand-off acts on — the one on screen when the blast is split. */
  const handOffLeg = () => (split && previewVariant === 'foreign' ? foreignRecipients ?? [] : recipients);

  /**
   * Download the blast as a ready-to-send Outlook draft: subject, BCC list,
   * and the rendered body, all in place. mailto: is only the fallback — it
   * carries no body and goes nowhere at all when Windows has no handler
   * registered for it, which is why it could look like nothing happened.
   */
  function openOutlook() {
    const bcc = handOffLeg().map((r) => r.email);
    if (preview.html && downloadEmlDraft({
      subject: subject.trim() || 'REGIS',
      html: preview.html,
      bcc,
      from: dispatch.sender,
    })) {
      flash(setDrafted, true);
      return;
    }
    const fit = outlookCompose({ bcc, subject: subject.trim() || 'REGIS' });
    if (!fit) outlookCompose({ subject: subject.trim() || 'REGIS' });
    flash(setDrafted, false);
  }

  const kindLocked = Boolean(editingId);
  const busy = saving || sending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } }}
      className="space-y-8"
    >
      {/* Composer bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b rule pb-6">
        <div>
          <div className="eyebrow mb-2">{editingId ? 'Editing blast' : 'New blast'}</div>
          <h2 className="text-[clamp(1.2rem,2vw,1.6rem)]">{subject.trim() || 'Untitled blast'}</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          aria-pressed={showPreview}
          className={`mono border px-3 py-1.5 text-[10.5px] uppercase tracking-[0.14em] transition-colors duration-300 ${
            showPreview ? 'border-navy bg-navy text-paper' : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
          }`}
        >
          Live preview
        </button>
      </div>

      <div className={`grid gap-10 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
        {/* ── Editor rail ── */}
        <div className="min-w-0 space-y-7">
          <div className="space-y-2.5">
            <span className="mono block text-[10.5px] uppercase tracking-[0.18em] text-graphite">Blast type</span>
            {kindLocked ? (
              <Chip tone="muted">{BLAST_KIND[kind]}</Chip>
            ) : (
              <Segmented
                options={[
                  { value: 'report' as BlastKind, label: 'Research report' },
                  { value: 'newsletter' as BlastKind, label: 'Newsletter' },
                  { value: 'adhoc' as BlastKind, label: 'Ad hoc' },
                ]}
                value={kind}
                onChange={(v) => { setKind(v); setError(null); }}
              />
            )}
          </div>

          {kind === 'report' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Report</label>
                <select
                  value={reportId}
                  onChange={(e) => pickReport(e.target.value)}
                  className="w-full appearance-none border rule bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors duration-300 focus:border-[color:var(--color-amber-deep)]"
                >
                  <option value="">— Pick a report —</option>
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>{fmtDate(r.date)} · {r.title}</option>
                  ))}
                </select>
              </div>
              {report && (
                <div className="space-y-3 border-l-2 pl-4" style={{ borderColor: 'var(--color-amber)' }}>
                  <p className="text-[12.5px] leading-relaxed text-graphite">
                    {report.analyst}{report.category ? ` · ${report.category}` : ''}{report.companySymbol ? ` · ${report.companySymbol}` : ''}
                  </p>
                  <p className="text-[11.5px] leading-relaxed text-graphite">
                    The mailer adds the title line, the analyst signature, and a <span className="text-ink">view report</span> button —
                    the portal deep link for Local clients, the Jefferies link for Foreign.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <TinyBtn tone="accent" onClick={() => void prefillMatches()} disabled={matching}>
                      {matching ? 'Matching…' : 'Prefill matched clients'}
                    </TinyBtn>
                  </div>
                  {matchNote && <p className="text-[11.5px] leading-relaxed text-graphite">{matchNote}</p>}
                </div>
              )}
              <TextField
                label="External link (foreign clients)"
                value={externalLink}
                onChange={setExternalLink}
                placeholder="https://javatar.jefferies.com/…"
                helper={split
                  ? 'Required for the Foreign leg — its "view report" button points here instead of the portal.'
                  : 'Optional. Foreign-client research goes out with the Jefferies-generated link — paste it here and it stays on the record.'}
              />
              {report && (
                <div className="flex items-start justify-between gap-4 border rule bg-white px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Attach the PDF</div>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate">
                      {attachable
                        ? `${report.fileName} · ${fmtMb(report.fileSize)} rides along with every message. Off, the button alone carries the report.`
                        : report.fileUrl
                          ? 'Catalog PDFs are served from the public site and cannot be attached — the button carries the report.'
                          : report.fileSize > dispatch.attachmentMaxBytes
                            ? `${fmtMb(report.fileSize)} is over the ${fmtMb(dispatch.attachmentMaxBytes)} attachment cap — the button carries the report.`
                            : 'No stored PDF to attach.'}
                    </p>
                  </div>
                  <div className="pt-0.5">
                    <Switch on={attachReport && attachable} onToggle={() => attachable && setAttachReport((v) => !v)} label="Attach the report PDF" />
                  </div>
                </div>
              )}
            </div>
          )}

          {kind === 'newsletter' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">Issue</label>
                <select
                  value={issueId}
                  onChange={(e) => pickIssue(e.target.value)}
                  className="w-full appearance-none border rule bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors duration-300 focus:border-[color:var(--color-amber-deep)]"
                >
                  <option value="">— Pick an issue —</option>
                  {newsletters.map((n) => (
                    <option key={n.id} value={n.id}>{n.cadence} · {fmtDate(n.date)} · {n.subject}</option>
                  ))}
                </select>
              </div>
              {issue && (
                <div className="flex flex-wrap items-center gap-3">
                  <TinyBtn onClick={() => setHtmlBody(renderIssueHtml(issue))}>
                    <IconCheck size={11} /> Regenerate from the issue
                  </TinyBtn>
                  <span className="text-[11.5px] text-graphite">
                    The body is the rendered issue — edit the issue in the Newsletter desk, then regenerate.
                  </span>
                </div>
              )}
              <p className="border-l-2 pl-4 text-[12px] leading-relaxed text-graphite" style={{ borderColor: 'var(--color-amber)' }}>
                Subscribers each receive their own copy with a personal unsubscribe link; clients and typed addresses go BCC.
              </p>
            </div>
          )}

          {kind === 'adhoc' && (
            <p className="border-l-2 pl-4 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-amber)', color: 'var(--color-amber-deep)' }}>
              Files are not stored here — for a PDF, start from a research report instead, or attach it in Outlook.
            </p>
          )}

          <TextField
            label="Subject line"
            value={subject}
            onChange={setSubject}
            placeholder="REGIS Research: …"
          />

          {kind !== 'newsletter' && (
            <RichTextField
              label="Email body"
              value={htmlBody}
              onChange={setHtmlBody}
              rows={10}
              hint={kind === 'report'
                ? 'Prefilled from the report — edit freely. The mailer wraps it with the title line, button, and signature.'
                : 'Written from scratch. The mailer wraps it in the house layout.'}
            />
          )}

          {kind === 'report' && (
            <div className="flex items-start justify-between gap-4 border rule bg-white px-4 py-3.5">
              <div className="min-w-0">
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Local / Foreign legs</div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate">
                  One subject and body, two audiences: Local clients get the portal deep link, Foreign clients get the Jefferies link.
                </p>
              </div>
              <div className="pt-0.5">
                <Switch on={split} onToggle={() => setForeignRecipients(split ? null : [])} label="Split into Local and Foreign legs" />
              </div>
            </div>
          )}

          <RecipientPicker
            clients={clients}
            subscribers={subscribers}
            lists={lists}
            value={recipients}
            onChange={setRecipients}
            label={split ? 'Local recipients' : 'Recipients'}
            hint={split ? 'Portal deep link. Clients hidden from each other via BCC.' : undefined}
          />

          {split && (
            <div className="space-y-3 border-t rule pt-5">
              <RecipientPicker
                clients={clients}
                subscribers={subscribers}
                lists={lists}
                value={foreignRecipients ?? []}
                onChange={setForeignRecipients}
                label="Foreign recipients"
                hint="Jefferies link from the field above. Sent after the Local leg."
              />
              <TinyBtn onClick={sortByClientType} disabled={total === 0}>
                <IconCheck size={11} /> Sort both lists by client type
              </TinyBtn>
            </div>
          )}

          <TextField
            label="Notes"
            value={notes}
            onChange={setNotes}
            multiline
            placeholder="Attachment reminders, follow-ups, who asked for this…"
            helper="Internal only — never part of the email."
          />

          <div className="flex items-start justify-between gap-4 border rule bg-white px-4 py-3.5">
            <div className="min-w-0">
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Ready to send</div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate">
                Flags the blast as reviewed so the desk knows it can go out.
              </p>
            </div>
            <div className="pt-0.5">
              <Switch on={ready} onToggle={() => setReady((v) => !v)} label="Ready to send" />
            </div>
          </div>

          <div className="border-t rule pt-5">
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Sending from</div>
            {!dispatch.graphReady ? (
              <p className="mt-1.5 text-[12px] leading-relaxed text-graphite">
                Server-side sending is not configured on this installation yet — blasts go out through the Outlook hand-off below.
                {dispatch.sender && <span className="mono block pt-1 text-slate">{dispatch.sender}</span>}
              </p>
            ) : !dispatch.sender ? (
              <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: 'var(--color-amber-deep)' }}>
                No Outlook account on your staff profile — an administrator can add it under{' '}
                <Link to="/cms/access" className="underline">Users &amp; access</Link>. Until then, use the Outlook hand-off.
              </p>
            ) : !dispatch.senderAllowed ? (
              <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: 'var(--color-amber-deep)' }}>
                <span className="mono">{dispatch.sender}</span> is outside the {dispatch.senderDomain} tenant, so it cannot send from the server.
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate">
                <span className="mono">{dispatch.sender}</span> via Microsoft 365. The mail lands in your Sent Items; clients ride BCC in batches of {dispatch.batchSize}.
              </p>
            )}
          </div>
        </div>

        {/* ── Live preview ── */}
        {showPreview && (
          <div className="min-w-0">
            <div className="sticky top-[calc(var(--cms-header-h)_+_1.5rem)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="mono text-[10px] uppercase tracking-[0.2em] text-graphite">
                  Email preview{preview.busy ? <span className="ml-2 text-silver">rendering…</span> : null}
                </span>
                {split ? (
                  <Segmented
                    options={[
                      { value: 'local' as BlastVariant, label: 'Local', count: recipients.length },
                      { value: 'foreign' as BlastVariant, label: 'Foreign', count: foreignCount },
                    ]}
                    value={previewVariant}
                    onChange={setPreviewVariant}
                  />
                ) : (
                  <span className="mono text-[10px] uppercase tracking-[0.2em] text-silver">{BLAST_KIND[kind]}</span>
                )}
              </div>
              {preview.html ? (
                <iframe
                  title="Blast preview"
                  srcDoc={preview.html}
                  sandbox=""
                  className="h-[70vh] w-full border rule bg-white shadow-sm"
                />
              ) : (
                <p className="border border-dashed rule px-5 py-10 text-[13px] text-graphite">
                  {preview.error ?? 'The preview fills in as soon as the blast has a body.'}
                </p>
              )}
              <p className="mt-3 text-[11.5px] leading-relaxed text-graphite">
                Rendered by the same template the send uses — exactly what a recipient sees.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="sticky bottom-4 z-30 border rule bg-paper/95 shadow-[0_10px_30px_-12px_oklch(0.165_0.040_260_/_0.4)] backdrop-blur-md">
        <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {error ? (
              <p className="text-[13px] leading-snug" style={{ color: 'var(--color-warn)' }}>{error}</p>
            ) : (
              <p className="truncate text-[13px] text-slate">
                <span className="mono num mr-2 text-[10px] uppercase tracking-[0.16em] text-graphite">
                  {split
                    ? `${recipients.length} local · ${foreignCount} foreign`
                    : `${total} ${total === 1 ? 'recipient' : 'recipients'}`}
                </span>
                {subject.trim() || 'Untitled blast'}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowOutlook((v) => !v)}
              aria-pressed={showOutlook}
              className="mono text-[10px] uppercase tracking-[0.16em] text-graphite underline-offset-4 hover:text-ink hover:underline"
            >
              Outlook hand-off {showOutlook ? '−' : '+'}
            </button>
            <BtnGhost onClick={onClose}>Discard</BtnGhost>
            {canSend ? (
              <>
                <BtnGhost onClick={() => void saveAndClose()} disabled={busy}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save blast'}
                </BtnGhost>
                <BtnPrimary onClick={() => void sendNow()} disabled={busy}>
                  <IconMail size={13} />
                  {sending ? 'Queueing…' : sendArmed ? `Confirm · send to ${total}` : 'Send now'}
                </BtnPrimary>
              </>
            ) : (
              <BtnPrimary onClick={() => void saveAndClose()} disabled={busy}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save blast'}
              </BtnPrimary>
            )}
          </div>
        </div>

        {showOutlook && (
          <div className="flex flex-col gap-3 border-t rule px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[46ch] text-[11.5px] leading-relaxed text-graphite">
              <span className="text-ink">Open in Outlook</span> saves a draft with the body, subject, and BCC already in
              place{split ? ` — the ${previewVariant} leg, as previewed` : ''}. Open it, review, send, then mark the blast sent.
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <TinyBtn onClick={openOutlook} disabled={!preview.html}>
                {drafted === 'ok' ? <IconCheck size={11} /> : <IconMail size={11} />}
                {drafted === 'ok' ? 'Draft saved' : drafted === 'fail' ? 'Opened envelope only' : 'Open in Outlook'}
              </TinyBtn>
              <TinyBtn onClick={() => void copyRich()} disabled={!preview.html}>
                {copied === 'ok' ? <IconCheck size={11} /> : <IconCopy size={11} />}
                {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Copy failed' : 'Copy email'}
              </TinyBtn>
              <TinyBtn onClick={() => void copyBcc(recipients, setBccCopied)} disabled={recipients.length === 0}>
                {bccCopied === 'ok' ? <IconCheck size={11} /> : <IconCopy size={11} />}
                {bccCopied === 'ok' ? 'BCC copied' : split ? 'Copy local BCC' : 'Copy BCC'}
              </TinyBtn>
              {split && (
                <TinyBtn onClick={() => void copyBcc(foreignRecipients ?? [], setForeignBccCopied)} disabled={foreignCount === 0}>
                  {foreignBccCopied === 'ok' ? <IconCheck size={11} /> : <IconCopy size={11} />}
                  {foreignBccCopied === 'ok' ? 'BCC copied' : 'Copy foreign BCC'}
                </TinyBtn>
              )}
              <TinyBtn tone="accent" onClick={() => void markSent()} disabled={busy}>
                {sending ? 'Recording…' : 'Mark as sent'}
              </TinyBtn>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
