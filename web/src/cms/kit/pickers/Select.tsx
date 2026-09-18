import {
  useCallback, useEffect, useId, useMemo, useRef, useState,
  type KeyboardEvent, type RefObject,
} from 'react';
import { IconCheck, IconChevronDown, IconSearch, IconX } from '../../icons';
import {
  AnchoredPopover, FieldShell, TRIGGER_ICON_BTN, triggerClass, useDismiss,
  type FieldSize, type FieldVariant,
} from './Popover';

/* ─────────────────────────────────────────────────────────────
   Select — the one dropdown for the whole system.

   · combobox trigger in the field chrome, chevron that turns
   · listbox in the anchored popover, grouped headers, hints
   · keyboard: arrows, Home/End, Enter, Escape, type-ahead
   · optional filter box (automatic past 12 options)
   · `compact` variant for toolbars (mono, uppercase, no label)
   ───────────────────────────────────────────────────────────── */

export type SelectOption = { id: string; label: string; hint?: string | null; group?: string; disabled?: boolean };

export type Row =
  | { kind: 'group'; label: string; key: string }
  | { kind: 'option'; option: SelectOption; index: number; key: string };

export function matchesOption(o: SelectOption, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return o.label.toLowerCase().includes(s) || (o.hint ?? '').toLowerCase().includes(s) || (o.group ?? '').toLowerCase().includes(s);
}

/** Filter, group (first-appearance order, ungrouped first) and cap the list. */
export function buildRows(options: SelectOption[], query: string, max: number): { rows: Row[]; enabled: SelectOption[]; truncated: number } {
  const hits = options.filter((o) => matchesOption(o, query));
  const grouped = hits.some((o) => o.group);
  let ordered = hits;
  if (grouped) {
    const buckets = new Map<string, SelectOption[]>();
    for (const o of hits) {
      const g = o.group ?? '';
      if (!buckets.has(g)) buckets.set(g, []);
      buckets.get(g)!.push(o);
    }
    ordered = [...(buckets.get('') ?? []), ...[...buckets.entries()].filter(([g]) => g !== '').flatMap(([, v]) => v)];
  }
  const shown = ordered.slice(0, max);
  const rows: Row[] = [];
  let lastGroup: string | undefined;
  shown.forEach((o, index) => {
    if (grouped && o.group && o.group !== lastGroup) {
      rows.push({ kind: 'group', label: o.group, key: `g:${o.group}` });
      lastGroup = o.group;
    }
    rows.push({ kind: 'option', option: o, index, key: `o:${o.id}` });
  });
  return { rows, enabled: shown.filter((o) => !o.disabled), truncated: ordered.length - shown.length };
}

/* ── Rows ──────────────────────────────────────────────────── */

