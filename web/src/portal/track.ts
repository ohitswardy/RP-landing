import { apiFetch, ApiError } from '../lib/api';
import { notify } from './notice';
import type { ClientActivityEvent, Report } from '../cms/data';

/* ─────────────────────────────────────────────────────────────
   Consumption beacons for the portal. Every view, download, and
   click posts one event to the API's tamper-evident ledger. The
   beacons are fire-and-forget: a failed post never interrupts
   the client's reading — it only raises a quiet notice — and
   `keepalive` lets an unload-time event finish after the page
   has gone.
   ───────────────────────────────────────────────────────────── */

/** Same event within this window is one action (StrictMode re-mounts,
    double clicks), not two. */
const DEDUPE_MS = 1500;
const recent = new Map<string, number>();

/** One notice per quiet spell, however many beacons drop in it. */
const NOTICE_EVERY_MS = 30_000;
let lastNoticeAt = 0;

export function trackActivity(event: ClientActivityEvent, report: Report | null, context = ''): void {
  const key = `${event}|${report?.id ?? ''}|${context}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUPE_MS) return;
  recent.set(key, now);

  void apiFetch('/portal/activity', {
    method: 'POST',
    audience: 'portal',
    keepalive: true,
    body: { event, reportId: report ? Number(report.id) : null, context },
  }).catch((e: unknown) => {
    // A session failure is already on its way to the door via the auth listener.
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return;
    if (Date.now() - lastNoticeAt < NOTICE_EVERY_MS) return;
    lastNoticeAt = Date.now();
    notify('Your reading activity could not be recorded just now. Reading continues as normal.', { tone: 'info' });
  });
}
