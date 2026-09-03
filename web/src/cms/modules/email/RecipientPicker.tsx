import { useMemo, useState } from 'react';
import { Chip } from '../../ui';
import { TinyBtn } from '../../kit/parts';
import { IconPlus, IconSearch, IconX } from '../../icons';
import type { AudienceClient, AudienceSubscriber, DistributionList, EmailRecipient } from '../../data';

/* ─────────────────────────────────────────────────────────────
   Who a blast goes to. One deduplicated list fed from several
   directions: a client search (preference chips visible, so
   pruning an auto-matched list is informed), one-click pools
   (Local clients, Foreign clients, verified subscribers), saved
   distribution lists, and manually typed addresses.
   ───────────────────────────────────────────────────────────── */

export function clientRecipient(c: AudienceClient): EmailRecipient {
  return { email: c.email.toLowerCase(), name: c.name, userId: c.id, source: 'client' };
}

type QuickAdd = { key: string; label: string; items: EmailRecipient[] };

/** What a pool would add — only the addresses not already on the list, deduplicated. */
function notYetOn(selected: Set<string>, items: EmailRecipient[]): EmailRecipient[] {
  const seen = new Set(selected);
  return items.filter((r) => {
    const e = r.email.toLowerCase();
    if (seen.has(e)) return false;
    seen.add(e);
    return true;
  });
}

export default function RecipientPicker({
  clients, subscribers, lists = [], value, onChange, label = 'Recipients', hint,
}: {
  clients: AudienceClient[];
  subscribers: AudienceSubscriber[];
  lists?: DistributionList[];
  value: EmailRecipient[];
  onChange: (next: EmailRecipient[]) => void;
  label?: string;
  hint?: string;
}) {
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const selected = useMemo(() => new Set(value.map((r) => r.email.toLowerCase())), [value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return clients
      .filter((c) => !selected.has(c.email.toLowerCase()))
      .filter((c) =>
        c.name.toLowerCase().includes(q)
        || c.email.toLowerCase().includes(q)
        || (c.firm ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [clients, query, selected]);

  const pools = useMemo<QuickAdd[]>(() => [
    { key: 'local', label: 'Local clients', items: notYetOn(selected, clients.filter((c) => c.clientType === 'Local').map(clientRecipient)) },
    { key: 'foreign', label: 'Foreign clients', items: notYetOn(selected, clients.filter((c) => c.clientType === 'Foreign').map(clientRecipient)) },
    { key: 'subscribers', label: 'Verified subscribers', items: notYetOn(selected, subscribers.map((s) => ({ email: s.email.toLowerCase(), source: 'subscriber' as const }))) },
  ], [clients, subscribers, selected]);

  const listPools = useMemo<QuickAdd[]>(
    () => lists.map((l) => ({
      key: `list:${l.id}`,
      label: l.name,
      items: notYetOn(selected, l.contacts.map((c) => ({ ...c, email: c.email.toLowerCase() }))),
    })),
    [lists, selected],
  );

  const addMany = (items: EmailRecipient[]) => {
    if (items.length === 0) return;
    const next = [...value];
    const seen = new Set(selected);
    for (const r of items) {
      const email = r.email.toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);
      next.push({ ...r, email });
    }
    onChange(next);
  };

  const remove = (email: string) => {
    onChange(value.filter((r) => r.email !== email));
  };

  const addManual = () => {
    const email = manual.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setManualError('That does not look like an email address.');
      return;
    }
    setManualError(null);
    addMany([{ email, source: 'manual' }]);
    setManual('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <span className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">
            {label} <span className="num text-silver">{value.length}</span>
          </span>
          {hint && <p className="mt-1 text-[11.5px] leading-relaxed text-graphite">{hint}</p>}
        </div>
        {value.length > 0 && (
          <TinyBtn onClick={() => onChange([])}><IconX size={11} /> Clear all</TinyBtn>
        )}
      </div>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex max-h-[180px] flex-wrap gap-1.5 overflow-y-auto border rule bg-white p-3">
          {value.map((r) => (
            <button
              key={r.email}
              type="button"
              onClick={() => remove(r.email)}
              title={`Remove ${r.email}`}
              className="mono group inline-flex items-center gap-1.5 border rule px-2 py-1 text-[10px] tracking-[0.04em] text-slate transition-colors hover:border-[color:var(--color-warn)] hover:text-[color:var(--color-warn)]"
            >
              <span className={r.source === 'client' ? 'text-ink group-hover:text-inherit' : ''}>{r.name || r.email}</span>
              {r.source !== 'manual' && <span className="uppercase text-[8.5px] text-silver">{r.source}</span>}
              <IconX size={9} />
            </button>
          ))}
        </div>
      )}

      {/* Client search */}
      <div className="space-y-2">
        <label className="relative block">
          <span className="sr-only">Search clients</span>
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add clients — name, email, or firm…"
            className="w-full border rule bg-white py-2.5 pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
          />
        </label>
        {matches.length > 0 && (
          <ul className="divide-y rule border rule bg-white">
            {matches.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => { addMany([clientRecipient(c)]); setQuery(''); }}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-bone"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-ink">{c.name}</span>
                    <span className="mono block truncate text-[10.5px] text-graphite">
                      {c.email}{c.firm ? ` · ${c.firm}` : ''}
                    </span>
                    {(c.sectorPrefs.length > 0 || c.preferredAnalysts.length > 0) && (
                      <span className="mono mt-0.5 block truncate text-[9.5px] uppercase tracking-[0.08em] text-silver">
                        {[...c.sectorPrefs.slice(0, 3), ...c.preferredAnalysts.slice(0, 2)].join(' · ')}
                      </span>
                    )}
                  </span>
                  {c.clientType && <Chip tone={c.clientType === 'Local' ? 'live' : 'muted'}>{c.clientType}</Chip>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pools: one click adds everyone not already on the list */}
      <div className="flex flex-wrap items-center gap-2">
        {pools.map((p) => (
          <TinyBtn key={p.key} onClick={() => addMany(p.items)} disabled={p.items.length === 0}>
            <IconPlus size={11} /> {p.label} <span className="num text-silver">{p.items.length}</span>
          </TinyBtn>
        ))}
      </div>

      {/* Saved distribution lists */}
      {listPools.length > 0 && (
        <div className="space-y-2 border-t rule pt-3">
          <span className="mono block text-[9.5px] uppercase tracking-[0.2em] text-silver">Distribution lists</span>
          <div className="flex flex-wrap items-center gap-2">
            {listPools.map((p) => (
              <TinyBtn key={p.key} onClick={() => addMany(p.items)} disabled={p.items.length === 0}>
                <IconPlus size={11} /> {p.label} <span className="num text-silver">{p.items.length}</span>
              </TinyBtn>
            ))}
          </div>
        </div>
      )}

      {/* Manual address */}
      <div className="flex items-center gap-2">
        <input
          value={manual}
          onChange={(e) => { setManual(e.target.value); setManualError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual(); } }}
          placeholder="Add address manually…"
          className="mono w-[240px] border rule bg-white px-3 py-1.5 text-[11.5px] text-ink outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
        />
        <TinyBtn onClick={addManual}><IconPlus size={11} /> Add</TinyBtn>
      </div>
      {manualError && <p className="text-[11.5px]" style={{ color: 'var(--color-warn)' }}>{manualError}</p>}
    </div>
  );
}
