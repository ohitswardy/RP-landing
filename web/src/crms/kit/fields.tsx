import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE } from '../../cms/ui';
import { IconCheck, IconSearch, IconX } from '../../cms/icons';

/* ─────────────────────────────────────────────────────────────
   CRMS form pieces beyond the CMS kit: a time input that speaks
   HH:mm only, a searchable single picker, a multi picker with
   chips, a segmented tab strip, a section rule, and a pager.
   ───────────────────────────────────────────────────────────── */

const INPUT =
  'w-full border rule bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors duration-300 placeholder:text-silver focus:border-[color:var(--color-amber-deep)]';

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <label className="mono flex items-baseline justify-between text-[10.5px] uppercase tracking-[0.18em] text-graphite">
      <span>{children}</span>
      {hint && <span className="normal-case tracking-normal text-silver">{hint}</span>}
    </label>
  );
}

export function TimeField({ label, value, onChange, hint }: {
  label: string; value: string | null; onChange: (v: string | null) => void; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label hint={hint}>{label}</Label>
      <input type="time" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={`${INPUT} mono num`} />
    </div>
  );
}

export function NumberField({ label, value, onChange, hint, placeholder }: {
  label: string; value: number | null; onChange: (v: number | null) => void; hint?: string; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label hint={hint}>{label}</Label>
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={`${INPUT} mono num`}
      />
    </div>
  );
}

/* ── Pickers ───────────────────────────────────────────────── */

export type Option = { id: string; label: string; hint?: string | null; group?: string };

function useOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ref, onOutside]);
}

function matches(o: Option, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return o.label.toLowerCase().includes(s) || (o.hint ?? '').toLowerCase().includes(s);
}

