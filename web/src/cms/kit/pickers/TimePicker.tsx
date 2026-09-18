import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent, type RefObject,
} from 'react';
import { IconClock, IconX } from '../../icons';
import {
  AnchoredPopover, FieldShell, FOOT_BTN, TRIGGER_ICON_BTN, triggerClass, useDismiss,
  type FieldSize,
} from './Popover';

/* ─────────────────────────────────────────────────────────────
   TimePicker — value is "HH:mm" (24-hour) or null.

   · typeable field: "9", "930", "9:30 pm", "14:00", "noon"
   · three columns in the popover: hour · minute · AM/PM, each
     a listbox with arrow keys, selection in navy
   · live readout at the top in 12h with the 24h form beside it
   · Now / Clear in the footer
   ───────────────────────────────────────────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, '0');
const HOURS12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
type Period = 'AM' | 'PM';

export function parseHm(v: string | null | undefined): { h: number; m: number } | null {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  if (!m) return null;
  const h = Number(m[1]); const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return { h, m: mi };
}

export function hmOf(h: number, m: number): string {
  return `${pad2(h)}:${pad2(m)}`;
}

/** "09:30 AM" */
export function fmtTime12(v: string | null | undefined): string {
  const p = parseHm(v);
  if (!p) return '';
  const h12 = p.h % 12 || 12;
  return `${pad2(h12)}:${pad2(p.m)} ${p.h >= 12 ? 'PM' : 'AM'}`;
}

function to24(h12: number, period: Period): number {
  const base = h12 % 12;
  return period === 'PM' ? base + 12 : base;
}

/**
 * Lenient parser. A bare hour with no AM/PM reads like a meetings desk:
 * 7–11 → morning, 12 and 1–6 → afternoon, 13+ → 24-hour.
 */
export function parseLooseTime(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\./g, '');
  if (!s) return null;
  if (s === 'noon' || s === 'midday') return '12:00';
  if (s === 'midnight') return '00:00';
  if (s === 'now') { const d = new Date(); return hmOf(d.getHours(), d.getMinutes()); }

  let h: number; let mi = 0; let period: Period | null = null;
  let m: RegExpExecArray | null;
  const per = (raw: string | undefined): Period | null => (raw ? (raw.startsWith('p') ? 'PM' : 'AM') : null);

  if ((m = /^(\d{3,4}) ?([ap]m?)?$/.exec(s))) {
    // 930 · 0930 · 2130 · 930pm
    const t = m[1];
    h = Number(t.slice(0, t.length - 2));
    mi = Number(t.slice(-2));
    period = per(m[2]);
  } else if ((m = /^(\d{1,2})(?:[:h ](\d{1,2}))? ?([ap]m?)?$/.exec(s))) {
    // 9 · 9:30 · 9 30 · 9am · 9:30 pm · 14:00
    h = Number(m[1]);
    mi = m[2] ? Number(m[2]) : 0;
    period = per(m[3]);
  } else {
    return null;
  }

  if (mi < 0 || mi > 59) return null;
  if (period) {
    if (h < 1 || h > 12) return null;
    return hmOf(to24(h, period), mi);
  }
  if (h > 23) return null;
  if (h >= 13 || h === 0) return hmOf(h, mi);
  if (h >= 7 && h <= 11) return hmOf(h, mi);
  return hmOf(h === 12 ? 12 : h + 12, mi); // 12, 1–6 → afternoon
}

function roundToStep(h: number, m: number, step: number): { h: number; m: number } {
  const total = Math.round((h * 60 + m) / step) * step;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return { h: Math.floor(wrapped / 60), m: wrapped % 60 };
}

/* ── Column ────────────────────────────────────────────────── */

type Item = { id: string; label: string; on: boolean };

