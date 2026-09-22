import { getToken } from '../../lib/api';
import { trackActivity } from '../../lib/activity';

/* ─────────────────────────────────────────────────────────────
   Authenticated file downloads (workbooks, the original template)
   for the CRMS: a raw fetch with the staff token, tracked on the
   rail orb, saved under the server's file name.
   ───────────────────────────────────────────────────────────── */

export async function downloadFile(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}, fallbackName = 'download.xlsx'): Promise<string> {
  const token = getToken('cms');
  const { blob, name } = await trackActivity('download', async () => {
    const res = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error(j?.message ?? `Request failed (${res.status}).`);
    }
    return {
      blob: await res.blob(),
      name: /filename\*?=(?:UTF-8'')?"?([^";]+)"?/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName,
    };
  }, { success: true });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = decodeURIComponent(name);
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
}
