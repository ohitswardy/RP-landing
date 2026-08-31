import { apiBlob } from '../lib/api';
import { portalIdentity } from './auth';
import { trackActivity } from './track';
import { stampPdf } from './watermark';
import type { Report } from '../cms/data';

/* ─────────────────────────────────────────────────────────────
   Every route out of the portal — card, featured, bookmark shelf,
   viewer — resolves its file through here, so no copy leaves
   without the provenance stamp applied in ./watermark.
   ───────────────────────────────────────────────────────────── */

/** The stored PDF, straight from the API (or the public URL when one is set). */
async function storedPdf(report: Report): Promise<Blob | null> {
  if (report.fileUrl) {
    try {
      const res = await fetch(report.fileUrl);
      if (res.ok) return await res.blob();
    } catch {
      /* fall through to the authenticated copy */
    }
  }
  return apiBlob(`/reports/${report.id}/file`, 'portal');
}

/**
 * The client's copy of a report: the stored PDF with this client's name and
 * the current timestamp stamped onto every page.
 *
 * Falls back to the stored file when the bytes cannot be re-written, so a
 * stubborn PDF degrades to an unstamped download rather than to nothing.
 */
export async function stampedReportBlob(report: Report): Promise<Blob | null> {
  const stored = await storedPdf(report);
  if (!stored) return null;

  const stamped = await stampPdf(
    await stored.arrayBuffer(),
    { title: report.title, date: report.date },
    portalIdentity(),
  );
  return stamped ?? stored;
}

/** Hand a blob to the browser under `name`, then release the object URL. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Stamp a report and trigger a browser download.
    `context` names the surface the download started from, for the ledger. */
export async function downloadReport(report: Report, context = 'card') {
  const blob = await stampedReportBlob(report);
  if (!blob) return;
  trackActivity('download', report, context);
  saveBlob(blob, report.fileName || `${report.title}.pdf`);
}