function Column({
  label, items, onPick, onSide, onCommit, colRef, width = 'w-[72px]',
}: {
  label: string;
  items: Item[];
  onPick: (id: string) => void;
  onSide: (dir: -1 | 1) => void;
  onCommit: () => void;
  colRef: RefObject<HTMLUListElement>;
  width?: string;
}) {
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const i = items.findIndex((x) => x.on);
    const n = items.length;
    const step = (d: number) => {
      e.preventDefault();
      const next = i < 0 ? (d > 0 ? 0 : n - 1) : (i + d + n) % n;
      onPick(items[next].id);
    };
    switch (e.key) {
      case 'ArrowDown': return step(1);
      case 'ArrowUp': return step(-1);
      case 'Home': e.preventDefault(); return onPick(items[0].id);
      case 'End': e.preventDefault(); return onPick(items[n - 1].id);
      case 'ArrowLeft': e.preventDefault(); return onSide(-1);
      case 'ArrowRight': e.preventDefault(); return onSide(1);
      case 'Enter': case ' ': e.preventDefault(); return onCommit();
      default: return;
    }
  };
  const activeId = items.find((x) => x.on)?.id;
  return (
    <ul
      ref={colRef}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      aria-activedescendant={activeId ? `${label}-${activeId}` : undefined}
      onKeyDown={onKey}
      className={`relative h-[216px] ${width} overflow-y-auto py-1 outline-none focus-visible:bg-bone/40`}
      style={{ scrollbarWidth: 'thin' }}
    >
      {items.map((it) => (
        <li
          key={it.id}
          id={`${label}-${it.id}`}
          role="option"
          aria-selected={it.on}
          data-on={it.on || undefined}
          onClick={() => onPick(it.id)}
          className={`mx-1 grid h-9 cursor-pointer place-items-center mono num text-[13px] transition-colors duration-150 ${
            it.on ? 'bg-navy text-paper' : 'text-slate hover:bg-bone hover:text-ink'
          }`}
        >
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/* ── Component ─────────────────────────────────────────────── */

export type TimePickerProps = {
  label?: string;
  ariaLabel?: string;
  value: string | null;
  onChange: (hm: string | null) => void;
  placeholder?: string;
  hint?: string;
  helper?: string;
  error?: string;
  disabled?: boolean;
  clearable?: boolean;
  /** Minute granularity in the column. Typed values may still be finer. */
  minuteStep?: number;
  size?: FieldSize;
  className?: string;
};

export function TimePicker({
  label, ariaLabel, value, onChange, placeholder = 'Pick a time', hint, helper, error,
  disabled = false, clearable = true, minuteStep = 5, size = 'md', className = '',
}: TimePickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(fmtTime12(value));
  const editing = useRef(false);
  const wantFocus = useRef(false);

  const anchorRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLUListElement>(null);
  const minRef = useRef<HTMLUListElement>(null);
  const perRef = useRef<HTMLUListElement>(null);
  const cols = useMemo(() => [hourRef, minRef, perRef], []);

  const parts = parseHm(value);
  const h12 = parts ? parts.h % 12 || 12 : null;
  const period: Period | null = parts ? (parts.h >= 12 ? 'PM' : 'AM') : null;
  const minute = parts?.m ?? null;

  useEffect(() => {
    if (!editing.current) setText(fmtTime12(value));
  }, [value]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    wantFocus.current = false;
    if (refocus) inputRef.current?.focus({ preventScroll: true });
  }, []);
  const dismiss = useCallback(() => close(false), [close]);
  const dismissRefs = useMemo(() => [anchorRef, popRef], []);
  useDismiss(open, dismissRefs, dismiss);

  const openUp = () => { if (!disabled && !open) setOpen(true); };

  const commitHm = (h: number, m: number) => {
    editing.current = false;
    const v = hmOf(h, m);
    onChange(v);
    setText(fmtTime12(v));
  };
  const pickHour = (raw: string) => {
    const hh = Number(raw);
    const p: Period = period ?? (hh >= 7 && hh <= 11 ? 'AM' : 'PM');
    commitHm(to24(hh, p), minute ?? 0);
  };
  const pickMinute = (raw: string) => commitHm(parts?.h ?? 9, Number(raw));
  const pickPeriod = (raw: string) => commitHm(to24(h12 ?? 9, raw as Period), minute ?? 0);

  const clear = () => { editing.current = false; onChange(null); setText(''); close(); };
  const now = () => {
    const d = new Date();
    const r = roundToStep(d.getHours(), d.getMinutes(), minuteStep);
    commitHm(r.h, r.m);
    close();
  };

  const commitText = (): boolean => {
    if (!editing.current) return true;
    editing.current = false;
    const t = text.trim();
    if (!t) {
      if (clearable) { onChange(null); setText(''); return true; }
      setText(fmtTime12(value));
      return false;
    }
    const p = parseLooseTime(t);
    if (p) { onChange(p); setText(fmtTime12(p)); return true; }
    setText(fmtTime12(value));
    return false;
  };

  const onType = (v: string) => {
    editing.current = true;
    setText(v);
  };

  const focusCol = (i: number) => {
    const c = cols[Math.max(0, Math.min(cols.length - 1, i))].current;
    c?.focus({ preventScroll: true });
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        const typed = editing.current;
        const ok = commitText();
        if (typed) { if (ok && open) close(); return; }
        if (open) close(); else openUp();
        return;
      }
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        commitText();
        if (!open) openUp();
        wantFocus.current = true;
        requestAnimationFrame(() => focusCol(0));
        return;
      }
      case 'Escape': {
        if (!open && !editing.current) return;
        e.preventDefault();
        e.stopPropagation();
        editing.current = false;
        setText(fmtTime12(value));
        close();
        return;
      }
      case 'Tab': commitText(); if (open) close(false); return;
      default: return;
    }
  };

  const onPopKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') { close(); }
  };

  /* Centre the selected item in each column when the popover opens or the value moves. */
  useLayoutEffect(() => {
    if (!open) return;
    for (const c of cols) {
      const el = c.current;
      const on = el?.querySelector<HTMLElement>('[data-on]');
      if (el && on) el.scrollTop = on.offsetTop - el.clientHeight / 2 + on.clientHeight / 2;
    }
  }, [open, value, cols]);

  const minutes = useMemo(() => {
    const list: number[] = [];
    for (let m = 0; m < 60; m += minuteStep) list.push(m);
    if (minute !== null && !list.includes(minute)) list.push(minute);
    return list.sort((a, b) => a - b);
  }, [minuteStep, minute]);

  const hourItems: Item[] = HOURS12.map((h) => ({ id: String(h), label: pad2(h), on: h === h12 }));
  const minuteItems: Item[] = minutes.map((m) => ({ id: String(m), label: pad2(m), on: m === minute }));
  const periodItems: Item[] = (['AM', 'PM'] as Period[]).map((p) => ({ id: p, label: p, on: p === period }));

  return (
    <FieldShell id={id} label={label} hint={hint} helper={helper} error={error} className={className}>
      <div ref={anchorRef} className={triggerClass({ size, open, error: !!error, disabled })}>
        <input
          ref={inputRef}
          id={id}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          onChange={(e) => onType(e.target.value)}
          onClick={() => openUp()}
          onKeyDown={onInputKey}
          onBlur={(e) => {
            const t = e.relatedTarget as Node | null;
            if (t && (popRef.current?.contains(t) || anchorRef.current?.contains(t))) return;
            commitText();
            if (open && t) close(false);
          }}
          className="mono num min-w-0 flex-1 bg-transparent uppercase outline-none placeholder:font-sans placeholder:normal-case placeholder:text-silver disabled:cursor-not-allowed"
        />
        {clearable && value && !disabled && (
          <button type="button" tabIndex={-1} aria-label="Clear time" onClick={clear} className={TRIGGER_ICON_BTN}>
            <IconX size={12} />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? 'Close time picker' : 'Open time picker'}
          disabled={disabled}
          onClick={() => (open ? close() : openUp())}
          className={`${TRIGGER_ICON_BTN} ${open ? 'text-[color:var(--color-amber-deep)]' : ''}`}
        >
          <IconClock size={14} />
        </button>
      </div>

      <AnchoredPopover
        open={open}
        anchorRef={anchorRef}
        popRef={popRef}
        matchWidth={false}
        minWidth={232}
        className="w-[232px]"
        role="dialog"
        ariaLabel="Choose a time"
        onKeyDown={onPopKey}
      >
        <div className="flex items-baseline justify-between border-b rule px-3.5 py-2">
          <span className="mono num text-[15px] tracking-[-0.01em] text-ink">{value ? fmtTime12(value) : '––:–– ––'}</span>
          <span className="mono num text-[10px] tracking-[0.12em] text-silver">{value ?? '24h'}</span>
        </div>
        <div className="flex">
          <div className="flex flex-col">
            <div className="mono grid h-6 place-items-center text-[9px] uppercase tracking-[0.16em] text-graphite">Hr</div>
            <Column label={`${id}-hour`} items={hourItems} onPick={pickHour} onSide={(d) => focusCol(0 + d)} onCommit={() => close()} colRef={hourRef} />
          </div>
          <div className="flex flex-col border-l rule">
            <div className="mono grid h-6 place-items-center text-[9px] uppercase tracking-[0.16em] text-graphite">Min</div>
            <Column label={`${id}-minute`} items={minuteItems} onPick={pickMinute} onSide={(d) => focusCol(1 + d)} onCommit={() => close()} colRef={minRef} />
          </div>
          <div className="flex flex-1 flex-col border-l rule">
            <div className="mono grid h-6 place-items-center text-[9px] uppercase tracking-[0.16em] text-graphite">—</div>
            <Column label={`${id}-period`} items={periodItems} onPick={pickPeriod} onSide={(d) => focusCol(2 + d)} onCommit={() => close()} colRef={perRef} width="w-full" />
          </div>
        </div>
        <div className="flex items-center justify-between border-t rule px-2 py-1.5">
          {clearable ? (
            <button type="button" onClick={clear} disabled={!value} className={FOOT_BTN}>Clear</button>
          ) : <span />}
          <button type="button" onClick={now} className={`${FOOT_BTN} text-[color:var(--color-amber-deep)] hover:text-ink`}>Now</button>
        </div>
      </AnchoredPopover>
    </FieldShell>
  );
}
