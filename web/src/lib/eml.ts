/* ─────────────────────────────────────────────────────────────
   Outlook hand-off, the reliable half.

   mailto: has two failings the desk keeps hitting: it cannot
   carry an HTML body, and it does nothing at all — silently —
   when Windows has no application registered for the scheme.

   So the hand-off is a downloaded .eml instead: a complete
   RFC 5322 message carrying the subject, the BCC list, and the
   rendered HTML body. The `X-Unsent: 1` header is what makes it
   work — Outlook opens a message bearing it as an editable,
   ready-to-send compose window rather than as received mail.
   Opening it composes the blast in full. No copy, no paste.
   ───────────────────────────────────────────────────────────── */

const CRLF = '\r\n';

/** RFC 5322 keeps header and body lines under 998 characters. */
const MAX_LINE = 900;

export type EmlDraft = {
  subject: string;
  /** The rendered email — a full HTML document. */
  html: string;
  to?: string[];
  bcc?: string[];
  /** The mailbox this should send from; picks the account in a multi-mailbox Outlook. */
  from?: string | null;
};

/** UTF-8 → base64, chunked so a large body cannot overflow the call stack. */
function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** base64 bodies are wrapped at 76 characters, as MIME requires. */
function wrapBase64(b64: string): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
  return lines.join(CRLF);
}

/** Non-ASCII header values ride as RFC 2047 encoded words. */
function encodeHeaderValue(value: string): string {
  const clean = value.replace(/[\r\n]+/g, ' ').trim();
  // eslint-disable-next-line no-control-regex
  return /^[\x20-\x7E]*$/.test(clean) ? clean : `=?utf-8?B?${base64Utf8(clean)}?=`;
}

/** Fold a long address list across continuation lines (leading whitespace). */
function foldAddresses(name: string, addresses: string[]): string {
  const lines: string[] = [];
  let line = `${name}:`;
  addresses.forEach((address, i) => {
    const piece = `${address}${i < addresses.length - 1 ? ',' : ''}`;
    if (line.length + piece.length + 1 > MAX_LINE) {
      lines.push(line);
      line = `	${piece}`;
    } else {
      line += ` ${piece}`;
    }
  });
  lines.push(line);
  return lines.join(CRLF);
}

/** RFC 5322 date: toUTCString is the right shape but ends in GMT. */
function rfcDate(): string {
  return new Date().toUTCString().replace(/GMT$/, '+0000');
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'blast';
}

/** The draft as a single RFC 5322 message. */
export function buildEml({ subject, html, to = [], bcc = [], from }: EmlDraft): string {
  const headers = [
    // Outlook opens a message carrying this as a compose window, not as read mail.
    'X-Unsent: 1',
    `Date: ${rfcDate()}`,
  ];
  if (from) headers.push(`From: ${from}`);
  if (to.length) headers.push(foldAddresses('To', to));
  if (bcc.length) headers.push(foldAddresses('Bcc', bcc));
  headers.push(
    `Subject: ${encodeHeaderValue(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="utf-8"',
    // base64 throughout: the mailer's HTML carries lines far past the 998 limit.
    'Content-Transfer-Encoding: base64',
  );

  return `${headers.join(CRLF)}${CRLF}${CRLF}${wrapBase64(base64Utf8(html))}${CRLF}`;
}

/**
 * Hand the draft to the browser as a download. Opening it launches
 * Outlook with the blast composed. Returns false only if the browser
 * refused the download outright.
 */
export function downloadEmlDraft(draft: EmlDraft): boolean {
  try {
    const blob = new Blob([buildEml(draft)], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(draft.subject)}.eml`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke late: Safari reads the blob after the click returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 20000);
    return true;
  } catch {
    return false;
  }
}
