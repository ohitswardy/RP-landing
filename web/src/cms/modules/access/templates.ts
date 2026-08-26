/* ─────────────────────────────────────────────────────────────
   Outbound email bodies for portal-client onboarding. Nothing is
   sent from the system; an administrator copies the composed text
   into the mail client that carries the Regis signature.
   ───────────────────────────────────────────────────────────── */

export type TemplateKey = 'registration' | 'pending' | 'approved' | 'reset';

export type Placeholders = {
  CLIENT_NAME?: string;
  CLIENT_USERNAME?: string;
  CREATE_PASSWORD_LINK?: string;
  PORTAL_LINK?: string;
  TIMESTAMP?: string;
};

const SIGNOFF = `

Best regards,
Regis Partners Admin


***************************
Please DO NOT REPLY to this email. This mailbox is unattended.
[TIMESTAMP]`;

export const TEMPLATES: Record<TemplateKey, { label: string; note: string; body: string }> = {
  registration: {
    label: 'Registration invite',
    note: 'Sent the moment the account is provisioned. Carries the user id and the create-password link.',
    body: `Dear [CLIENT_NAME],

Please find below your login details to access Regis Partners Research.

Your User Id is: [CLIENT_USERNAME]

To complete your registration, you'll need to create a password. To do so, please click the link below:
[CREATE_PASSWORD_LINK]
${SIGNOFF}`,
  },

  pending: {
    label: 'Application received',
    note: 'Acknowledges a completed registration while the application is still under review.',
    body: `Dear [CLIENT_NAME],

Thank you for registering. We will review your application. If your sign-up is approved, you will receive an email with a username and create a password to access the Regis Partners Research.
${SIGNOFF}`,
  },

  approved: {
    label: 'Application approved',
    note: 'Confirms the account is live and points the client at the portal sign-in.',
    body: `Dear [CLIENT_NAME],

Your registration has been approved. You now have full access to Regis Partners Research.

Your User Id is: [CLIENT_USERNAME]

You may sign in here:
[PORTAL_LINK]
${SIGNOFF}`,
  },

  reset: {
    label: 'Password reset',
    note: 'Carries a single-use link that lets the client set a new password.',
    body: `Dear [CLIENT_NAME],

Please find below your login details to access Regis Partners Research.

Your User Id is: [CLIENT_USERNAME]

To reset your password, please click the link below:
[CREATE_PASSWORD_LINK]
${SIGNOFF}`,
  },
};

/** "25 Aug 2026, 12:04 AM PHT" — the stamp that closes every notice. */
export function stamp(date: Date = new Date()): string {
  const text = date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  });
  return `${text} PHT`;
}

/**
 * Substitute what is known and leave the rest as literal [PLACEHOLDER]
 * tokens, so the preview shows exactly what is still outstanding.
 */
export function fill(body: string, values: Placeholders): string {
  return body.replace(/\[([A-Z_]+)\]/g, (token, key: string) => {
    const value = values[key as keyof Placeholders];
    return value ? value : token;
  });
}

/** Split filled text into runs so unresolved placeholders can be marked. */
export function segments(text: string): Array<{ text: string; pending: boolean }> {
  const out: Array<{ text: string; pending: boolean }> = [];
  const re = /\[[A-Z_]+\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), pending: false });
    out.push({ text: m[0], pending: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), pending: false });
  return out;
}

/** Where an approved client signs in. */
export function portalUrl(): string {
  return `${window.location.origin}/login`;
}
