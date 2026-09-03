import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import type { BlastKind, BlastVariant, EmailBlast } from '../../data';

/* ─────────────────────────────────────────────────────────────
   The HTML a recipient actually gets. Report and ad-hoc bodies
   are fragments that the API sets inside the house mailer (logo,
   ticker line, CTA, analyst signature), so the preview asks the
   API to render them — the same code path the send job uses, so
   the preview can never drift from the mail. Newsletter bodies
   are already full documents and skip the round-trip.
   ───────────────────────────────────────────────────────────── */

export type PreviewInput = {
  kind: BlastKind;
  subject: string;
  htmlBody: string;
  reportId: string | null;
  externalLink: string | null;
  variant: BlastVariant;
};

export const isDocument = (html: string) => /^\s*<!doctype/i.test(html);

export function previewInputFor(b: EmailBlast, variant: BlastVariant): PreviewInput {
  return {
    kind: b.kind,
    subject: b.subject,
    htmlBody: b.htmlBody ?? '',
    reportId: b.reportId,
    externalLink: b.externalLink,
    variant,
  };
}

export function useRenderedPreview(input: PreviewInput): { html: string; busy: boolean; error: string | null } {
  const { kind, subject, htmlBody, reportId, externalLink, variant } = input;
  const [html, setHtml] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!htmlBody.trim()) { setHtml(''); setBusy(false); setError(null); return; }
    if (isDocument(htmlBody)) { setHtml(htmlBody); setBusy(false); setError(null); return; }

    const ctrl = new AbortController();
    setBusy(true);
    const t = window.setTimeout(() => {
      apiFetch<{ html: string }>('/cms/email-blasts/render', {
        method: 'POST',
        audience: 'cms',
        signal: ctrl.signal,
        body: {
          kind,
          subject,
          htmlBody,
          reportId: kind === 'report' && reportId ? Number(reportId) : null,
          externalLink: kind === 'report' ? externalLink : null,
          variant,
        },
      })
        .then((res) => { setHtml(res.html); setError(null); })
        .catch((e) => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'The preview could not render.'); })
        .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
    }, 350);

    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [kind, subject, htmlBody, reportId, externalLink, variant]);

  return { html, busy, error };
}
