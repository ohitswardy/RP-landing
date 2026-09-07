import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { BtnGhost, Chip, SkeletonRows, useConfirm, type ChipTone } from '../../../cms/ui';
import { useCrms } from '../../store';
import { SectionRule } from '../../kit/fields';
import { errorText, useToast } from '../../kit/toast';
import { timeAgo, type AuditEntry, type ClientContact, type PortalAccount, type PortalLink } from '../../data';

/* ─────────────────────────────────────────────────────────────
   The portal bridge on a client contact (§7.6). Resolved live
   from the CMS every time it opens: the linked account with any
   field mismatches flagged, the account's evidenced consumption
   from the hash-chained ledger, and — when unlinked — suggested
   accounts by exact email then by firm. Link/unlink only; the
   CMS owns the account itself.
   ───────────────────────────────────────────────────────────── */

const STATUS: Record<string, { label: string; tone: ChipTone }> = {
  invited: { label: 'Invited', tone: 'muted' },
  pending: { label: 'Awaiting approval', tone: 'amber' },
  approved: { label: 'Approved', tone: 'live' },
  declined: { label: 'Declined', tone: 'warn' },
};

const EVENT_LABEL: Record<string, string> = { view: 'Viewed', download: 'Downloaded', click: 'Opened' };

type LinkResponse = { item: ClientContact; portal: PortalLink; audit?: AuditEntry };

