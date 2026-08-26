import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch } from '../../../lib/api';
import { BtnGhost, BtnPrimary, Chip, EASE } from '../../ui';
import { IconCheck, IconX } from '../../icons';
import { CLIENT_STATUS, fmtDate, timeAgo, type Account, type AuditEntry } from '../../data';
import { Detail, EmailPreview, LinkBox, Note, PickPrompt, Segmented, StepHead } from './parts';
import { TEMPLATES, portalUrl, stamp, type TemplateKey } from './templates';

type Props = {
  clients: Account[];
  onAccount: (a: Account) => void;
  onAudit: (e?: AuditEntry) => void;
};

type Queue = 'pending' | 'invited' | 'declined';

const QUEUE_EMPTY: Record<Queue, string> = {
  pending: 'No applications are waiting. Completed registrations land here for review.',
  invited: 'Nobody is mid-invite. Provisioned clients sit here until they finish registering.',
  declined: 'No declined applications.',
};

export default function ClientApprovals({ clients, onAccount, onAudit }: Props) {
  const [queue, setQueue] = useState<Queue>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reissued, setReissued] = useState<{ link: string; expiresAt: string } | null>(null);
  const [template, setTemplate] = useState<TemplateKey | null>(null);
  // Set after a decision so the row stays on screen with its follow-up email
  // even though it has just left the queue it was filed under.
  const [pinned, setPinned] = useState(false);

  const counts = useMemo(() => ({
    pending: clients.filter((c) => c.status === 'pending').length,
    invited: clients.filter((c) => c.status === 'invited').length,
    declined: clients.filter((c) => c.status === 'declined').length,
  }), [clients]);

  const rows = useMemo(
    () => clients
      .filter((c) => c.status === queue)
      .sort((a, b) => (b.registeredAt ?? b.createdAt).localeCompare(a.registeredAt ?? a.createdAt)),
    [clients, queue],
  );

  // The selection is resolved against every client, so a row that has just
  // been approved stays on screen with its follow-up email ready.
  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) ?? null,
    [clients, selectedId],
  );

  // Land on the first application in the queue rather than an empty panel.
  useEffect(() => {
    if (pinned) return;
    if (selected && selected.status === queue) return;
    setSelectedId(rows[0]?.id ?? null);
    setReissued(null);
    setTemplate(null);
    // Re-running on `selected` would fight the click that changes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, rows.length, pinned]);

  function pick(id: string) {
    setSelectedId(id);
    setPinned(false);
    setReissued(null);
    setTemplate(null);
    setError(null);
  }

  const activeTemplate: TemplateKey = template
    ?? (selected?.status === 'approved' ? 'approved' : selected?.status === 'invited' ? 'registration' : 'pending');

  const values = {
    CLIENT_NAME: selected?.name,
    CLIENT_USERNAME: selected?.username ?? undefined,
    CREATE_PASSWORD_LINK: reissued?.link,
    PORTAL_LINK: portalUrl(),
    TIMESTAMP: stamp(),
  };

  async function act(path: string, method: 'POST' = 'POST') {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ item: Account; link?: string; expiresAt?: string; audit?: AuditEntry }>(
        `/cms/portal-clients/${selected.id}/${path}`,
        { method, audience: 'cms' },
      );
      onAccount(res.item);
      onAudit(res.audit);
      setPinned(true);
      if (res.link && res.expiresAt) setReissued({ link: res.link, expiresAt: res.expiresAt });
      if (path === 'approve') setTemplate('approved');
      if (path === 'decline') setTemplate(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The request was rejected.');
    } finally {
      setBusy(false);
    }
  }

  const templateOptions = selected?.status === 'invited'
    ? [{ value: 'registration' as TemplateKey, label: 'Registration invite' }]
    : [
        { value: 'pending' as TemplateKey, label: 'Application received' },
        { value: 'approved' as TemplateKey, label: 'Application approved' },
      ];

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
      {/* ── Queue ────────────────────────────────────────────── */}
      <section className="space-y-6">
        <StepHead
          step="01"
          title="Approval queue"
          note="Registrations completed by clients, waiting on a decision. Approving unlocks portal sign-in immediately."
        />

        <Segmented
          value={queue}
          onChange={(v) => { setQueue(v); setPinned(false); }}
          options={[
            { value: 'pending', label: 'Awaiting', count: counts.pending },
            { value: 'invited', label: 'Invited', count: counts.invited },
            { value: 'declined', label: 'Declined', count: counts.declined },
          ]}
        />

        {rows.length === 0 ? (
          <p className="border-y rule py-10 text-[13px] leading-relaxed text-graphite">{QUEUE_EMPTY[queue]}</p>
        ) : (
          <ul className="divide-y rule border-y rule">
            <AnimatePresence initial={false}>
              {rows.map((c, i) => {
                const on = c.id === selectedId;
                return (
                  <motion.li
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: Math.min(i * 0.04, 0.24) } }}
                    exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}
                  >
                    <button
                      type="button"
                      onClick={() => pick(c.id)}
                      aria-current={on}
                      className={`group relative flex w-full items-center gap-4 py-4 pl-4 pr-1 text-left transition-colors duration-300 hover:bg-white ${on ? 'bg-white' : ''}`}
                    >
                      <span
                        aria-hidden
                        className={`absolute left-0 top-0 h-full w-[2px] origin-top transition-transform duration-300 ${on ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'}`}
                        style={{ background: 'var(--color-amber)' }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[14px] ${on ? 'text-ink' : 'text-slate'}`}>{c.name}</span>
                        <span className="mono block truncate text-[11px] tracking-[0.04em] text-graphite">{c.firm}</span>
                      </span>
                      <span className="mono num shrink-0 text-[10.5px] uppercase tracking-[0.1em] text-graphite">
                        {c.registeredAt ? timeAgo(c.registeredAt) : 'Not started'}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {/* ── Decision ─────────────────────────────────────────── */}
      <section className="space-y-6">
        {!selected ? (
          <>
            <StepHead step="02" title="Application" note="Pick an application to review what the client submitted." />
            <PickPrompt
              title="Nothing selected."
              hint="Choose an application from the queue to see the details they submitted and the email that answers it."
            />
          </>
        ) : (
          <>
            <StepHead
              step="02"
              title="Application"
              note={`Submitted ${selected.registeredAt ? fmtDate(selected.registeredAt) : 'not yet'}.`}
              done={selected.status === 'approved'}
              trailing={<Chip tone={CLIENT_STATUS[selected.status].tone}>{CLIENT_STATUS[selected.status].label}</Chip>}
            />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-b rule pb-6">
              <Detail label="Client" value={selected.name} />
              <Detail label="User id" value={selected.username} mono />
              <Detail label="Email" value={selected.email} mono />
              <Detail label="Firm" value={selected.firm} />
              <Detail label="Position" value={selected.position} />
              <Detail label="Telephone" value={selected.phone} mono />
            </dl>

            {error && <Note tone="warn">{error}</Note>}

            {/* Actions by state */}
            <div className="flex flex-wrap items-center gap-3">
              {selected.status === 'pending' && (
                <>
                  <BtnPrimary onClick={() => void act('approve')} disabled={busy}>
                    <IconCheck size={14} /> {busy ? 'Working…' : 'Approve account'}
                  </BtnPrimary>
                  <BtnGhost danger onClick={() => void act('decline')}>
                    <IconX size={14} /> Decline
                  </BtnGhost>
                </>
              )}
              {selected.status === 'invited' && (
                <>
                  <BtnPrimary onClick={() => void act('invite-link')} disabled={busy}>
                    {busy ? 'Issuing…' : 'Re-issue registration link'}
                  </BtnPrimary>
                  <span className="text-[12.5px] leading-relaxed text-graphite">
                    This client has not completed registration yet.
                  </span>
                </>
              )}
              {selected.status === 'declined' && (
                <>
                  <BtnGhost onClick={() => void act('invite-link')}>Re-issue registration link</BtnGhost>
                  <BtnPrimary onClick={() => void act('approve')} disabled={busy}>
                    <IconCheck size={14} /> Approve anyway
                  </BtnPrimary>
                </>
              )}
              {selected.status === 'approved' && (
                <span className="mono text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--color-amber-deep)' }}>
                  Approved {selected.approvedAt ? fmtDate(selected.approvedAt) : ''}
                </span>
              )}
            </div>

            {reissued && <LinkBox url={reissued.link} expiresAt={reissued.expiresAt} label="Create-password link" />}

            {/* Follow-up email */}
            <div className="space-y-4 border-t rule pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="mono text-[9.5px] uppercase tracking-[0.22em] text-graphite">Reply to the client</span>
                {templateOptions.length > 1 && (
                  <Segmented value={activeTemplate} onChange={(v) => setTemplate(v)} options={templateOptions} />
                )}
              </div>
              <p className="text-[12.5px] leading-relaxed text-graphite">{TEMPLATES[activeTemplate].note}</p>
              <EmailPreview
                title={`Email / ${TEMPLATES[activeTemplate].label}`}
                body={TEMPLATES[activeTemplate].body}
                values={values}
                hint={
                  activeTemplate === 'registration' && !reissued
                    ? 'Re-issue the registration link to fill the address in this email.'
                    : undefined
                }
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
