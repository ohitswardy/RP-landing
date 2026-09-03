import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useCms } from '../../store';
import { useAuth } from '../../auth';
import { apiFetch } from '../../../lib/api';
import { writeClipboard, writeClipboardHtml, outlookCompose } from '../../../lib/clipboard';
import { BtnGhost, BtnPrimary, Chip, TextField, Switch, EASE } from '../../ui';
import { TinyBtn } from '../../kit/parts';
import { Segmented } from '../access/parts';
import RichTextField from '../../kit/RichTextField';
import { IconCheck, IconCopy, IconMail } from '../../icons';
import {
  BLAST_KIND, fmtDate,
  type AudienceClient, type AudienceSubscriber, type AuditEntry,
  type BlastKind, type EmailBlast, type EmailRecipient,
} from '../../data';
import { renderIssueHtml, publicOrigin } from '../newsletter/emailHtml';
import RecipientPicker from './RecipientPicker';

/* ─────────────────────────────────────────────────────────────
   One blast, composed and previewed before anything goes out.
   Report blasts carry the portal deep link (local clients) and
   optionally a Jefferies link (foreign); newsletter blasts carry
   the rendered issue; ad-hoc blasts carry whatever the desk
   writes, with the PDF attached by hand in Outlook.
   ───────────────────────────────────────────────────────────── */

type ItemResponse = { item: EmailBlast; audit?: AuditEntry };
type CopyState = 'idle' | 'ok' | 'fail';

/** A fragment from the rich editor, dressed as a minimal Arial document. */
function wrapFragment(subject: string, fragment: string): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">'
    + `<title>${subject.replace(/</g, '&lt;')}</title></head>`
    + '<body style="margin:0;padding:0;background:#ffffff">'
    + '<div style="max-width:680px;margin:0 auto;padding:18px 22px;'
    + 'font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#2b2b2b">'
    + fragment
    + '</div></body></html>'
  );
}