function OptionList({ options, query, selected, onPick, max = 60 }: {
  options: Option[]; query: string; selected: Set<string>; onPick: (o: Option) => void; max?: number;
}) {
  const shown = useMemo(() => options.filter((o) => matches(o, query)).slice(0, max), [options, query, max]);
  if (shown.length === 0) {
    return <p className="px-3.5 py-3 text-[12.5px] text-graphite">Nothing matches “{query}”.</p>;
  }
  return (
    <ul role="listbox" className="max-h-[260px] overflow-y-auto py-1">
      {shown.map((o) => {
        const on = selected.has(o.id);
        return (
          <li key={o.id}>
            <button
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => onPick(o)}
              className={`flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-bone ${on ? 'text-ink' : 'text-slate'}`}
            >
              <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center border ${on ? 'border-navy bg-navy text-paper' : 'rule'}`}>
                {on && <IconCheck size={9} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px]">{o.label}</span>
              {o.hint && <span className="mono shrink-0 text-[10px] uppercase tracking-[0.12em] text-silver">{o.hint}</span>}
            </button>
          </li>
        );
      })}
      {options.length > shown.length && (
        <li className="mono px-3.5 py-2 text-[9.5px] uppercase tracking-[0.16em] text-silver">Keep typing to narrow the list</li>
      )}
    </ul>
  );
}

function Popover({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
          transition={{ duration: 0.22, ease: EASE }}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 border rule bg-paper shadow-[0_24px_50px_-28px_rgba(13,13,13,0.4)]"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Picker({ label, options, value, onChange, placeholder = 'Choose…', hint, allowEmpty = true, disabled = false, error }: {
  label: string; options: Option[]; value: string | null; onChange: (id: string | null) => void;
  placeholder?: string; hint?: string; allowEmpty?: boolean; disabled?: boolean; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const current = options.find((o) => o.id === value) ?? null;

  return (
    <div className="flex flex-col gap-2" ref={ref}>
      <Label hint={hint}>{label}</Label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setOpen((v) => !v); setQ(''); }}
          className={`${INPUT} flex items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50`}
          style={error ? { borderColor: 'var(--color-warn)' } : undefined}
        >
          <span className={`min-w-0 flex-1 truncate ${current ? 'text-ink' : 'text-silver'}`}>{current?.label ?? placeholder}</span>
          {current?.hint && <span className="mono shrink-0 text-[10px] uppercase tracking-[0.12em] text-silver">{current.hint}</span>}
          {current && allowEmpty && !disabled && (
            <span
              role="button"
              aria-label="Clear"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="shrink-0 text-graphite hover:text-ink"
            >
              <IconX size={13} />
            </span>
          )}
        </button>
        <Popover open={open}>
          <div className="flex items-center gap-2 border-b rule px-3.5">
            <IconSearch size={13} className="text-silver" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-full bg-transparent py-2.5 text-[13.5px] outline-none placeholder:text-silver" />
          </div>
          <OptionList options={options} query={q} selected={new Set(value ? [value] : [])} onPick={(o) => { onChange(o.id); setOpen(false); }} />
        </Popover>
      </div>
      {error && <p className="text-[12px]" style={{ color: 'var(--color-warn)' }}>{error}</p>}
    </div>
  );
}

export function MultiPicker({ label, options, value, onChange, placeholder = 'Add…', hint, max }: {
  label: string; options: Option[]; value: string[]; onChange: (ids: string[]) => void; placeholder?: string; hint?: string; max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const selected = new Set(value);

  const toggle = (o: Option) => {
    if (selected.has(o.id)) onChange(value.filter((x) => x !== o.id));
    else if (!max || value.length < max) onChange([...value, o.id]);
  };

  return (
    <div className="flex flex-col gap-2" ref={ref}>
      <Label hint={hint ?? (value.length ? `${value.length} selected` : undefined)}>{label}</Label>
      <div className="relative">
        <div
          onClick={() => setOpen(true)}
          className={`${INPUT} flex min-h-[44px] cursor-text flex-wrap items-center gap-1.5 py-1.5`}
        >
          {value.map((id) => {
            const o = byId.get(id);
            return (
              <span key={id} className="inline-flex items-center gap-1.5 border rule bg-bone px-2 py-1 text-[12.5px] text-ink">
                {o?.label ?? `#${id}`}
                <button type="button" aria-label={`Remove ${o?.label ?? id}`} onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== id)); }} className="text-graphite hover:text-ink">
                  <IconX size={11} />
                </button>
              </span>
            );
          })}
          <input
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            placeholder={value.length ? '' : placeholder}
            className="min-w-[120px] flex-1 bg-transparent py-1 text-[13.5px] outline-none placeholder:text-silver"
          />
        </div>
        <Popover open={open}>
          <OptionList options={options} query={q} selected={selected} onPick={toggle} />
        </Popover>
      </div>
    </div>
  );
}

/* ── Tabs ──────────────────────────────────────────────────── */

export type Tab = { id: string; label: string; count?: number };

export function Tabs({ tabs, value, onChange, label }: { tabs: Tab[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="tabs-scroll flex gap-0.5 overflow-x-auto border-b rule">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`relative shrink-0 px-4 py-3 text-[13px] transition-colors ${active ? 'text-ink' : 'text-graphite hover:text-ink'}`}
          >
            <span className="inline-flex items-center gap-2">
              {t.label}
              {t.count !== undefined && <span className="mono num text-[10px] tracking-[0.06em] text-silver">{t.count}</span>}
            </span>
            {active && (
              <motion.span layoutId={`tab-${label}`} transition={{ duration: 0.3, ease: EASE }} className="absolute inset-x-3 -bottom-px h-[2px]" style={{ background: 'var(--color-amber)' }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Section rule + pager ──────────────────────────────────── */

export function SectionRule({ code, title, actions }: { code: string; title: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b rule pb-3">
      <div>
        <div className="mono text-[9.5px] uppercase tracking-[0.2em] text-graphite">{code}</div>
        <h3 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-ink">{title}</h3>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1 && total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <span className="mono num text-[10.5px] uppercase tracking-[0.16em] text-graphite">
        {total.toLocaleString('en-PH')} row{total === 1 ? '' : 's'} · page {page} / {pages}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="mono border rule px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">Prev</button>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="mono border rule px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

/** Inline error under a form. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="border-l-2 pl-3 text-[12.5px] leading-relaxed" style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}>
      {message}
    </p>
  );
}
