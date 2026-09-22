import { apiBlob, ApiError } from '../lib/api';
import { portalIdentity } from './auth';
import { notify } from './notice';
import { trackActivity } from './track';
import { stampPdf, WatermarkError } from './watermark';
import type { Report } from '../cms/data';

/* ─────────────────────────────────────────────────────────────
   Every route out of the portal — card, featured, bookmark shelf,
   viewer — resolves its file through here, so no copy leaves
   without the provenance stamp applied in ./watermark.

   The stored PDF is read through the authenticated API first, so
   the coverage mandate is enforced on every byte; the public
   `fileUrl` is only consulted when the API says nothing is stored
   (seeded sample reports). Both paths are stamped. Nothing here
   ever resolves to unstamped bytes — a failure is a typed error
   the surfaces show with a retry.
   ───────────────────────────────────────────────────────────── */

export type ReportFileFailure =
  /** No stored file anywhere. */
  | 'missing'
  /** The API or the public URL could not be reached / refused. */
  | 'fetch'
  /** The bytes arrived but the stamp could not be written. */
  | 'watermark'
  /** The session ended mid-download; the auth listener is handling it. */
  | 'session';

export class ReportFileError extends Error {
  kind: ReportFileFailure;
  constructor(kind: ReportFileFailure, message: string, cause?: unknown) {
    super(message);
    this.name = 'ReportFileError';
    this.kind = kind;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

const COPY: Record<ReportFileFailure, string> = {
  missing: 'This report has no file attached yet. The document may still be publishing.',
  fetch: 'The report could not be retrieved. Check your connection and try again.',
  watermark: 'Your copy could not be watermarked, so it was not handed over. Try again.',
  session: 'Your session ended before the download finished.',
};

/** The stored PDF: the authenticated copy, else the public URL when the API
    has nothing stored. Resolves `null` only when neither has a file. */
async function storedPdf(report: Report): Promise<Blob | null> {
  let viaApi: Blob | null;
  try {
    viaApi = await apiBlob(`/reports/${report.id}/file`, 'portal');
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      throw new ReportFileError('session', COPY.session, e);
    }
    throw new ReportFileError('fetch', e instanceof Error ? e.message : COPY.fetch, e);
  }
  if (viaApi) return viaApi;

  if (!report.fileUrl) return null;
  try {
    const res = await fetch(report.fileUrl);
    if (res.status === 404) return null;
    if (!res.ok) throw new ReportFileError('fetch', COPY.fetch);
    return await res.blob();
  } catch (e) {
    if (e instanceof ReportFileError) throw e;
    throw new ReportFileError('fetch', COPY.fetch, e);
  }
}

/**
 * The client's copy of a report: the stored PDF with this client's name and
 * the current timestamp stamped onto every page.
 *
 * Rejects with a `ReportFileError` naming what went wrong; never resolves
 * to the unstamped file.
 */
export async function stampedReportBlob(report: Report): Promise<Blob> {
  const stored = await storedPdf(report);
  if (!stored) throw new ReportFileError('missing', COPY.missing);

  try {
    return await stampPdf(
      await stored.arrayBuffer(),
      { title: report.title, date: report.date },
      portalIdentity(),
    );
  } catch (e) {
    const message = e instanceof WatermarkError ? e.message : COPY.watermark;
    throw new ReportFileError('watermark', message, e);
  }
}

/** The copy shown for a failed retrieval, whatever threw. */
export function reportFileMessage(e: unknown): string {
  if (e instanceof ReportFileError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return COPY.fetch;
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

/**
 * Stamp a report and trigger a browser download. `context` names the
 * surface the download started from, for the ledger.
 *
 * Resolves `true` when the file was handed over. On failure it raises a
 * notice with a Retry action (unless the session is already on its way to
 * the door) and resolves `false` — it never throws into a click handler.
 */
export async function downloadReport(report: Report, context = 'card'): Promise<boolean> {
  try {
    const blob = await stampedReportBlob(report);
    trackActivity('download', report, context);
    saveBlob(blob, report.fileName || `${report.title}.pdf`);
    return true;
  } catch (e) {
    if (e instanceof ReportFileError && e.kind === 'session') return false;
    const retryable = !(e instanceof ReportFileError && e.kind === 'missing');
    notify(`${report.title}: ${reportFileMessage(e)}`, {
      tone: 'warn',
      action: retryable ? { label: 'Retry', onClick: () => { void downloadReport(report, context); } } : undefined,
    });
    return false;
  }
}
