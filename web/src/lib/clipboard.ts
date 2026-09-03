/* ─────────────────────────────────────────────────────────────
   Clipboard + Outlook-compose helpers shared by the Access,
   Newsletter, Reports, and Email desk modules. Nothing is sent
   from the system: staff copy the composed content and paste it
   into the Outlook message that actually goes out.
   ───────────────────────────────────────────────────────────── */

export async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers that gate the async clipboard API.
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Copy rich HTML so a paste into Outlook keeps the mailer's layout.
 * A plain-text rendition rides along for editors that refuse HTML.
 */
export async function writeClipboardHtml(html: string, plain: string): Promise<boolean> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ]);
    return true;
  } catch {
    // Fallback: select a hidden contenteditable region and copy it.
    try {
      const host = document.createElement('div');
      host.contentEditable = 'true';
      host.style.position = 'fixed';
      host.style.opacity = '0';
      host.style.pointerEvents = 'none';
      host.innerHTML = html;
      document.body.appendChild(host);

      const range = document.createRange();
      range.selectNodeContents(host);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      const ok = document.execCommand('copy');
      selection?.removeAllRanges();
      host.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Open the default mail client (Outlook) with the envelope pre-filled.
 * mailto: cannot carry an HTML body — the body is pasted from the clipboard.
 * Long BCC lists overflow the mailto URL (~2,000 chars on Windows/Outlook),
 * so callers should fall back to a copied BCC list when this returns false.
 */
export function outlookCompose({ to = [], bcc = [], subject }: {
  to?: string[]; bcc?: string[]; subject: string;
}): boolean {
  const params = new URLSearchParams();
  if (bcc.length) params.set('bcc', bcc.join(';'));
  params.set('subject', subject);
  const url = `mailto:${to.join(';')}?${params.toString().replace(/\+/g, '%20')}`;
  if (url.length > 1800) return false;
  window.location.href = url;
  return true;
}

/* ── Reading images off the clipboard ─────────────────────────── */

/** A stable, sortable name for a pasted graphic: pasted-20260902-1431. */
function pastedName(type: string): string {
  const ext = (type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `pasted-${stamp}.${ext}`;
}

/** The first image carried by a paste event, if the paste held one. */
export function clipboardEventImage(e: ClipboardEvent): File | null {
  const data = e.clipboardData;
  if (!data) return null;

  const file = Array.from(data.files ?? []).find((f) => f.type.startsWith('image/'));
  if (file) return file;

  // A screenshot pastes as an item rather than a file.
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const blob = item.getAsFile();
    if (blob) return new File([blob], pastedName(blob.type), { type: blob.type });
  }
  return null;
}

/**
 * Pull an image off the system clipboard on demand — the Paste button,
 * as opposed to the Ctrl+V path above. Chromium grants this from a user
 * gesture; browsers that gate or lack the API return null, and the
 * caller falls back to telling the editor to press Ctrl+V.
 */
export async function readClipboardImage(): Promise<File | null> {
  if (!navigator.clipboard?.read) return null;
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (!type) continue;
      const blob = await item.getType(type);
      return new File([blob], pastedName(type), { type });
    }
  } catch {
    return null;
  }
  return null;
}
