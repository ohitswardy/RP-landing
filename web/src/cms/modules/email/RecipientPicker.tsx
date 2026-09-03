import { useMemo, useState } from 'react';
import { Chip } from '../../ui';
import { TinyBtn } from '../../kit/parts';
import { IconPlus, IconSearch, IconX } from '../../icons';
import type { AudienceClient, AudienceSubscriber, EmailRecipient } from '../../data';

/* ─────────────────────────────────────────────────────────────
   Who a blast goes to. Three sources feed one deduplicated list:
   approved portal clients (with their preference chips visible so
   pruning an auto-matched list is informed), verified newsletter
   subscribers, and manually typed addresses.
   ───────────────────────────────────────────────────────────── */

export default function RecipientPicker({ clients, subscribers, value, onChange }: {
  clients: AudienceClient[];
  subscribers: AudienceSubscriber[];
  value: EmailRecipient[];
  onChange: (next: EmailRecipient[]) => void;
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

  const unselectedSubscribers = useMemo(
    () => subscribers.filter((s) => !selected.has(s.email.toLowerCase())),
    [subscribers, selected],
  );

  const add = (r: EmailRecipient) => {
    if (selected.has(r.email.toLowerCase())) return;
    onChange([...value, { ...r, email: r.email.toLowerCase() }]);
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
    add({ email, source: 'manual' });
    setManual('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">
          Recipients <span className="num text-silver">{value.length}</span>
        </span>
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
                  onClick={() => { add({ email: c.email, name: c.name, userId: c.id, source: 'client' }); setQuery(''); }}
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

      {/* Subscribers + manual */}
      <div className="flex flex-wrap items-center gap-3">
        <TinyBtn
          onClick={() => onChange([
            ...value,
            ...unselectedSubscribers.map((s) => ({ email: s.email.toLowerCase(), source: 'subscriber' as const })),
          ])}
          disabled={unselectedSubscribers.length === 0}
        >
          <IconPlus size={11} /> Add all verified subscribers ({unselectedSubscribers.length})
        </TinyBtn>
        <div className="flex items-center gap-2">
          <input
            value={manual}
            onChange={(e) => { setManual(e.target.value); setManualError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual(); } }}
            placeholder="Add address manually…"
            className="mono w-[220px] border rule bg-white px-3 py-1.5 text-[11.5px] text-ink outline-none transition-colors placeholder:text-silver focus:border-[color:var(--color-amber-deep)]"
          />
          <TinyBtn onClick={addManual}><IconPlus size={11} /> Add</TinyBtn>
        </div>
      </div>
      {manualError && <p className="text-[11.5px]" style={{ color: 'var(--color-warn)' }}>{manualError}</p>}
    </div>
  );
}
