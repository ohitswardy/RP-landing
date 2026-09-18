import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { EASE } from '../../cms/ease';
import { IconX } from '../../cms/icons';
import {
  AnchoredPopover, FieldShell, OptionRows, Select, TimePicker, buildRows, useDismiss,
  type SelectOption,
} from '../../cms/kit/pickers';

/* ─────────────────────────────────────────────────────────────
   CRMS form pieces beyond the CMS kit. Time, single and multi
   pickers all sit on the shared picker kit in cms/kit/pickers so
   every dropdown and clock in the system looks and behaves alike.
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

/** HH:mm or null. Sits on the shared TimePicker. */
export function TimeField({ label, value, onChange, hint, helper, error, disabled, minuteStep }: {
  label: string; value: string | null; onChange: (v: string | null) => void;
  hint?: string; helper?: string; error?: string; disabled?: boolean; minuteStep?: number;
}) {
  return (
    <TimePicker label={label} value={value} onChange={onChange} hint={hint} helper={helper} error={error} disabled={disabled} minuteStep={minuteStep} />
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

export type Option = SelectOption;

/** Searchable single choice. Thin wrapper over the shared Select. */
export function Picker({ label, options, value, onChange, placeholder = 'Choose…', hint, helper, allowEmpty = true, disabled = false, error, searchable = true }: {
  label: string; options: Option[]; value: string | null; onChange: (id: string | null) => void;
  placeholder?: string; hint?: string; helper?: string; allowEmpty?: boolean; disabled?: boolean; error?: string; searchable?: boolean;
}) {
  return (
    <Select
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      hint={hint}
      helper={helper}
      error={error}
      disabled={disabled}
      clearable={allowEmpty}
      searchable={searchable}
    />
  );
}

export function MultiPicker({ label, options, value, onChange, placeholder = 'Add…', hint, max, disabled = false, error }: {
  label: string; options: Option[]; value: string[]; onChange: (ids: string[]) => void;
  placeholder?: string; hint?: string; max?: number; disabled?: boolean; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useMemo(() => `mp-${Math.random().toString(36).slice(2, 8)}`, []);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const selected = useMemo(() => new Set(value), [value]);
  const full = !!max && value.length >= max;
  const { rows, enabled, truncated } = useMemo(() => buildRows(options, q, 80), [options, q]);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    setQ('');
    if (refocus) inputRef.current?.focus({ preventScroll: true });
  }, []);
  const dismiss = useCallback(() => close(false), [close]);
  const dismissRefs = useMemo(() => [anchorRef, popRef], []);
  useDismiss(open, dismissRefs, dismiss);

  useEffect(() => {
    if (!open) return;
    if (active && enabled.some((o) => o.id === active)) return;
    setActive(enabled[0]?.id ?? null);
  }, [enabled, open, active]);

  useEffect(() => {
    if (!open || !active) return;
    listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(active)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const toggle = (o: Option) => {
    if (o.disabled) return;
    if (selected.has(o.id)) onChange(value.filter((x) => x !== o.id));
    else if (!full) onChange([...value, o.id]);
  };

  const move = (delta: number) => {
    const n = enabled.length;
    if (!n) return;
    const i = enabled.findIndex((o) => o.id === active);
    const next = i < 0 ? (delta > 0 ? 0 : n - 1) : Math.min(n - 1, Math.max(0, i + delta));
    setActive(enabled[next].id);
  };

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); if (!open) setOpen(true); else move(1); return;
      case 'ArrowUp': e.preventDefault(); if (!open) setOpen(true); else move(-1); return;
      case 'Enter': {
        e.preventDefault();
        if (!open) { setOpen(true); return; }
        const o = enabled.find((x) => x.id === active);
        if (o) toggle(o);
        return;
      }
      case 'Backspace':
        if (!q && value.length) { e.preventDefault(); onChange(value.slice(0, -1)); }
        return;
      case 'Escape': if (open) { e.preventDefault(); e.stopPropagation(); close(true); } return;
      case 'Tab': if (open) close(false); return;
      default: return;
    }
  };

  const activeRow = rows.find((r) => r.kind === 'option' && r.option.id === active);
  const activeDesc = open && activeRow && activeRow.kind === 'option' ? `${listId}-opt-${activeRow.index}` : undefined;

  return (
    <FieldShell label={label} hint={hint ?? (value.length ? `${value.length}${max ? ` / ${max}` : ''} selected` : undefined)} error={error}>
      <div
        ref={anchorRef}
        onClick={() => { if (!disabled) { inputRef.current?.focus(); setOpen(true); } }}
        className={`flex min-h-[44px] w-full flex-wrap items-center gap-1.5 border bg-white px-3.5 py-1.5 text-[14px] text-ink transition-colors duration-300 ${
          error ? 'border-[color:var(--color-warn)]' : open ? 'border-[color:var(--color-amber-deep)]' : 'rule hover:border-[color:var(--color-amber-deep)]'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-text'}`}
      >
        {value.map((id) => {
          const o = byId.get(id);
          return (
            <span key={id} className="inline-flex max-w-full items-center gap-1.5 border rule bg-bone px-2 py-1 text-[12.5px] text-ink">
              <span className="truncate">{o?.label ?? `#${id}`}</span>
              {!disabled && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Remove ${o?.label ?? id}`}
                  onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== id)); }}
                  className="shrink-0 text-graphite transition-colors hover:text-ink"
                >
                  <IconX size={11} />
                </button>
              )}
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={q}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeDesc}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={onKey}
          onBlur={(e) => {
            const t = e.relatedTarget as Node | null;
            if (open && t && !popRef.current?.contains(t) && !anchorRef.current?.contains(t)) close(false);
          }}
          placeholder={value.length ? (full ? '' : 'Add more…') : placeholder}
          className="min-w-[120px] flex-1 bg-transparent py-1 text-[13.5px] outline-none placeholder:text-silver disabled:cursor-not-allowed"
        />
      </div>
      <AnchoredPopover open={open} anchorRef={anchorRef} popRef={popRef} minWidth={300}>
        {full && (
          <p className="mono border-b rule px-3.5 py-2 text-[9.5px] uppercase tracking-[0.16em] text-[color:var(--color-amber-deep)]">
            Limit of {max} reached — remove one to add another
          </p>
        )}
        <OptionRows
          id={listId}
          rows={rows}
          active={active}
          selected={selected}
          onPick={toggle}
          onActive={setActive}
          truncated={truncated}
          query={q}
          multi
          listRef={listRef}
        />
      </AnchoredPopover>
    </FieldShell>
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