function htmlToPlain(html: string): string {
  const host = document.createElement('div');
  host.innerHTML = html;
  return (host.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** htmlBody is either a full rendered document (newsletter) or a fragment. */
function asDocument(subject: string, htmlBody: string): string {
  return /^\s*<!doctype/i.test(htmlBody) ? htmlBody : wrapFragment(subject, htmlBody);
}

export default function BlastComposer({ editingId, base, clients, subscribers, onSaved, onClose }: {
  editingId: string | null;
  base: EmailBlast | null;
  clients: AudienceClient[];
  subscribers: AudienceSubscriber[];
  onSaved: (item: EmailBlast, audit?: AuditEntry) => void;
  onClose: () => void;
}) {
  const { reports, newsletters, appendAudit } = useCms();
  const { session } = useAuth();

  const [kind, setKind] = useState<BlastKind>(base?.kind ?? 'report');
  const [subject, setSubject] = useState(base?.subject ?? '');
  const [htmlBody, setHtmlBody] = useState(base?.htmlBody ?? '');
  const [reportId, setReportId] = useState(base?.reportId ?? '');
  const [issueId, setIssueId] = useState(base?.newsletterIssueId ?? '');
  const [externalLink, setExternalLink] = useState(base?.externalLink ?? '');
  const [recipients, setRecipients] = useState<EmailRecipient[]>(base?.recipients ?? []);
  const [notes, setNotes] = useState(base?.notes ?? '');
  const [ready, setReady] = useState(base?.status === 'ready');
  const [showPreview, setShowPreview] = useState(true);
  const [matching, setMatching] = useState(false);
  const [matchNote, setMatchNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState<CopyState>('idle');
  const [bccCopied, setBccCopied] = useState<CopyState>('idle');
  const timers = useRef<number[]>([]);

  const report = useMemo(() => reports.find((r) => r.id === reportId) ?? null, [reports, reportId]);
  const issue = useMemo(() => newsletters.find((n) => n.id === issueId) ?? null, [newsletters, issueId]);

  const portalLink = report ? `${publicOrigin()}/portal?report=${report.id}` : null;
  const previewDoc = useMemo(
    () => (htmlBody.trim() ? asDocument(subject || 'REGIS', htmlBody) : ''),
    [subject, htmlBody],
  );

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
      const link = `${publicOrigin()}/portal?report=${r.id}`;
      setHtmlBody(
        `<p>Dear client,</p>`
        + `<p>Please find our latest research below.</p>`
        + `<p><strong>${r.title}</strong>${r.analyst ? ` — ${r.analyst}` : ''}${r.date ? ` · ${fmtDate(r.date)}` : ''}</p>`
        + (r.summary ? `<p>${r.summary}</p>` : '')
        + `<p><a href="${link}">Read the full report on the REGIS client portal</a></p>`
        + `<p>Best regards,<br/>REGIS Partners Research</p>`,
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
      const have = new Set(recipients.map((r) => r.email.toLowerCase()));
      const added = res.clients.filter((c) => !have.has(c.email.toLowerCase()));
      setRecipients([
        ...recipients,
        ...added.map((c) => ({ email: c.email, name: c.name, userId: c.id, source: 'client' as const })),
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

  /* ── Persistence ───────────────────────────────────────────── */

  function payload() {
    return {
      kind,
      subject: subject.trim(),
      htmlBody: htmlBody || null,
      reportId: kind === 'report' && reportId ? Number(reportId) : null,
      newsletterIssueId: kind === 'newsletter' && issueId ? Number(issueId) : null,
      externalLink: kind === 'report' && externalLink.trim() ? externalLink.trim() : null,
      recipients,
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

  async function save(): Promise<EmailBlast | null> {
    const problem = validate();
    if (problem) { setError(problem); return null; }
    setSaving(true);
    setError(null);
    try {
      const res = editingId
        ? await apiFetch<ItemResponse>(`/cms/email-blasts/${editingId}`, { method: 'PUT', audience: 'cms', body: payload() })
        : await apiFetch<ItemResponse>('/cms/email-blasts', { method: 'POST', audience: 'cms', body: payload() });
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

  /** Save (so the record matches what went out), then mark it sent. */
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
    if (!previewDoc) { flash(setCopied, false); return; }
    flash(setCopied, await writeClipboardHtml(previewDoc, htmlToPlain(previewDoc)));
  }

  async function copyBcc() {
    flash(setBccCopied, await writeClipboard(recipients.map((r) => r.email).join(';')));
  }

  function openOutlook() {
    const fit = outlookCompose({ bcc: recipients.map((r) => r.email), subject: subject.trim() || 'REGIS' });
    if (!fit) outlookCompose({ subject: subject.trim() || 'REGIS' });
  }

  const kindLocked = Boolean(editingId);

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
                    {report.analyst}{report.category ? ` · ${report.category}` : ''}{report.company ? ` · ${report.company} name` : ''}
                  </p>
                  {portalLink && (
                    <p className="mono break-all text-[10.5px] text-graphite">
                      Portal link (local clients): <span className="text-slate">{portalLink}</span>
                    </p>
                  )}
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
                helper="Optional. Foreign-client research goes out with the Jefferies-generated link — paste it here and it stays on the record."
              />
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
            </div>
          )}

          {kind === 'adhoc' && (
            <p className="border-l-2 pl-4 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-amber)', color: 'var(--color-amber-deep)' }}>
              Attach the report PDF in Outlook before sending — files are not stored here.
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
                ? 'Prefilled from the report — edit freely. The portal link works for signed-in local clients.'
                : 'Written from scratch. The mailer wraps it in the house Arial styling.'}
            />
          )}

          <RecipientPicker
            clients={clients}
            subscribers={subscribers}
            value={recipients}
            onChange={setRecipients}
          />

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
            {session?.outlookEmail ? (
              <p className="mono mt-1.5 text-[12.5px] text-slate">{session.outlookEmail}</p>
            ) : (
              <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: 'var(--color-amber-deep)' }}>
                No Outlook account on your staff profile — an administrator can add it under{' '}
                <Link to="/cms/access" className="underline">Users &amp; access</Link>. The blast still records who sent it.
              </p>
            )}
          </div>
        </div>

        {/* ── Live preview ── */}
        {showPreview && (
          <div className="min-w-0">
            <div className="sticky top-[calc(var(--cms-header-h)_+_1.5rem)]">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="mono text-[10px] uppercase tracking-[0.2em] text-graphite">Email preview</span>
                <span className="mono text-[10px] uppercase tracking-[0.2em] text-silver">{BLAST_KIND[kind]}</span>
              </div>
              {previewDoc ? (
                <iframe
                  title="Blast preview"
                  srcDoc={previewDoc}
                  sandbox=""
                  className="h-[70vh] w-full border rule bg-white shadow-sm"
                />
              ) : (
                <p className="border border-dashed rule px-5 py-10 text-[13px] text-graphite">
                  The preview fills in as soon as the blast has a body.
                </p>
              )}
              <p className="mt-3 text-[11.5px] leading-relaxed text-graphite">
                Exactly what a recipient sees. Copy pastes this into Outlook unchanged.
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
                  {recipients.length} {recipients.length === 1 ? 'recipient' : 'recipients'}
                </span>
                {subject.trim() || 'Untitled blast'}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <BtnGhost onClick={() => void copyRich()} disabled={!previewDoc}>
              {copied === 'ok' ? <IconCheck size={13} /> : <IconCopy size={13} />}
              {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Copy failed' : 'Copy email'}
            </BtnGhost>
            <BtnGhost onClick={() => void copyBcc()} disabled={recipients.length === 0}>
              {bccCopied === 'ok' ? <IconCheck size={13} /> : <IconCopy size={13} />}
              {bccCopied === 'ok' ? 'BCC copied' : 'Copy BCC'}
            </BtnGhost>
            <BtnGhost onClick={openOutlook}>
              <IconMail size={14} /> Open Outlook
            </BtnGhost>
            <BtnGhost onClick={onClose}>Discard</BtnGhost>
            <BtnGhost onClick={() => void markSent()} disabled={sending || saving}>
              {sending ? 'Recording…' : 'Mark as sent'}
            </BtnGhost>
            <BtnPrimary onClick={() => void saveAndClose()} disabled={saving || sending}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save blast'}
            </BtnPrimary>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
