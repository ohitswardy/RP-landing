import {
  useCallback, useEffect, useId, useMemo, useRef, useState,
  type KeyboardEvent,
} from 'react';
import { motion } from 'framer-motion';
import { EASE } from '../../ease';
import { IconCalendar, IconChevronLeft, IconChevronRight, IconX } from '../../icons';
import {
  AnchoredPopover, FieldShell, FOOT_BTN, TRIGGER_ICON_BTN, triggerClass, useDismiss,
  type FieldSize,
} from './Popover';

/* ─────────────────────────────────────────────────────────────
   DatePicker — value is an ISO day string (YYYY-MM-DD) or null.

   · typeable field: "18 sep", "18/09/2026", "2026-09-18",
     "sep 18", "18", "today" all commit on Enter / blur
   · calendar in the anchored popover, Monday-first like the
     CRMS calendar, today dotted amber, selection in navy
   · month name → month grid, year → year grid, for fast jumps
   · full arrow-key navigation, min / max fences
   ───────────────────────────────────────────────────────────── */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const pad2 = (n: number) => String(n).padStart(2, '0');

export function isoOf(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

export function isoFromDate(d: Date): string {
  return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseIso(s: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]) - 1; const d = Number(m[3]);
  return validYmd(y, mo, d) ? { y, m: mo, d } : null;
}

function validYmd(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 0 || m > 11 || d < 1) return false;
  const dt = new Date(y, m, d);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
}

export function todayIso(): string {
  return isoFromDate(new Date());
}

/** House display format — matches fmtDate in cms/data.ts ("Sep 18, 2026"). */
export function fmtDisplayDate(iso: string | null): string {
  const p = parseIso(iso);
  if (!p) return '';
  return `${MONTHS_SHORT[p.m]} ${pad2(p.d)}, ${p.y}`;
}

function fmtLongDate(iso: string): string {
  const p = parseIso(iso);
  if (!p) return iso;
  const dt = new Date(p.y, p.m, p.d);
  return dt.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function monthIndex(name: string): number {
  const s = name.toLowerCase();
  if (s.length < 3) return -1;
  return MONTHS.findIndex((m) => m.toLowerCase().startsWith(s));
}

function shiftDays(iso: string, n: number): string {
  const p = parseIso(iso)!;
  return isoFromDate(new Date(p.y, p.m, p.d + n));
}

/**
 * Lenient parser for what staff actually type. `ctx` is the month the
 * calendar is showing, so a bare day number lands there.
 */
export function parseLooseDate(input: string, ctx: { y: number; m: number }): string | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  const today = todayIso();
  if (s === 't' || s === 'today') return today;
  if (s === 'tomorrow' || s === 'tom') return shiftDays(today, 1);
  if (s === 'yesterday' || s === 'yes') return shiftDays(today, -1);

  let m: RegExpExecArray | null;
  const year = (raw: string | undefined) => {
    if (!raw) return ctx.y;
    const n = Number(raw);
    return raw.length === 2 ? 2000 + n : n;
  };

  // 2026-09-18 · 2026/9/18 · 2026.09.18
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s))) {
    const y = Number(m[1]); const mo = Number(m[2]) - 1; const d = Number(m[3]);
    return validYmd(y, mo, d) ? isoOf(y, mo, d) : null;
  }
  // 18/09/2026 · 18-9-26 · 18.09 — day-first, unless the first number cannot be a day
  if ((m = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2}|\d{4}))?$/.exec(s))) {
    const a = Number(m[1]); const b = Number(m[2]); const y = year(m[3]);
    let d = a; let mo = b - 1;
    if (a <= 12 && b > 12) { mo = a - 1; d = b; }
    return validYmd(y, mo, d) ? isoOf(y, mo, d) : null;
  }
  // 18 sep 2026 · 18th september · 18 sep
  if ((m = /^(\d{1,2})(?:st|nd|rd|th)?[ -]([a-z]+)\.?,?(?: (\d{2}|\d{4}))?$/.exec(s))) {
    const d = Number(m[1]); const mo = monthIndex(m[2]); const y = year(m[3]);
    return mo >= 0 && validYmd(y, mo, d) ? isoOf(y, mo, d) : null;
  }
  // sep 18 2026 · september 18, 2026 · sep 18
  if ((m = /^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?,?(?: (\d{2}|\d{4}))?$/.exec(s))) {
    const mo = monthIndex(m[1]); const d = Number(m[2]); const y = year(m[3]);
    return mo >= 0 && validYmd(y, mo, d) ? isoOf(y, mo, d) : null;
  }
  // 20260918 · 18092026
  if ((m = /^(\d{8})$/.exec(s))) {
    const t = m[1];
    if (Number(t.slice(0, 4)) > 1900) {
      const y = Number(t.slice(0, 4)); const mo = Number(t.slice(4, 6)) - 1; const d = Number(t.slice(6, 8));
      return validYmd(y, mo, d) ? isoOf(y, mo, d) : null;
    }
    const d = Number(t.slice(0, 2)); const mo = Number(t.slice(2, 4)) - 1; const y = Number(t.slice(4, 8));
    return validYmd(y, mo, d) ? isoOf(y, mo, d) : null;
  }
  // 18 — a day in the month on screen
  if ((m = /^(\d{1,2})$/.exec(s))) {
    const d = Number(m[1]);
    return validYmd(ctx.y, ctx.m, d) ? isoOf(ctx.y, ctx.m, d) : null;
  }
  return null;
}

