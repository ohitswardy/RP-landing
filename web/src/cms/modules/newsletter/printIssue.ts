import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NewsletterCadence, NewsletterSection } from '../../data';
import TemplatePreview from './TemplatePreview';

/* ─────────────────────────────────────────────────────────────
   PDF export. The mailer template is rendered to static markup —
   the very component the composer previews, so the PDF can never
   drift from what the editor saw — then printed from a hidden
   iframe. The browser's "Save as PDF" produces vector output with
   the issue subject as the default file name.

   Every page is stamped with the house watermark and a provenance
   line naming who downloaded it and when, so a leaked copy points
   back at a single download.
   ───────────────────────────────────────────────────────────── */

export type PrintableIssue = {
  cadence: NewsletterCadence;
  date: string;
  subject: string;
  intro: string;
  sections: NewsletterSection[];
};

/** The signed-in staff member, recorded on every printed page. */
export type PrintActor = { name: string; email: string } | null;

/* A4 in millimetres, matching the @page rule below. Laying the body
   out at exactly the printable width stops the browser scaling the
   document, which keeps the per-page watermark offsets true. */
const PAGE_W_MM = 194; // 210 less 8mm margins
const PAGE_H_MM = 277; // 297 less 10mm margins

const NAVY = '#1f4e79';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PRINT_CSS = `
  @page { size: A4; margin: 10mm 8mm; }
  html, body { margin: 0; padding: 0; }
  body { position: relative; width: ${PAGE_W_MM}mm; }

  /* Keep the navy bars, badges, and the watermark itself when the
     print dialog's "background graphics" box is left unticked. */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

  img, table, tr, li { page-break-inside: avoid; }
  img { max-width: 100%; }

  .wm-root { position: absolute; inset: 0 0 auto 0; height: 0; pointer-events: none; }
  .wm-page { position: absolute; left: 0; width: 100%; overflow: hidden; }
  .wm-mark {
    position: absolute; left: 0; top: 50%; width: 100%;
    transform: translateY(-50%) rotate(-28deg);
    text-align: center; white-space: nowrap;
    font: 700 60px Arial, Helvetica, sans-serif; letter-spacing: 0.18em;
    color: ${NAVY}; opacity: 0.055;
  }
  .wm-foot {
    position: absolute; left: 0; right: 0; bottom: 2mm;
    display: flex; justify-content: space-between; gap: 10px;
    font: 400 6.5px Arial, Helvetica, sans-serif; letter-spacing: 0.04em;
    color: #9aa4b2;
  }
  .wm-foot span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

/** Short, unique handle for one download — quotable when tracing a leak. */
function reference(issueDate: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  return `RP-${issueDate.replace(/-/g, '')}-${stamp}`;
}

/** Build the per-page watermark layers once the document height is known. */
function stampPages(doc: Document, issue: PrintableIssue, actor: PrintActor): void {
  // A probe of known millimetre height gives the px-per-page factor.
  const probe = doc.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;width:1px;height:${PAGE_H_MM}mm;`;
  doc.body.appendChild(probe);
  const pageH = probe.offsetHeight;
  probe.remove();
  if (pageH <= 0) return;

  const pages = Math.max(1, Math.ceil(doc.body.scrollHeight / pageH));
  const ref = reference(issue.date);
  const stamp = new Date().toLocaleString('en-PH', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const by = actor ? `Downloaded by ${actor.name} (${actor.email})` : 'Downloaded from the REGIS newsletter desk';

  const root = doc.createElement('div');
  root.className = 'wm-root';
  root.innerHTML = Array.from({ length: pages }, (_, i) => `
    <div class="wm-page" style="top:${i * pageH}px;height:${pageH}px">
      <div class="wm-mark">REGIS PARTNERS</div>
      <div class="wm-foot">
        <span>${escapeHtml(issue.subject)}</span>
        <span>${escapeHtml(`${by} · ${stamp} · ${ref}`)}</span>
        <span>Page ${i + 1}</span>
      </div>
    </div>`).join('');

  doc.body.appendChild(root);
}

/** Render, watermark, and hand the issue to the browser's PDF printer. */
export function downloadIssuePdf(issue: PrintableIssue, actor: PrintActor = null): Promise<void> {
  const markup = renderToStaticMarkup(createElement(TemplatePreview, issue));

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return Promise.resolve();
  }

  doc.open();
  // The <title> becomes the suggested PDF file name.
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(issue.subject || 'REGIS newsletter')}</title>`
    + `<style>${PRINT_CSS}</style></head><body>${markup}</body></html>`,
  );
  doc.close();

  // Charts stream from the API, and their height decides the page count,
  // so the watermark can only be laid out once they have all settled.
  const pending = Array.from(doc.images)
    .filter((img) => !img.complete)
    .map((img) => new Promise<void>((res) => { img.onload = img.onerror = () => res(); }));

  return Promise.all(pending).then(() => {
    stampPages(doc, issue, actor);
    win.focus();
    win.print();
    // The frame must outlive the (blocking or async) print dialog.
    setTimeout(() => iframe.remove(), 60_000);
  });
}
