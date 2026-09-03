import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCms } from '../../store';
import { useAuth } from '../../auth';
import { apiFetch } from '../../../lib/api';
import { writeClipboard, writeClipboardHtml, outlookCompose } from '../../../lib/clipboard';
import { downloadEmlDraft } from '../../../lib/eml';
import { BtnGhost, BtnPrimary, Chip } from '../../ui';
import { Modal } from '../../kit/parts';
import { IconCheck, IconCopy, IconExternal, IconMail } from '../../icons';
import { fmtDate, type AuditEntry, type DistributionList, type EmailRecipient, type NewsletterIssue } from '../../data';
import { renderIssueHtml, issuePlainText, openIssueHtml } from './emailHtml';

/* ─────────────────────────────────────────────────────────────
   Blast a filed issue. The audience is every verified subscriber
   by default, or a saved distribution list. From here the issue
   either goes out by hand through Outlook (copy, paste, send) or
   is queued in the Email desk, where it can be sent from the
   staff mailbox through Microsoft 365 with a personal unsubscribe
   link on every subscriber's copy.
   ───────────────────────────────────────────────────────────── */

type CopyState = 'idle' | 'ok' | 'fail';
const ALL = 'all';

export default function BlastPanel({ issue, onClose }: {
  issue: NewsletterIssue;
  onClose: () => void;
}) {
  const { subscribers, appendAudit } = useCms();
  const { can, session } = useAuth();
  const navigate = useNavigate();

  const [copied, setCopied] = useState<CopyState>('idle');
  const [bccCopied, setBccCopied] = useState<CopyState>('idle');
  const [drafted, setDrafted] = useState<CopyState>('idle');
  const [queueing, setQueueing] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [lists, setLists] = useState<DistributionList[]>([]);
  const [audienceId, setAudienceId] = useState<string>(ALL);
  const timers = useRef<number[]>([]);

  const html = useMemo(() => renderIssueHtml(issue), [issue]);
  const emailDesk = can('email.manage');

  useEffect(() => {
    if (!emailDesk) return;
    let on = true;
    apiFetch<{ items: DistributionList[] }>('/cms/distribution-lists', { audience: 'cms' })
      .then((res) => { if (on) setLists(res.items); })
      .catch(() => { /* the default audience still works */ });
    return () => { on = false; };
  }, [emailDesk]);

  const verified = useMemo<EmailRecipient[]>(
    () => subscribers.filter((s) => s.verified).map((s) => ({ email: s.email.toLowerCase(), source: 'subscriber' as const })),
    [subscribers],
  );

  const recipients = useMemo<EmailRecipient[]>(() => {
    if (audienceId === ALL) return verified;
    const list = lists.find((l) => l.id === audienceId);
    return list ? list.contacts : verified;
  }, [audienceId, lists, verified]);

  const emails = useMemo(() => recipients.map((r) => r.email), [recipients]);
  const audienceLabel = audienceId === ALL
    ? `${verified.length} verified subscriber${verified.length === 1 ? '' : 's'}`
    : `${recipients.length} contact${recipients.length === 1 ? '' : 's'} · ${lists.find((l) => l.id === audienceId)?.name ?? 'list'}`;

  const flash = (set: (s: CopyState) => void, ok: boolean) => {
    set(ok ? 'ok' : 'fail');
    timers.current.push(window.setTimeout(() => set('idle'), 2200));
  };

  async function copyRich() {
    flash(setCopied, await writeClipboardHtml(html, issuePlainText(issue)));
  }

  async function copyBcc() {
    flash(setBccCopied, await writeClipboard(emails.join(';')));
  }

  /**
   * Download the issue as a ready-to-send Outlook draft — subject, BCC
   * list, and the rendered mailer all in place. mailto: is only the
   * fallback: it carries no body, and it goes nowhere at all when Windows
   * has no handler registered for the scheme.
   */
  function openOutlook() {
    if (downloadEmlDraft({
      subject: issue.subject,
      html,
      bcc: emails,
      from: session?.outlookEmail ?? null,
    })) {
      flash(setDrafted, true);
      return;
    }
    const fit = outlookCompose({ bcc: emails, subject: issue.subject });
    // The list overflows the mailto URL — open with the subject only.
    if (!fit) outlookCompose({ subject: issue.subject });
    flash(setDrafted, false);
  }

  async function queueForLater() {
    setQueueing(true);
    setQueueError(null);
    try {
      const res = await apiFetch<{ item: { id: string }; audit?: AuditEntry }>('/cms/email-blasts', {
        method: 'POST',
        audience: 'cms',
        body: {
          kind: 'newsletter',
          newsletterIssueId: issue.id,
          subject: issue.subject,
          htmlBody: html,
          recipients,
          status: 'ready',
        },
      });
      appendAudit(res.audit);
      onClose();
      navigate('/cms/email');
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : 'The blast could not be queued.');
      setQueueing(false);
    }
  }

  return (
    <Modal
      open
      title={`Email blast · ${issue.subject}`}
      onClose={() => { timers.current.forEach((t) => window.clearTimeout(t)); onClose(); }}
      footer={
        <>
          {emailDesk && (
            <BtnGhost onClick={() => void queueForLater()} disabled={queueing || recipients.length === 0}>
              {queueing ? 'Queueing…' : 'Queue in Email desk — send from your mailbox'}
            </BtnGhost>
          )}
          <BtnPrimary onClick={openOutlook}>
            {drafted === 'ok' ? <IconCheck size={14} /> : <IconMail size={14} />}
            {drafted === 'ok' ? 'Draft saved — open it' : drafted === 'fail' ? 'Opened envelope only' : 'Open in Outlook'}
          </BtnPrimary>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y rule py-4">
          <div className="min-w-0">
            <div className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite">Audience</div>
            {emailDesk && lists.length > 0 ? (
              <select
                value={audienceId}
                onChange={(e) => setAudienceId(e.target.value)}
                className="mt-1.5 appearance-none border rule bg-white px-3 py-2 text-[13px] text-ink outline-none transition-colors duration-300 focus:border-[color:var(--color-amber-deep)]"
              >
                <option value={ALL}>All verified subscribers ({verified.length})</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.count})</option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-[13.5px] text-ink">{audienceLabel}</p>
            )}
            <p className="mt-1 text-[11.5px] text-graphite">{fmtDate(issue.date)} issue{emailDesk && lists.length > 0 ? ` · ${audienceLabel}` : ''}</p>
          </div>
          <Chip tone={recipients.length > 0 ? 'live' : 'amber'}>
            {recipients.length > 0 ? 'List ready' : 'No recipients'}
          </Chip>
        </div>

        <ol className="space-y-3 text-[13px] leading-relaxed text-slate">
          <li>
            <span className="mono mr-2 text-[10px] uppercase tracking-[0.16em] text-graphite">01</span>
            <span className="text-ink">Open in Outlook</span> saves the issue as a draft — body, subject, and BCC list already in place.
          </li>
          <li>
            <span className="mono mr-2 text-[10px] uppercase tracking-[0.16em] text-graphite">02</span>
            Open the downloaded file. Outlook composes it as a new message, ready to review.
          </li>
          <li>
            <span className="mono mr-2 text-[10px] uppercase tracking-[0.16em] text-graphite">03</span>
            Send it there. The copy buttons below are only needed if you would rather build the message by hand.
          </li>
          {emailDesk && (
            <li>
              <span className="mono mr-2 text-[10px] uppercase tracking-[0.16em] text-graphite">or</span>
              Queue it in the Email desk to send from your own mailbox — each subscriber gets a copy with a personal unsubscribe link.
            </li>
          )}
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <BtnPrimary onClick={() => void copyRich()}>
            {copied === 'ok' ? <IconCheck size={13} /> : <IconCopy size={13} />}
            {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Copy failed' : 'Copy email (rich)'}
          </BtnPrimary>
          <BtnGhost onClick={() => void copyBcc()} disabled={emails.length === 0}>
            {bccCopied === 'ok' ? <IconCheck size={13} /> : <IconCopy size={13} />}
            {bccCopied === 'ok' ? 'BCC copied' : 'Copy BCC list'}
          </BtnGhost>
          <BtnGhost onClick={() => openIssueHtml(issue)}>
            <IconExternal size={13} /> View HTML
          </BtnGhost>
        </div>

        {queueError && (
          <p className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
            {queueError}
          </p>
        )}

        <div className="max-h-[46vh] overflow-y-auto border rule shadow-sm">
          <iframe title="Issue preview" srcDoc={html} sandbox="" className="h-[600px] w-full border-0 bg-white" />
        </div>
        <p className="text-[11.5px] leading-relaxed text-graphite">
          Rendered in the email layout — tables instead of columns — exactly as Outlook prints it.
        </p>
      </div>
    </Modal>
  );
}