function gridDays(y: number, m: number): Date[] {
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  return Array.from({ length: 42 }, (_, i) => new Date(y, m, 1 - offset + i));
}

/* ── Component ─────────────────────────────────────────────── */

export type DatePickerProps = {
  label?: string;
  ariaLabel?: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  min?: string | null;
  max?: string | null;
  placeholder?: string;
  hint?: string;
  helper?: string;
  error?: string;
  disabled?: boolean;
  clearable?: boolean;
  size?: FieldSize;
  className?: string;
};

type View = 'days' | 'months' | 'years';

export function DatePicker({
  label, ariaLabel, value, onChange, min, max, placeholder = 'Pick a date', hint, helper, error,
  disabled = false, clearable = true, size = 'md', className = '',
}: DatePickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(fmtDisplayDate(value));
  const editing = useRef(false);
  const [view, setView] = useState<View>('days');
  const initial = parseIso(value) ?? parseIso(todayIso())!;
  const [cursor, setCursor] = useState({ y: initial.y, m: initial.m });
  const [focusDay, setFocusDay] = useState<string>(value ?? todayIso());
  const [dir, setDir] = useState(0);
  const wantGridFocus = useRef(false);

  const anchorRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const inRange = useCallback((iso: string) => (!min || iso >= min) && (!max || iso <= max), [min, max]);

  useEffect(() => {
    if (!editing.current) setText(fmtDisplayDate(value));
  }, [value]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setView('days');
    wantGridFocus.current = false;
    if (refocus) inputRef.current?.focus({ preventScroll: true });
  }, []);
  const dismiss = useCallback(() => close(false), [close]);
  const dismissRefs = useMemo(() => [anchorRef, popRef], []);
  useDismiss(open, dismissRefs, dismiss);

  const openUp = () => {
    if (disabled || open) return;
    const base = parseIso(value) ?? parseIso(todayIso())!;
    setCursor({ y: base.y, m: base.m });
    setFocusDay(value ?? todayIso());
    setView('days');
    setDir(0);
    setOpen(true);
  };

  const select = (iso: string) => {
    if (!inRange(iso)) return;
    editing.current = false;
    onChange(iso);
    setText(fmtDisplayDate(iso));
    close();
  };

  const clear = () => {
    editing.current = false;
    onChange(null);
    setText('');
    close();
  };

  /** Commit typed text. Returns true when the field now holds a valid state. */
  const commit = (): boolean => {
    if (!editing.current) return true;
    editing.current = false;
    const t = text.trim();
    if (!t) {
      if (clearable) { onChange(null); setText(''); return true; }
      setText(fmtDisplayDate(value));
      return false;
    }
    const p = parseLooseDate(t, cursor);
    if (p && inRange(p)) { onChange(p); setText(fmtDisplayDate(p)); return true; }
    setText(fmtDisplayDate(value));
    return false;
  };

  /* Move the calendar to follow what is being typed. */
  const onType = (v: string) => {
    editing.current = true;
    setText(v);
    const p = parseLooseDate(v, cursor);
    if (p) {
      const q = parseIso(p)!;
      setDir(0);
      setCursor({ y: q.y, m: q.m });
      setFocusDay(p);
    }
  };

  const shiftMonth = (n: number) => {
    setDir(Math.sign(n));
    setCursor((c) => {
      const d = new Date(c.y, c.m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const shiftYear = (n: number) => { setDir(Math.sign(n)); setCursor((c) => ({ y: c.y + n, m: c.m })); };

  const moveFocus = (iso: string) => {
    const p = parseIso(iso);
    if (!p) return;
    wantGridFocus.current = true;
    if (p.y !== cursor.y || p.m !== cursor.m) setDir(iso > focusDay ? 1 : -1);
    setCursor({ y: p.y, m: p.m });
    setFocusDay(iso);
  };

  useEffect(() => {
    if (!open || !wantGridFocus.current || view !== 'days') return;
    const el = popRef.current?.querySelector<HTMLElement>(`[data-day="${focusDay}"]`);
    el?.focus({ preventScroll: true });
  }, [focusDay, open, view, cursor]);

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        const typed = editing.current;
        const ok = commit();
        if (typed) { if (ok && open) close(); return; } // commit what was typed; keep it open on a bad parse
        if (open) close(); else openUp();               // nothing typed: Enter toggles the calendar
        return;
      }
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        commit();
        if (!open) openUp();
        wantGridFocus.current = true;
        /* The roving tabindex marks the focus day once the grid has rendered. */
        requestAnimationFrame(() => {
          popRef.current?.querySelector<HTMLElement>('[data-day][tabindex="0"]')?.focus({ preventScroll: true });
        });
        return;
      }
      case 'Escape': {
        if (!open && !editing.current) return;
        e.preventDefault();
        e.stopPropagation();
        editing.current = false;
        setText(fmtDisplayDate(value));
        close();
        return;
      }
      case 'Tab': commit(); if (open) close(false); return;
      default: return;
    }
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    const p = parseIso(focusDay)!;
    const go = (iso: string) => { e.preventDefault(); moveFocus(iso); };
    switch (k) {
      case 'ArrowLeft': return go(shiftDays(focusDay, -1));
      case 'ArrowRight': return go(shiftDays(focusDay, 1));
      case 'ArrowUp': return go(shiftDays(focusDay, -7));
      case 'ArrowDown': return go(shiftDays(focusDay, 7));
      case 'Home': { const dow = (new Date(p.y, p.m, p.d).getDay() + 6) % 7; return go(shiftDays(focusDay, -dow)); }
      case 'End': { const dow = (new Date(p.y, p.m, p.d).getDay() + 6) % 7; return go(shiftDays(focusDay, 6 - dow)); }
      case 'PageUp': { const d = e.shiftKey ? new Date(p.y - 1, p.m, p.d) : new Date(p.y, p.m - 1, p.d); return go(isoFromDate(d)); }
      case 'PageDown': { const d = e.shiftKey ? new Date(p.y + 1, p.m, p.d) : new Date(p.y, p.m + 1, p.d); return go(isoFromDate(d)); }
      case 'Enter':
      case ' ': e.preventDefault(); select(focusDay); return;
      default: return;
    }
  };

  const onPopKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') { close(); }
  };

  const today = todayIso();
  const days = useMemo(() => gridDays(cursor.y, cursor.m), [cursor]);
  const yearPageStart = Math.floor(cursor.y / 12) * 12;
  const selected = parseIso(value);
  const todayOk = inRange(today);

  const headerBtn = 'px-1 py-0.5 transition-colors duration-200 hover:text-[color:var(--color-amber-deep)]';
  const navBtn = 'grid h-7 w-7 place-items-center text-graphite transition-colors duration-200 hover:text-ink disabled:opacity-30';

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
          onChange={(e) => onType(e.target.value)}
          onClick={() => openUp()}
          onKeyDown={onInputKey}
          onBlur={(e) => {
            const t = e.relatedTarget as Node | null;
            if (t && (popRef.current?.contains(t) || anchorRef.current?.contains(t))) return;
            commit();
            if (open && t) close(false);
          }}
          className="mono num min-w-0 flex-1 bg-transparent outline-none placeholder:font-sans placeholder:text-silver disabled:cursor-not-allowed"
        />
        {clearable && value && !disabled && (
          <button type="button" tabIndex={-1} aria-label="Clear date" onClick={clear} className={TRIGGER_ICON_BTN}>
            <IconX size={12} />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? 'Close calendar' : 'Open calendar'}
          disabled={disabled}
          onClick={() => (open ? close() : openUp())}
          className={`${TRIGGER_ICON_BTN} ${open ? 'text-[color:var(--color-amber-deep)]' : ''}`}
        >
          <IconCalendar size={14} />
        </button>
      </div>

      <AnchoredPopover
        open={open}
        anchorRef={anchorRef}
        popRef={popRef}
        matchWidth={false}
        minWidth={280}
        className="w-[280px]"
        role="dialog"
        ariaLabel="Choose a date"
        onKeyDown={onPopKey}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b rule px-2 py-1.5">
          <button
            type="button"
            aria-label={view === 'days' ? 'Previous month' : view === 'months' ? 'Previous year' : 'Previous years'}
            onClick={() => (view === 'days' ? shiftMonth(-1) : view === 'months' ? shiftYear(-1) : shiftYear(-12))}
            className={navBtn}
          >
            <IconChevronLeft size={14} />
          </button>
          <div className="flex items-baseline gap-1">
            {view === 'days' && (
              <>
                <button type="button" onClick={() => setView('months')} className={`${headerBtn} text-[13px] font-medium text-ink`}>
                  {MONTHS[cursor.m]}
                </button>
                <button type="button" onClick={() => setView('years')} className={`${headerBtn} mono num text-[12.5px] text-graphite`}>
                  {cursor.y}
                </button>
              </>
            )}
            {view === 'months' && (
              <button type="button" onClick={() => setView('years')} className={`${headerBtn} mono num text-[13px] font-medium text-ink`}>
                {cursor.y}
              </button>
            )}
            {view === 'years' && (
              <span className="mono num px-1 text-[12.5px] text-ink">{yearPageStart} – {yearPageStart + 11}</span>
            )}
          </div>
          <button
            type="button"
            aria-label={view === 'days' ? 'Next month' : view === 'months' ? 'Next year' : 'Next years'}
            onClick={() => (view === 'days' ? shiftMonth(1) : view === 'months' ? shiftYear(1) : shiftYear(12))}
            className={navBtn}
          >
            <IconChevronRight size={14} />
          </button>
        </div>

        {/* Body */}
        <motion.div
          key={`${view}-${cursor.y}-${view === 'days' ? cursor.m : ''}`}
          initial={{ opacity: 0, x: dir * 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="px-3.5 pb-2 pt-2.5"
        >
          {view === 'days' && (
            <>
              <div role="row" className="grid grid-cols-7">
                {DOW.map((d) => (
                  <div key={d} role="columnheader" className="mono grid h-6 place-items-center text-[9.5px] uppercase tracking-[0.14em] text-graphite">{d}</div>
                ))}
              </div>
              <div role="grid" aria-label={`${MONTHS[cursor.m]} ${cursor.y}`} onKeyDown={onGridKey} className="grid grid-cols-7">
                {days.map((dt) => {
                  const iso = isoFromDate(dt);
                  const inMonth = dt.getMonth() === cursor.m;
                  const ok = inRange(iso);
                  const sel = value === iso;
                  const isToday = iso === today;
                  const isFocus = iso === focusDay;
                  return (
                    <button
                      key={iso}
                      type="button"
                      role="gridcell"
                      data-day={iso}
                      tabIndex={isFocus ? 0 : -1}
                      aria-selected={sel}
                      aria-disabled={!ok || undefined}
                      aria-label={fmtLongDate(iso)}
                      onClick={() => select(iso)}
                      onFocus={() => { wantGridFocus.current = true; }}
                      className={`relative grid h-9 w-9 place-items-center outline-none transition-colors duration-150 mono num text-[12.5px] ${
                        sel
                          ? 'bg-navy text-paper'
                          : !ok
                            ? 'cursor-not-allowed text-silver/50'
                            : inMonth
                              ? 'text-ink hover:bg-bone'
                              : 'text-silver hover:bg-bone'
                      } ${isFocus && !sel ? 'ring-1 ring-inset ring-[color:var(--color-amber)]' : ''} focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[color:var(--color-amber)]`}
                    >
                      {dt.getDate()}
                      {isToday && (
                        <span
                          aria-hidden
                          className={`absolute bottom-[5px] h-[3px] w-[3px] rounded-full ${sel ? 'bg-paper' : 'bg-[color:var(--color-amber-deep)]'}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {view === 'months' && (
            <div className="grid grid-cols-3 gap-1">
              {MONTHS_SHORT.map((mName, i) => {
                const isSel = selected?.y === cursor.y && selected.m === i;
                const isCur = i === cursor.m;
                return (
                  <button
                    key={mName}
                    type="button"
                    onClick={() => { setDir(0); setCursor({ y: cursor.y, m: i }); setView('days'); }}
                    className={`h-9 text-[12.5px] transition-colors duration-150 ${
                      isSel ? 'bg-navy text-paper' : 'text-ink hover:bg-bone'
                    } ${isCur && !isSel ? 'ring-1 ring-inset ring-[color:var(--color-amber)]' : ''}`}
                  >
                    {mName}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'years' && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((y) => {
                const isSel = selected?.y === y;
                const isCur = y === cursor.y;
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => { setDir(0); setCursor({ y, m: cursor.m }); setView('months'); }}
                    className={`mono num h-9 text-[12.5px] transition-colors duration-150 ${
                      isSel ? 'bg-navy text-paper' : 'text-ink hover:bg-bone'
                    } ${isCur && !isSel ? 'ring-1 ring-inset ring-[color:var(--color-amber)]' : ''}`}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t rule px-2 py-1.5">
          {clearable ? (
            <button type="button" onClick={clear} disabled={!value} className={FOOT_BTN}>Clear</button>
          ) : <span />}
          <button type="button" onClick={() => select(today)} disabled={!todayOk} className={`${FOOT_BTN} text-[color:var(--color-amber-deep)] hover:text-ink`}>
            Today
          </button>
        </div>
      </AnchoredPopover>
    </FieldShell>
  );
}
