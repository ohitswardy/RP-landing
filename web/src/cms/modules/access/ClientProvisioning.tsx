import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '../../../lib/api';
import { useCms } from '../../store';
import { BtnGhost, BtnPrimary, Switch, EASE } from '../../ui';
import { IconArrowRight, IconPlus, IconX } from '../../icons';
import { REPORT_CATEGORIES, type Account, type AuditEntry } from '../../data';
import { CopyButton, Detail, EmailPreview, LinkBox, Note, RuleField, Segmented, StepHead, Tick } from './parts';
import { TEMPLATES, portalUrl, stamp } from './templates';

type Props = {
  onAccount: (a: Account) => void;
  onAudit: (e?: AuditEntry) => void;
};

type Issued = { item: Account; link?: string; expiresAt?: string };

const BLANK = {
  name: '', email: '', username: '', firm: '',
  clientType: 'Local' as 'Local' | 'Foreign',
  sectorPrefs: [] as string[],
  preferredAnalysts: [] as string[],
  direct: false,
  password: '',
};

/** "k.villaruel@arqcapital.ph" becomes "kvillaruel". */
function deriveUsername(email: string): string {
  const local = email.split('@')[0] ?? '';
  return local.replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 24);
}

export default function ClientProvisioning({ onAccount, onAudit }: Props) {
  const { people, reports } = useCms();
  const [form, setForm] = useState(BLANK);
  const [idTouched, setIdTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [analystDraft, setAnalystDraft] = useState('');

  // The user id tracks the email until an administrator overrides it.
  const username = idTouched ? form.username : deriveUsername(form.email);

  /** Names offered as preference chips: every byline the catalog actually
      carries, plus the research desk, plus anything free-typed. The portal
      matches these strings against report bylines, so the published ones
      come first. */
  const analystPool = useMemo(() => {
    const bylines = reports.map((r) => r.analyst).filter(Boolean);
    const names = people.filter((p) => p.team === 'Research').map((p) => p.name);
    return [...new Set([...bylines, ...names, ...form.preferredAnalysts])].sort((a, b) => a.localeCompare(b));
  }, [reports, people, form.preferredAnalysts]);

  const values = useMemo(() => ({
    CLIENT_NAME: issued?.item.name || form.name.trim() || undefined,
    CLIENT_USERNAME: issued?.item.username || username || undefined,
    CREATE_PASSWORD_LINK: issued?.link,
    TIMESTAMP: stamp(),
  }), [issued, form.name, username]);

  const toggleSector = (s: string) => setForm((f) => ({
    ...f,
    sectorPrefs: f.sectorPrefs.includes(s) ? f.sectorPrefs.filter((x) => x !== s) : [...f.sectorPrefs, s],
  }));

  const toggleAnalyst = (n: string) => setForm((f) => ({
    ...f,
    preferredAnalysts: f.preferredAnalysts.includes(n) ? f.preferredAnalysts.filter((x) => x !== n) : [...f.preferredAnalysts, n],
  }));

  const addAnalyst = () => {
    const n = analystDraft.trim();
    if (!n) return;
    setForm((f) => ({
      ...f,
      preferredAnalysts: f.preferredAnalysts.includes(n) ? f.preferredAnalysts : [...f.preferredAnalysts, n],
    }));
    setAnalystDraft('');
  };

  async function provision() {
    if (!form.name.trim()) { setError('Give the client a full name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError('Enter a valid email address.'); return; }
    if (!form.firm.trim()) { setError('Name the institutional firm on the mandate.'); return; }
    if (!username) { setError('Give the client a user id.'); return; }
    if (form.direct && form.password.length < 8) { setError('Direct accounts need a password of at least 8 characters.'); return; }

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
          clientType: form.clientType,
          sectorPrefs: form.sectorPrefs,
          preferredAnalysts: form.preferredAnalysts,
          ...(form.direct ? { password: form.password } : {}),
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
    setAnalystDraft('');
  }

  const direct = Boolean(issued && !issued.link);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-12">
      {/* ── Identity ─────────────────────────────────────────── */}
      <section className="space-y-7">
        <StepHead
          step="01"
          title="Client identity"
          note="Provision an invited account with a create-password link, or set a password here and the account goes live approved — no link, no waiting."
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
              <Detail label="Client type" value={issued.item.clientType ?? 'Not set'} />
              <Detail
                label="Preferences"
                value={[
                  issued.item.sectorPrefs.length ? `${issued.item.sectorPrefs.length} sector${issued.item.sectorPrefs.length === 1 ? '' : 's'}` : null,
                  issued.item.preferredAnalysts.length ? `${issued.item.preferredAnalysts.length} analyst${issued.item.preferredAnalysts.length === 1 ? '' : 's'}` : null,
                ].filter(Boolean).join(' · ') || 'None recorded'}
              />
            </dl>

            <div className="flex flex-col gap-3 border-l-2 pl-4" style={{ borderColor: 'var(--color-amber)' }}>
              <p className="text-[12.5px] leading-relaxed text-graphite">
                {direct
                  ? 'The account is live and approved. The client can sign in with their user id or email and the password you set.'
                  : 'The account is live in an invited state. It cannot sign in until the client completes registration and an administrator approves it under User creation approval.'}
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
            />

            <div className="space-y-2.5">
              <span className="mono block text-[10px] uppercase tracking-[0.18em] text-graphite">Client type</span>
              <Segmented
                options={[{ value: 'Local', label: 'Local' }, { value: 'Foreign', label: 'Foreign' }]}
                value={form.clientType}
                onChange={(v) => setForm((f) => ({ ...f, clientType: v }))}
              />
              <p className="text-[11.5px] leading-relaxed text-graphite">
                Local clients receive portal links when reports are blasted; foreign clients are emailed Jefferies links.
              </p>
            </div>

            <div className="space-y-2.5">
              <span className="mono block text-[10px] uppercase tracking-[0.18em] text-graphite">
                Preferred sectors
                {form.sectorPrefs.length > 0 && <span className="num ml-2 opacity-60">{form.sectorPrefs.length}</span>}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {REPORT_CATEGORIES.map((s) => {
                  const on = form.sectorPrefs.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSector(s)}
                      aria-pressed={on}
                      className={`mono border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em] transition-colors duration-200 active:translate-y-px ${
                        on ? 'border-navy bg-navy text-paper' : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11.5px] leading-relaxed text-graphite">
                Report blasts in these sectors queue this client automatically in the Email desk.
              </p>
            </div>

            <div className="space-y-2.5">
              <span className="mono block text-[10px] uppercase tracking-[0.18em] text-graphite">
                Preferred analysts
                {form.preferredAnalysts.length > 0 && <span className="num ml-2 opacity-60">{form.preferredAnalysts.length}</span>}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {analystPool.map((n) => {
                  const on = form.preferredAnalysts.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleAnalyst(n)}
                      aria-pressed={on}
                      className={`mono border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em] transition-colors duration-200 active:translate-y-px ${
                        on ? 'border-navy bg-navy text-paper' : 'rule text-graphite hover:border-[color:var(--color-amber-deep)] hover:text-ink'
                      }`}
                    >
                      {on && <IconX size={9} className="mr-1.5 inline" />}
                      {n}
                    </button>
                  );
                })}
                <input
                  value={analystDraft}
                  onChange={(e) => setAnalystDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAnalyst(); } }}
                  onBlur={addAnalyst}
                  placeholder="Other analyst…"
                  className="mono w-[130px] border rule bg-white px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em] text-ink outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
                />
              </div>
              <p className="text-[11.5px] leading-relaxed text-graphite">
                Names match report bylines. These preferences also scope what the client sees in the portal.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 border rule bg-white px-4 py-3.5">
              <div className="min-w-0">
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Set password now &amp; approve</div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate">
                  Skip the invite link and the approval queue — the account goes live immediately with the password you set.
                </p>
              </div>
              <div className="pt-0.5">
                <Switch on={form.direct} onToggle={() => setForm((f) => ({ ...f, direct: !f.direct }))} label="Set password now and approve" />
              </div>
            </div>

            {form.direct && (
              <RuleField
                label="Password"
                type="password"
                value={form.password}
                onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                placeholder="At least 8 characters"
                hint="Hand this to the client through a channel you trust. They can change it later via a reset link."
                onEnter={() => void provision()}
              />
            )}

            {error && <Note tone="warn">{error}</Note>}

            <div className="flex items-center gap-4 pt-1">
              <BtnPrimary onClick={() => void provision()} disabled={busy}>
                {busy ? 'Provisioning…' : form.direct ? 'Create live account' : 'Provision and issue link'} <IconArrowRight size={14} />
              </BtnPrimary>
              {!form.direct && <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-silver">Link valid 14 days</span>}
            </div>
          </div>
        )}
      </section>

      {/* ── Outbound email ───────────────────────────────────── */}
      <section className="space-y-6">
        <StepHead
          step="02"
          title="Outbound email"
          note={direct ? 'No registration email is needed — the account is already live and approved.' : TEMPLATES.registration.note}
          trailing={
            issued ? (
              <span className="mono inline-flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em]" style={{ color: 'var(--color-amber-deep)' }}>
                <Tick /> {direct ? 'Live' : 'Ready'}
              </span>
            ) : undefined
          }
        />

        {direct ? (
          <div className="flex flex-col gap-3 border-l-2 pl-4" style={{ borderColor: 'var(--color-amber)' }}>
            <p className="text-[12.5px] leading-relaxed text-graphite">
              Account live and approved. Share the portal address and the password with the client directly.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <CopyButton text={issued!.item.email} label="Copy address" />
              <CopyButton text={portalUrl()} label="Copy portal address" />
            </div>
          </div>
        ) : (
          <>
            {issued?.link && issued.expiresAt && <LinkBox url={issued.link} expiresAt={issued.expiresAt} label="Create-password link" />}

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
          </>
        )}
      </section>
    </div>
  );
}
