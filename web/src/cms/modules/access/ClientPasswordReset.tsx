import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch } from '../../../lib/api';
import { BtnGhost, BtnPrimary, Chip, EASE } from '../../ui';
import { IconSearch } from '../../icons';
import { CLIENT_STATUS, fmtDate, type Account, type AuditEntry } from '../../data';
import { Detail, EmailPreview, LinkBox, Note, PasswordField, PickPrompt, StepHead } from './parts';
import { TEMPLATES, stamp } from './templates';

type Props = {
  clients: Account[];
  onAccount: (a: Account) => void;
  onAudit: (e?: AuditEntry) => void;
};

export default function ClientPasswordReset({ clients, onAccount, onAudit }: Props) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ link: string; expiresAt: string } | null>(null);
  const [busyLink, setBusyLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [busyPwd, setBusyPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdDone, setPwdDone] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .filter((c) => !q
        || c.name.toLowerCase().includes(q)
        || c.email.toLowerCase().includes(q)
        || (c.username ?? '').toLowerCase().includes(q)
        || (c.firm ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, query]);

  const selected = useMemo(() => clients.find((c) => c.id === selectedId) ?? null, [clients, selectedId]);

  function pick(id: string) {
    setSelectedId(id);
    setIssued(null);
    setLinkError(null);
    setPwd('');
    setPwd2('');
    setPwdError(null);
    setPwdDone(false);
  }

  async function issueLink() {
    if (!selected) return;
    setBusyLink(true);
    setLinkError(null);
    try {
      const res = await apiFetch<{ item: Account; link: string; expiresAt: string; audit?: AuditEntry }>(
        `/cms/portal-clients/${selected.id}/reset-link`,
        { method: 'POST', audience: 'cms' },
      );
      setIssued({ link: res.link, expiresAt: res.expiresAt });
      onAccount(res.item);
      onAudit(res.audit);
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'The link could not be issued.');
    } finally {
      setBusyLink(false);
    }
  }

  async function setPassword() {
    if (!selected) return;
    if (pwd.length < 8) { setPwdError('Passwords are at least 8 characters.'); return; }
    if (pwd !== pwd2) { setPwdError('The two passwords do not match.'); return; }

    setBusyPwd(true);
    setPwdError(null);
    try {
      const res = await apiFetch<{ item: Account; audit?: AuditEntry }>(
        `/cms/portal-clients/${selected.id}/password`,
        { method: 'PUT', audience: 'cms', body: { password: pwd } },
      );
      onAccount(res.item);
      onAudit(res.audit);
      setPwd('');
      setPwd2('');
      setPwdDone(true);
    } catch (e) {
      setPwdError(e instanceof Error ? e.message : 'The password could not be changed.');
    } finally {
      setBusyPwd(false);
    }
  }

  const values = {
    CLIENT_NAME: selected?.name,
    CLIENT_USERNAME: selected?.username ?? undefined,
    CREATE_PASSWORD_LINK: issued?.link,
    TIMESTAMP: stamp(),
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
      {/* ── Account ──────────────────────────────────────────── */}
      <section className="space-y-6">
        <StepHead
          step="01"
          title="Choose the account"
          note="Password resets apply to portal clients. Staff passwords are changed from the account ledger."
        />

        <label className="relative block">
          <span className="sr-only">Search portal clients</span>
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, user id, email, firm…"
            className="w-full border rule bg-white py-2.5 pl-9 pr-3 text-[13.5px] outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
          />
        </label>

        {rows.length === 0 ? (
          <p className="border-y rule py-10 text-[13px] leading-relaxed text-graphite">
            {query ? 'No client matches that search.' : 'No portal clients yet.'}
          </p>
        ) : (
          <ul className="max-h-[440px] divide-y rule overflow-y-auto border-y rule">
            {rows.map((c) => {
              const on = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pick(c.id)}
                    aria-current={on}
                    className={`group relative flex w-full items-center gap-4 py-3.5 pl-4 pr-2 text-left transition-colors duration-300 hover:bg-white ${on ? 'bg-white' : ''}`}
                  >
                    <span
                      aria-hidden
                      className={`absolute left-0 top-0 h-full w-[2px] origin-top transition-transform duration-300 ${on ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'}`}
                      style={{ background: 'var(--color-amber)' }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[14px] ${on ? 'text-ink' : 'text-slate'}`}>{c.name}</span>
                      <span className="mono block truncate text-[11px] tracking-[0.04em] text-graphite">
                        {c.username ?? c.email}
                      </span>
                    </span>
                    {c.status !== 'approved' && (
                      <Chip tone={CLIENT_STATUS[c.status].tone}>{CLIENT_STATUS[c.status].label}</Chip>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Reset ────────────────────────────────────────────── */}
      <section className="space-y-6">
        {!selected ? (
          <>
            <StepHead step="02" title="Reset" note="Pick a client to issue a reset link or set a password directly." />
            <PickPrompt
              title="No client selected."
              hint="Choose an account on the left. You can send a single-use reset link, or set a password yourself when the client cannot use one."
            />
          </>
        ) : (
          <>
            <StepHead
              step="02"
              title="Reset"
              note="A reset link lets the client choose their own password. Setting one directly signs them out of every device."
              trailing={<Chip tone={CLIENT_STATUS[selected.status].tone}>{CLIENT_STATUS[selected.status].label}</Chip>}
            />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-b rule pb-6">
              <Detail label="Client" value={selected.name} />
              <Detail label="User id" value={selected.username} mono />
              <Detail label="Email" value={selected.email} mono />
              <Detail label="Last active" value={selected.lastActive ? fmtDate(selected.lastActive) : null} />
            </dl>

            {/* Route A: link */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="mono text-[9.5px] uppercase tracking-[0.22em] text-graphite">Route A / Send a reset link</span>
                <BtnGhost onClick={() => void issueLink()}>
                  {busyLink ? 'Issuing…' : issued ? 'Issue a new link' : 'Issue reset link'}
                </BtnGhost>
              </div>
              {linkError && <Note tone="warn">{linkError}</Note>}
              {issued && <LinkBox url={issued.link} expiresAt={issued.expiresAt} label="Password reset link" />}
              <EmailPreview
                title="Email / Password reset"
                body={TEMPLATES.reset.body}
                values={values}
                disabled={!issued}
                hint={issued ? undefined : 'Issue a reset link to fill the address in this email and unlock copying.'}
              />
            </div>

            {/* Route B: direct */}
            <div className="space-y-5 border-t rule pt-6">
              <div>
                <span className="mono text-[9.5px] uppercase tracking-[0.22em] text-graphite">Route B / Set a password directly</span>
                <p className="mt-2 max-w-[56ch] text-[12.5px] leading-relaxed text-graphite">
                  Use this only when the client cannot open a link. Hand the password over on a call, never by email, and
                  ask them to change it once they are in.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <PasswordField
                  label="New password"
                  value={pwd}
                  onChange={(v) => { setPwd(v); setPwdDone(false); }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
                <PasswordField
                  label="Confirm password"
                  value={pwd2}
                  onChange={(v) => { setPwd2(v); setPwdDone(false); }}
                  placeholder="Repeat it"
                  autoComplete="new-password"
                  onEnter={() => void setPassword()}
                />
              </div>

              {pwdError && <Note tone="warn">{pwdError}</Note>}

              <AnimatePresence initial={false}>
                {pwdDone && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                  >
                    <Note tone="ok">
                      Password changed for {selected.name}. Every open portal session for this account was signed out.
                    </Note>
                  </motion.div>
                )}
              </AnimatePresence>

              <BtnPrimary onClick={() => void setPassword()} disabled={busyPwd}>
                {busyPwd ? 'Changing…' : 'Change password'}
              </BtnPrimary>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