export default function PortalAccountPanel({ contact }: { contact: ClientContact }) {
  const { put, appendAudit } = useCrms();
  const { notify } = useToast();
  const [data, setData] = useState<PortalLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, confirm] = useConfirm();

  const load = useCallback(() => {
    setError(null);
    return apiFetch<PortalLink>(`/crms/client-contacts/${contact.id}/portal`, { audience: 'cms' })
      .then(setData)
      .catch((e) => setError(errorText(e, 'The portal account could not be resolved.')));
  }, [contact.id]);

  useEffect(() => { void load(); }, [load]);

  async function setLink(portalUserId: string | null) {
    setBusy(true);
    try {
      const res = await apiFetch<LinkResponse>(`/crms/client-contacts/${contact.id}/portal`, { method: 'POST', audience: 'cms', body: { portalUserId: portalUserId ? Number(portalUserId) : null } });
      put('clientContacts', res.item);
      appendAudit(res.audit);
      setData(res.portal);
      notify(portalUserId ? 'Portal account linked.' : 'Portal account unlinked.');
    } catch (e) {
      notify(errorText(e, 'The link could not be changed.'), 'warn');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5">
      <SectionRule code="Portal account · §7.6" title="Portal bridge" actions={
        data?.state === 'linked' && (
          <BtnGhost danger disabled={busy} onClick={() => confirm('unlink', () => { void setLink(null); })}>{armed === 'unlink' ? 'Confirm unlink' : 'Unlink'}</BtnGhost>
        )
      } />

      {error && <p className="text-[12.5px]" style={{ color: 'var(--color-warn)' }}>{error}</p>}
      {!data && !error && <SkeletonRows rows={3} />}

      {data?.state === 'missing' && (
        <div className="border-l-2 pl-4" style={{ borderColor: 'var(--color-warn)' }}>
          <p className="text-[13.5px] text-ink">Account no longer exists.</p>
          <p className="mt-1 text-[12.5px] text-graphite">The linked portal account was removed in the CMS. Unlink to clear the reference, or pick a replacement below.</p>
          <div className="mt-3"><BtnGhost onClick={() => void setLink(null)} disabled={busy}>Clear link</BtnGhost></div>
        </div>
      )}

      {data?.state === 'linked' && data.account && <AccountCard account={data.account} mismatches={data.mismatches} />}

      {data && data.state !== 'linked' && (
        <div className="space-y-3">
          <p className="text-[13px] text-graphite">
            {data.state === 'unlinked' ? 'No portal account is linked to this contact.' : 'Pick a replacement account.'}
            {' '}Suggestions match by exact email first, then by firm name.
          </p>
          {data.suggestions.length === 0 ? (
            <p className="border rule border-dashed px-4 py-4 text-[12.5px] text-graphite">
              No matching portal account. If this person should read research on the portal, provision them in{' '}
              <a href="/cms/access" target="_blank" rel="noreferrer" className="text-ink underline-offset-4 hover:underline">CMS → Users &amp; access</a>, then link here.
            </p>
          ) : (
            <ul className="divide-y rule border-y rule">
              {data.suggestions.map((s) => {
                const exact = contact.email && s.email.toLowerCase() === contact.email.toLowerCase();
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] text-ink">{s.name} <span className="mono ml-1 text-[10px] uppercase tracking-[0.12em] text-silver">{s.username ?? ''}</span></p>
                      <p className="truncate text-[12px] text-graphite">{s.email} · {s.firm ?? 'firm not set'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {exact && <Chip tone="live">Email match</Chip>}
                      <BtnGhost onClick={() => void setLink(s.id)} disabled={busy}>Link</BtnGhost>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {data?.state === 'linked' && (
        <div className="space-y-3 pt-2">
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-graphite">Consumption · evidenced portal reads</p>
          {data.consumption.length === 0 ? <p className="text-[13px] text-graphite">No portal activity recorded for this account yet.</p> : (
            <ul className="max-h-[300px] divide-y rule overflow-y-auto border-y rule">
              {data.consumption.map((c) => (
                <li key={c.id} className="grid grid-cols-12 gap-2 py-2.5 text-[12.5px]">
                  <span className="mono col-span-3 text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-amber-deep)]">{EVENT_LABEL[c.event] ?? c.event}</span>
                  <span className="col-span-6 truncate text-slate">{c.target}</span>
                  <span className="mono col-span-3 text-right text-[10px] uppercase tracking-[0.12em] text-silver">{timeAgo(c.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function AccountCard({ account, mismatches }: { account: PortalAccount; mismatches: PortalLink['mismatches'] }) {
  const st = account.status ? STATUS[account.status] : null;
  const flagged = new Set(mismatches.map((m) => m.field));
  const row = (label: string, value: string | null, field?: string) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-graphite">{label}</span>
      <span className={`truncate text-right text-[13px] ${field && flagged.has(field) ? 'text-[color:var(--color-amber-deep)]' : 'text-ink'}`}>{value ?? <span className="text-silver">—</span>}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {account.suspended ? <Chip tone="warn">Suspended</Chip> : st && <Chip tone={st.tone}>{st.label}</Chip>}
        {account.clientType && <Chip tone={account.clientType === 'Local' ? 'live' : 'amber'}>{account.clientType}</Chip>}
        {account.lastActive && <span className="mono text-[10px] uppercase tracking-[0.14em] text-silver">Last sign-in {timeAgo(account.lastActive)}</span>}
      </div>
      <div className="divide-y rule border-y rule">
        {row('Sign-in id', account.username)}
        {row('Email', account.email, 'email')}
        {row('Phone', account.phone, 'phone')}
        {row('Position', account.position, 'position')}
        {row('Firm', account.firm, 'firm')}
      </div>
      {mismatches.length > 0 && (
        <div className="border-l-2 pl-3" style={{ borderColor: 'var(--color-amber)' }}>
          <p className="text-[12.5px] text-ink">{mismatches.length} field{mismatches.length === 1 ? ' differs' : 's differ'} between the CRMS record and the portal account.</p>
          <ul className="mt-1.5 space-y-1 text-[12px] text-graphite">
            {mismatches.map((m) => <li key={m.field}><span className="mono uppercase tracking-[0.1em]">{m.field}</span> · CRMS “{m.crms}” vs portal “{m.portal}”</li>)}
          </ul>
          <p className="mt-2 text-[12px] text-silver">Nothing is overwritten. Fix the portal side in <a href="/cms/access" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">CMS → Users &amp; access</a>.</p>
        </div>
      )}
      <div>
        <p className="mono mb-2 text-[9.5px] uppercase tracking-[0.16em] text-graphite">Provisioned to read</p>
        <div className="flex flex-wrap gap-1.5">
          {account.sectorPrefs.length === 0 && account.preferredAnalysts.length === 0 && <span className="text-[12.5px] text-silver">Whole catalogue — no restriction set</span>}
          {account.sectorPrefs.map((s) => <span key={s} className="border rule bg-paper px-2 py-0.5 text-[12px] text-slate">{s}</span>)}
          {account.preferredAnalysts.map((a) => <span key={a} className="border rule bg-bone px-2 py-0.5 text-[12px] text-slate">{a}</span>)}
        </div>
      </div>
    </div>
  );
}
