import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NewsletterCadence, NewsletterRailBlock, NewsletterSection } from '../../data';
import TemplatePreview from './TemplatePreview';

/* ─────────────────────────────────────────────────────────────
   HTML export. The mailer template is rendered to a standalone
   HTML document — the very component the composer previews, in
   its email mode (tables, no flex) so Outlook desktop's Word
   engine prints the same layout. The document is what gets
   copied into the Outlook compose window and what the Email
   desk stores on a blast.
   ───────────────────────────────────────────────────────────── */

export type RenderableIssue = {
  cadence: NewsletterCadence;
  date: string;
  subject: string;
  intro: string;
  sections: NewsletterSection[];
  /** Monthly right-hand rail; empty on the daily and weekly. */
  rail?: NewsletterRailBlock[];
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The origin recipients load chart images from. Blasting from a dev
 * machine would otherwise embed localhost URLs that break for every
 * recipient, so production can pin this via VITE_PUBLIC_ORIGIN.
 */
export function publicOrigin(): string {
  const env = import.meta.env?.VITE_PUBLIC_ORIGIN as string | undefined;
  return (env || window.location.origin).replace(/\/$/, '');
}

/** Rewrite root-relative src/href attributes to absolute URLs. */
function absolutize(markup: string, baseUrl: string): string {
  return markup.replace(/(src|href)="\/(?!\/)/g, `$1="${baseUrl}/`);
}

/** The issue as a full self-contained HTML document, email-safe layout. */
export function renderIssueHtml(issue: RenderableIssue, opts?: { baseUrl?: string }): string {
  const baseUrl = (opts?.baseUrl ?? publicOrigin()).replace(/\/$/, '');
  const markup = absolutize(
    renderToStaticMarkup(createElement(TemplatePreview, { ...issue, mode: 'email' })),
    baseUrl,
  );

  return (
    '<!doctype html><html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + `<title>${escapeHtml(issue.subject || 'REGIS newsletter')}</title>`
    // The template already carries the legacy structure: a full-width
    // centering table holding the 800px sheet, exactly as the shipped
    // .htm issues open. No extra wrapper.
    + '</head><body style="margin:0;padding:0;background:#ffffff">'
    + markup
    + '</body></html>'
  );
}

/** A plain-text rendition for the clipboard's text/plain fallback. */
export function issuePlainText(issue: RenderableIssue): string {
  const host = document.createElement('div');
  host.innerHTML = renderIssueHtml(issue);
  return (host.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Open the rendered issue in a new tab so staff can inspect the HTML file. */
export function openIssueHtml(issue: RenderableIssue): void {
  const blob = new Blob([renderIssueHtml(issue)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  // The tab keeps its own copy of the document; the URL can go.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Save the rendered issue as an .html file named after the subject. */
export function downloadIssueHtml(issue: RenderableIssue): void {
  const blob = new Blob([renderIssueHtml(issue)], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(issue.subject || 'REGIS newsletter').replace(/[\\/:*?"<>|]/g, '-')}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
