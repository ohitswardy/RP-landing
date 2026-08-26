import { apiBlobUrl } from '../lib/api';
import { trackActivity } from './track';
import type { Report } from '../cms/data';

/** Resolve a report to a URL then trigger a browser download.
    `context` names the surface the download started from, for the ledger. */
export async function downloadReport(report: Report, context = 'card') {
  let url = report.fileUrl ?? null;
  let revoke = false;
  if (!url) {
    url = await apiBlobUrl(`/reports/${report.id}/file`, 'portal');
    if (!url) return;
    revoke = true;
  }
  trackActivity('download', report, context);
  const a = document.createElement('a');
  a.href = url;
  a.download = report.fileName || `${report.title}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(url!), 10_000);
}