export function OptionRows({
  id, rows, active, selected, onPick, onActive, truncated = 0, query = '', multi = false, listRef, emptyText = 'No options.',
}: {
  id: string;
  rows: Row[];
  active: string | null;
  selected: Set<string>;
  onPick: (o: SelectOption) => void;
  onActive: (id: string) => void;
  truncated?: number;
  query?: string;
  multi?: boolean;
  listRef?: RefObject<HTMLUListElement>;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="px-3.5 py-3 text-[12.5px] text-graphite">
        {query ? <>Nothing matches “{query}”.</> : emptyText}
      </p>
    );
  }
  return (
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      aria-multiselectable={multi || undefined}
      className="min-h-0 flex-1 overflow-y-auto py-1"
      style={{ scrollbarGutter: 'stable' }}
    >
      {rows.map((r) => {
        if (r.kind === 'group') {
          return (
            <li key={r.key} role="presentation" className="mono px-3.5 pb-1 pt-3 text-[9.5px] uppercase tracking-[0.18em] text-graphite">
              {r.label}
            </li>
          );
        }
        const o = r.option;
        const on = selected.has(o.id);
        const act = active === o.id && !o.disabled;
        return (
          <li
            key={r.key}
            id={`${id}-opt-${r.index}`}
            data-id={o.id}
            role="option"
            aria-selected={on}
            aria-disabled={o.disabled || undefined}
            onMouseMove={() => { if (!o.disabled && active !== o.id) onActive(o.id); }}
            onClick={() => { if (!o.disabled) onPick(o); }}
            className={`flex items-center gap-3 px-3.5 py-2 text-[13.5px] leading-snug transition-colors duration-150 ${
              o.disabled ? 'cursor-not-allowed text-silver' : 'cursor-pointer'
            } ${act ? 'bg-bone' : ''} ${on ? 'text-ink' : o.disabled ? '' : 'text-slate'}`}
            style={on && !multi ? { boxShadow: 'inset 2px 0 0 var(--color-amber)' } : undefined}
          >
            {multi && (
              <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center border ${on ? 'border-navy bg-navy text-paper' : 'rule'}`}>
                {on && <IconCheck size={9} />}
              </span>
            )}
            <span className="min-w-0 flex-1 break-words">{o.label}</span>
            {o.hint && (
              <span className="mono max-w-[40%] shrink-0 truncate text-[10px] uppercase tracking-[0.12em] text-silver" title={o.hint}>
                {o.hint}
              </span>
            )}
            {!multi && on && <IconCheck size={12} className="shrink-0 text-[color:var(--color-amber-deep)]" />}
          </li>
        );
      })}
      {truncated > 0 && (
        <li role="presentation" className="mono border-t rule px-3.5 py-2 text-[9.5px] uppercase tracking-[0.16em] text-silver">
          {truncated} more · keep typing to narrow
        </li>
      )}
    </ul>
  );
}

/* ── Select ────────────────────────────────────────────────── */

export type SelectProps = {
  label?: string;
  /** Accessible name when there is no visible label (toolbars, compact). */
  ariaLabel?: string;
  options: SelectOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  hint?: string;
  helper?: string;
  error?: string;
  disabled?: boolean;
  /** Show a × in the trigger; `onChange(null)` when pressed. */
  clearable?: boolean;
  /** Filter box in the list. Defaults to on past 12 options. */
  searchable?: boolean;
  size?: FieldSize;
  variant?: FieldVariant;
  /** Compact only: paint the trigger amber to show a non-default filter is set. */
  accent?: boolean;
  className?: string;
  maxRows?: number;
};

export function Select({
  label, ariaLabel, options, value, onChange, placeholder = 'Choose…', hint, helper, error,
  disabled = false, clearable = false, searchable, size = 'md', variant = 'field', accent = false,
  className = '', maxRows = 80,
}: SelectProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ s: '', at: 0 });

  const isSearch = searchable ?? options.length > 12;
  const current = value === null ? null : options.find((o) => o.id === value) ?? null;
  const { rows, enabled, truncated } = useMemo(() => buildRows(options, isSearch ? q : '', maxRows), [options, isSearch, q, maxRows]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setQ('');
    if (refocus) btnRef.current?.focus({ preventScroll: true });
  }, []);
  const dismiss = useCallback(() => close(false), [close]);
  const dismissRefs = useMemo(() => [anchorRef, popRef], []);
  useDismiss(open, dismissRefs, dismiss);

  const openUp = () => {
    if (disabled) return;
    const first = options.find((o) => !o.disabled)?.id ?? null;
    setActive(value !== null && options.some((o) => o.id === value && !o.disabled) ? value : first);
    setOpen(true);
  };

  /* Keep the active row inside the filtered list. */
  useEffect(() => {
    if (!open) return;
    if (active && enabled.some((o) => o.id === active)) return;
    setActive(enabled[0]?.id ?? null);
  }, [enabled, open, active]);

  useEffect(() => {
    if (!open || !active) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(active)}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (o: SelectOption) => {
    if (o.disabled) return;
    onChange(o.id);
    close();
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
      case 'ArrowDown': e.preventDefault(); if (!open) openUp(); else move(1); return;
      case 'ArrowUp': e.preventDefault(); if (!open) openUp(); else move(-1); return;
      case 'Home': if (open) { e.preventDefault(); setActive(enabled[0]?.id ?? null); } return;
      case 'End': if (open) { e.preventDefault(); setActive(enabled[enabled.length - 1]?.id ?? null); } return;
      case 'Enter': {
        e.preventDefault();
        if (!open) { openUp(); return; }
        const o = enabled.find((x) => x.id === active);
        if (o) pick(o); else close();
        return;
      }
      case ' ': {
        if (isSearch && open) return; // typing a space in the filter
        e.preventDefault();
        if (!open) { openUp(); return; }
        const o = enabled.find((x) => x.id === active);
        if (o) pick(o);
        return;
      }
      case 'Escape': if (open) { e.preventDefault(); e.stopPropagation(); close(); } return;
      case 'Tab': if (open) close(); return; // browser then moves on from the trigger
      default: break;
    }
    /* Type-ahead for short lists that have no filter box. */
    if (!isSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      const t = typeahead.current;
      t.s = now - t.at > 700 ? e.key.toLowerCase() : t.s + e.key.toLowerCase();
      t.at = now;
      const pool = options.filter((o) => !o.disabled);
      const hit = pool.find((o) => o.label.toLowerCase().startsWith(t.s));
      if (hit) {
        if (!open) setOpen(true);
        setActive(hit.id);
      }
    }
  };

  const activeRow = rows.find((r) => r.kind === 'option' && r.option.id === active);
  const activeDesc = open && activeRow && activeRow.kind === 'option' ? `${listId}-opt-${activeRow.index}` : undefined;
  const compact = variant === 'compact';

  return (
    <FieldShell id={id} label={compact ? undefined : label} hint={hint} helper={helper} error={error} className={className}>
      <div ref={anchorRef} className="relative">
        <button
          ref={btnRef}
          id={id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={isSearch ? undefined : activeDesc}
          aria-label={ariaLabel ?? (compact ? label : undefined)}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          onClick={() => (open ? close() : openUp())}
          onKeyDown={onKey}
          onBlur={(e) => {
            const t = e.relatedTarget as Node | null;
            if (open && t && !popRef.current?.contains(t) && !anchorRef.current?.contains(t)) close(false);
          }}
          className={triggerClass({ size, variant, open, error: !!error, disabled, accent })}
        >
          <span className={`min-w-0 flex-1 truncate ${current ? (compact ? (accent ? '' : 'text-graphite') : 'text-ink') : 'text-silver'}`}>
            {current ? current.label : placeholder}
          </span>
          {current?.hint && !compact && (
            <span className="mono shrink-0 text-[10px] uppercase tracking-[0.12em] text-silver">{current.hint}</span>
          )}
          {clearable && current && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className={TRIGGER_ICON_BTN}
            >
              <IconX size={12} />
            </span>
          )}
          <IconChevronDown
            size={12}
            className={`shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-graphite' : 'text-silver'}`}
          />
        </button>
      </div>

      <AnchoredPopover
        open={open}
        anchorRef={anchorRef}
        popRef={popRef}
        minWidth={compact ? 200 : 240}
        onKeyDown={isSearch ? onKey : undefined}
      >
        {isSearch && (
          <div className="flex shrink-0 items-center gap-2 border-b rule px-3.5">
            <IconSearch size={13} className="shrink-0 text-silver" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type to filter"
              role="combobox"
              aria-label="Filter options"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={activeDesc}
              aria-autocomplete="list"
              className="w-full bg-transparent py-2.5 text-[13.5px] text-ink outline-none placeholder:text-silver"
            />
            {q && (
              <button type="button" tabIndex={-1} aria-label="Clear filter" onClick={() => setQ('')} className={TRIGGER_ICON_BTN}>
                <IconX size={11} />
              </button>
            )}
          </div>
        )}
        <OptionRows
          id={listId}
          rows={rows}
          active={active}
          selected={new Set(value !== null ? [value] : [])}
          onPick={pick}
          onActive={setActive}
          truncated={truncated}
          query={q}
          listRef={listRef}
        />
      </AnchoredPopover>
    </FieldShell>
  );
}
