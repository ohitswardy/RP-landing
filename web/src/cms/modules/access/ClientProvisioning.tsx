import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '../../../lib/api';
import { BtnGhost, BtnPrimary, EASE } from '../../ui';
import { IconArrowRight, IconPlus } from '../../icons';
import type { Account, AuditEntry } from '../../data';
import { CopyButton, Detail, EmailPreview, LinkBox, Note, RuleField, StepHead, Tick } from './parts';
import { TEMPLATES, portalUrl, stamp } from './templates';

type Props = {
  onAccount: (a: Account) => void;
  onAudit: (e?: AuditEntry) => void;
};

type Issued = { item: Account; link: string; expiresAt: string };

const BLANK = { name: '', email: '', username: '', firm: '' };

/** "k.villaruel@arqcapital.ph" becomes "kvillaruel". */
function deriveUsername(email: string): string {
  const local = email.split('@')[0] ?? '';
  return local.replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 24);
}

export default function ClientProvisioning({ onAccount, onAudit }: Props) {
  const [form, setForm] = useState(BLANK);
  const [idTouched, setIdTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);

  // The user id tracks the email until an administrator overrides it.
  const username = idTouched ? form.username : deriveUsername(form.email);

  const values = useMemo(() => ({
    CLIENT_NAME: issued?.item.name || form.name.trim() || undefined,
    CLIENT_USERNAME: issued?.item.username || username || undefined,
    CREATE_PASSWORD_LINK: issued?.link,
    TIMESTAMP: stamp(),
  }), [issued, form.name, username]);

  async function provision() {
    if (!form.name.trim()) { setError('Give the client a full name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError('Enter a valid email address.'); return; }
    if (!form.firm.trim()) { setError('Name the institutional firm on the mandate.'); return; }
    if (!username) { setError('Give the client a user id.'); return; }

    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<Issued & { audit?: AuditEntry }>('/cms/portal-clients', {
        method: 'POST',
        audience: 'cms',
        body: {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          username,
          firm: form.firm.trim(),
        },
      });
      setIssued({ item: res.item, link: res.link, expiresAt: res.expiresAt });
      onAccount(res.item);
      onAudit(res.audit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The account could not be provisioned.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setForm(BLANK);
    setIdTouched(false);
    setIssued(null);
    setError(null);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-12">
      {/* ── Identity ─────────────────────────────────────────── */}
      <section className="space-y-7">
        <StepHead
          step="01"
          title="Client identity"
          note="Provisioning creates the account in an invited state and issues one create-password link. The client sets their own password on that page."
          done={Boolean(issued)}
        />

        {issued ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="space-y-7"
          >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-y rule py-6">
              <Detail label="Client" value={issued.item.name} />
              <Detail label="User id" value={issued.item.username} mono />
              <Detail label="Email" value={issued.item.email} mono />
              <Detail label="Firm" value={issued.item.firm} />
            </dl>

            <div className="flex flex-col gap-3 border-l-2 pl-4" style={{ borderColor: 'var(--color-amber)' }}>
              <p className="text-[12.5px] leading-relaxed text-graphite">
                The account is live in an invited state. It cannot sign in until the client completes registration and
                an administrator approves it under User creation approval.
              </p>
            </div>

            <BtnGhost onClick={reset}><IconPlus size={14} /> Provision another client</BtnGhost>
          </motion.div>
        ) : (
          <div className="space-y-7">
            <RuleField
              label="Full name"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="As it should read on the mandate"
            />
            <RuleField
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder="name@firm.com"
              hint="Where the registration email is sent. It becomes a sign-in identity and cannot change later."
            />
            <RuleField
              label="User id"
              mono
              value={username}
              onChange={(v) => { setIdTouched(true); setForm((f) => ({ ...f, username: v.replace(/[^A-Za-z0-9_-]/g, '').toLowerCase() })); }}
              placeholder="kvillaruel"
              hint={idTouched ? 'Letters, numbers, dashes, and underscores.' : 'Derived from the email address. Type to override.'}
            />
            <RuleField
              label="Institutional firm"
              value={form.firm}
              onChange={(v) => setForm((f) => ({ ...f, firm: v }))}
              placeholder="ARQ Capital"
              onEnter={() => void provision()}
            />

            {error && <Note tone="warn">{error}</Note>}

            <div className="flex items-center gap-4 pt-1">
              <BtnPrimary onClick={() => void provision()} disabled={busy}>
                {busy ? 'Provisioning…' : 'Provision and issue link'} <IconArrowRight size={14} />
              </BtnPrimary>
              <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-silver">Link valid 14 days</span>
            </div>
          </div>
        )}
      </section>

      {/* ── Outbound email ───────────────────────────────────── */}
      <section className="space-y-6">
        <StepHead
          step="02"
          title="Outbound email"
          note={TEMPLATES.registration.note}
          trailing={
            issued ? (
              <span className="mono inline-flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em]" style={{ color: 'var(--color-amber-deep)' }}>
                <Tick /> Ready
              </span>
            ) : undefined
          }
        />

        {issued && <LinkBox url={issued.link} expiresAt={issued.expiresAt} label="Create-password link" />}

        <EmailPreview
          title="Email / Registration"
          body={TEMPLATES.registration.body}
          values={values}
          disabled={!issued}
          hint={issued ? undefined : 'Fill the form and provision the account. The link is generated on save, and the email unlocks for copying.'}
        />

        {issued && (
          <div className="flex flex-wrap items-center gap-3">
            <CopyButton text={issued.item.email} label="Copy address" />
            <CopyButton text={portalUrl()} label="Copy portal address" />
          </div>
        )}
      </section>
    </div>
  );
}
