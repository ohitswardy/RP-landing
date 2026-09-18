import { ApiError, apiFetch, getToken } from '../../../lib/api';
import type { AuditEntry, CrmsEvent, EventChildren } from '../../data';

/* ─────────────────────────────────────────────────────────────
   The itinerary as a file: download the server-rendered PDF, or
   have it emailed (to yourself by default — the legacy envelope
   button). Shared by the events list row actions and the
   itinerary modal so both filter to one contact the same way.
   ───────────────────────────────────────────────────────────── */

const pdfPath = (event: CrmsEvent, contactId: string | null) => `/crms/events/${event.id}/itinerary.pdf${contactId ? `?contactId=${contactId}` : ''}`;

/** Fetches the PDF with the session token and hands it to the browser as a download. */
export async function downloadItinerary(event: CrmsEvent, contactId: string | null = null): Promise<string> {
  const token = getToken('cms');
  const res = await fetch(`/api${pdfPath(event, contactId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new ApiError(res.status, res.status === 401 ? 'Your session has expired. Sign in again.' : 'The itinerary PDF could not be built.');
  const disposition = res.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${event.categoryLabel} Schedule - ${event.subject}.pdf`;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return filename;
}

/** Emails the PDF through the desk mailbox; resolves with the address it went to. */
export async function emailItinerary(event: CrmsEvent, contactId: string | null = null, to?: string): Promise<{ to: string; audit?: AuditEntry }> {
  return apiFetch<{ to: string; audit?: AuditEntry }>(`/crms/events/${event.id}/itinerary/email`, {
    method: 'POST', audience: 'cms', body: { contactId: contactId ? Number(contactId) : null, to: to || null },
  });
}

/** Contacts who could receive a personal schedule: everyone on a meeting or the investor list. */
export function contactOptionsFrom(children: Pick<EventChildren, 'meetings' | 'investors'>): { id: string; label: string; hint?: string | null }[] {
  const seen = new Map<string, { id: string; label: string; hint?: string | null }>();
  for (const m of children.meetings) for (const c of m.clientContacts) seen.set(String(c.id), { id: String(c.id), label: c.name, hint: c.client_name ?? m.clientName });
  for (const i of children.investors) for (const c of i.clientContacts) seen.set(String(c.id), { id: String(c.id), label: c.name, hint: i.clientName });
  return Array.from(seen.values());
}
