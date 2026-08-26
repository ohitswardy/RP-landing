import { apiFetch } from '../lib/api';
import type { ClientActivityEvent, Report } from '../cms/data';

/* ─────────────────────────────────────────────────────────────
   Consumption beacons for the portal. Every view, download, and
   click posts one event to the API's tamper-evident ledger. The
   beacons are fire-and-forget: a failed post never interrupts
   the client's reading.
   ───────────────────────────────────────────────────────────── */

/** Same event within this window is one action (StrictMode re-mounts,
    double clicks), not two. */
const DEDUPE_MS = 1500;
const recent = new Map<string, number>();

export function trackActivity(event: ClientActivityEvent, report: Report | null, context = ''): void {
  const key = `${event}|${report?.id ?? ''}|${context}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUPE_MS) return;
  recent.set(key, now);

  void apiFetch('/portal/activity', {
    method: 'POST',
    audience: 'portal',
    body: { event, reportId: report ? Number(report.id) : null, context },
  }).catch(() => { /* the ledger misses one beacon, the client reads on */ });
}
