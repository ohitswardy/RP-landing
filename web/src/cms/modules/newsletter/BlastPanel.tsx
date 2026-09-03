import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCms } from '../../store';
import { useAuth } from '../../auth';
import { apiFetch } from '../../../lib/api';
import { writeClipboard, writeClipboardHtml, outlookCompose } from '../../../lib/clipboard';
import { BtnGhost, BtnPrimary, Chip } from '../../ui';
import { Modal } from '../../kit/parts';
import { IconCheck, IconCopy, IconExternal, IconMail } from '../../icons';
import { fmtDate, type AuditEntry, type NewsletterIssue } from '../../data';
import { renderIssueHtml, issuePlainText, openIssueHtml } from './emailHtml';

/* ─────────────────────────────────────────────────────────────
   Blast a filed issue through Outlook. Nothing is sent from the
   system: the rendered HTML is copied to the clipboard, Outlook
   opens with the envelope pre-filled, and the staff member pastes
   the body. "Blast later" files a draft in the Email desk instead.
   ───────────────────────────────────────────────────────────── */

type CopyState = 'idle' | 'ok' | 'fail';

export default function BlastPanel({ issue, onClose }: {
  issue: NewsletterIssue;
  onClose: () => void;
}) {
  const { subscribers, appendAudit } = useCms();
  const { can } = useAuth();
  const navigate = useNavigate();

  const [copied, setCopied] = useState<CopyState>('idle');
  const [bccCopied, setBccCopied] = useState<CopyState>('idle');
  const [queueing, setQueueing] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const html = useMemo(() => renderIssueHtml(issue), [issue]);

  const verified = useMemo(
    () => subscribers.filter((s) => s.verified).map((s) => s.email),
    [subscribers],
  );

  const flash = (set: (s: CopyState) => void, ok: boolean) => {
    set(ok ? 'ok' : 'fail');
    timers.current.push(window.setTimeout(() => set('idle'), 2200));
  };

  async function copyRich() {
    flash(setCopied, await writeClipboardHtml(html, issuePlainText(issue)));
  }

  async function copyBcc() {
    flash(setBccCopied, await writeClipboard(verified.join(';')));
  }

  function openOutlook() {
    const fit = outlookCompose({ bcc: verified, subject: issue.subject });
    if (!fit) {
      // The list overflows the mailto URL — open with the subject only.
      outlookCompose({ subject: issue.subject });
    }
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
          recipients: verified.map((email) => ({ email, source: 'subscriber' })),
          status: 'draft',
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
          {can('email.manage') && (
            <BtnGhost onClick={() => void queueForLater()} disabled={queueing}>
              {queueing ? 'Queueing…' : 'Blast later — queue in Email desk'}
            </BtnGhost>
          )}
          <BtnPrimary onClick={openOutlook}>
            <IconMail size={14} /> Open Outlook
          </BtnPrimary>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y rule py-4">
          <div>
            <div className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite">Recipients</div>
            <p className="mt-1 text-[13.5px] text-ink">
              {verified.length} verified subscriber{verified.length === 1 ? '' : 's'}
              <span className="text-graphite"> · {fmtDate(issue.date)} issue</span>
            </p>
          </div>
          <Chip tone={verified.length > 0 ? 'live' : 'amber'}>
            {verified.length > 0 ? 'List ready' : 'No verified recipients'}
          </Chip>
        </div>

        <ol className="space-y-3 text-[13px] leading-relaxed text-slate">
          <li>
            <span className="mono mr-2 text-[10px] uppercase tracking-[0.16em] text-graphite">01</span>
            Copy the issue — the paste keeps the full mailer layout.
          </li>
          <li>
            <span className="mono mr-2 text-[10px] uppercase tracking-[0.16em] text-graphite">02</span>
            Open Outlook — the subject and BCC list are pre-filled when the list fits; otherwise paste the copied BCC list.
          </li>
          <li>
            <span className="mono mr-2 text-[10px] uppercase tracking-[0.16em] text-graphite">03</span>
            Paste into the message body (Ctrl+V) and send.
          </li>
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <BtnPrimary onClick={() => void copyRich()}>
            {copied === 'ok' ? <IconCheck size={13} /> : <IconCopy size={13} />}
            {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Copy failed' : 'Copy email (rich)'}
          </BtnPrimary>
          <BtnGhost onClick={() => void copyBcc()} disabled={verified.length === 0}>
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
