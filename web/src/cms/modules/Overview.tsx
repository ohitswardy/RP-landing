import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import type { Transition } from 'motion/react';
import { useAuth } from '../auth';
import { useCms } from '../store';
import { apiFetch } from '../../lib/api';
import { Chip, EASE } from '../ui';
import { IconArrowDown, IconArrowUp } from '../icons';
import RegisLogo3D from '../../components/RegisLogo3D';
import TextType from '../../components/TextType';
import { RingChart } from '../../components/charts/ring-chart';
import { Ring } from '../../components/charts/ring';
import { RingCenter } from '../../components/charts/ring-center';
import type { RingData } from '../../components/charts/ring-context';
import { fmtDate, timeAgo, type Account, type Article, type ReportCategory } from '../data';

/* ─────────────────────────────────────────────────────────────
   Overview. The command surface of the workspace: what needs a
   decision now, what the desk shipped recently, and where every
   collection stands. All figures derive from the bootstrap
   payload, plus two role-scoped fetches: the pending-approvals
   count for roles that manage access, and the 30-day client-
   ledger summary for roles that can open Client logs.
   ───────────────────────────────────────────────────────────── */

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const WEEKS_SHOWN = 12;

/* Chart geometry for the desk-output panel. One unit block = one
   published piece, so the chart never needs an axis scale. */
const UNIT_W = 14;
const COL_GAP = 8;
const COL_PITCH = UNIT_W + COL_GAP;
const CHART_W = WEEKS_SHOWN * COL_PITCH - COL_GAP;
/** Channel label gutter. The axis, readout, and hover strips all hang
    off it, so it stays the single source for the plot's left edge. */
const LABEL_W = 64;
const ROW_GAP = 20;
const AXIS_INSET = LABEL_W + ROW_GAP;

/* ── Date bucketing ────────────────────────────────────────── */

function mondayOf(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - ((d.getDay() + 6) % 7) * DAY;
}

/** Items per ISO week, oldest week first, current week last. */
function weeklyCounts(dates: string[], weeks: number, now: number): number[] {
  const start = mondayOf(now) - (weeks - 1) * WEEK;
  const counts = new Array<number>(weeks).fill(0);
  for (const iso of dates) {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) continue;
    const idx = Math.floor((t - start) / WEEK);
    if (idx >= 0 && idx < weeks) counts[idx] += 1;
  }
  return counts;
}

function countWithin(dates: string[], now: number, fromDaysAgo: number, toDaysAgo: number): number {
  const from = now - fromDaysAgo * DAY;
  const to = now - toDaysAgo * DAY;
  return dates.reduce((acc, iso) => {
    const t = new Date(iso).getTime();
    return acc + (t > from && t <= to ? 1 : 0);
  }, 0);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/* ── Greeting ──────────────────────────────────────────────── */

/** The shell header runs on PHT, so the greeting reads the same clock. */
function deskHour(now: number): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Manila' })
      .format(new Date(now)),
  );
}

/** Prefer the surname when the leading token is an initial ("K. Villaruel"). */
function firstName(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return 'there';
  return parts[0].endsWith('.') && parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

/* ── Count-up numeral ──────────────────────────────────────── */

function CountUp({ value, delay = 0, className }: { value: number; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString('en-PH'));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.9, delay, ease: EASE });
    return () => controls.stop();
  }, [value, delay, reduce, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}

/* ── Dot-matrix numeral (the one hero figure on the page) ──── */

const DOT_GLYPHS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

const DOT = 4;
const DOT_GAP = 3;

/** Deterministic scatter so the matrix lights the same way every mount. */
function dotDelay(digit: number, row: number, col: number): number {
  const seed = (digit * 97 + row * 31 + col * 17) % 23;
  return (seed / 23) * 0.55;
}

function DotMatrixNumber({ value, label }: { value: number; label: string }) {
  const reduce = useReducedMotion();
  const digits = String(Math.max(0, Math.min(999, value)));

  return (
    <div role="img" aria-label={label} className="flex items-end gap-[10px]">
      {digits.split('').map((ch, di) => (
        <div
          key={di}
          aria-hidden
          className="grid"
          style={{
            gridTemplateColumns: `repeat(5, ${DOT}px)`,
            gridTemplateRows: `repeat(7, ${DOT}px)`,
            gap: DOT_GAP,
          }}
        >
          {DOT_GLYPHS[ch].flatMap((rowBits, r) =>
            rowBits.split('').map((bit, c) => {
              const lit = bit === '1';
              return (
                <motion.span
                  key={`${r}-${c}`}
                  className="rounded-full"
                  style={{
                    width: DOT,
                    height: DOT,
                    background: lit
                      ? 'var(--color-paper)'
                      : 'color-mix(in oklab, var(--color-paper) 8%, transparent)',
                  }}
                  initial={reduce || !lit ? false : { opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.35 + dotDelay(di, r, c), ease: EASE }}
                />
              );
            }),
          )}
        </div>
      ))}
    </div>
  );
}

/* ── KPI cell with sparkbar trend ──────────────────────────── */

function SparkBars({ counts }: { counts: number[] }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...counts);
  const H = 26;

  return (
    <div aria-hidden className="flex items-end gap-[2px]" style={{ height: H }}>
      {counts.map((c, i) => {
        const last = i === counts.length - 1;
        const h = c === 0 ? 2 : 2 + Math.round((c / max) * (H - 2));
        return (
          <motion.span
            key={i}
            className="w-[5px] rounded-[1px]"
            style={{
              height: h,
              transformOrigin: 'bottom',
              background: last
                ? 'var(--color-amber-deep)'
                : c === 0
                  ? 'color-mix(in oklab, var(--color-ink) 8%, transparent)'
                  : 'color-mix(in oklab, var(--color-ink) 18%, transparent)',
            }}
            initial={reduce ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.045, ease: EASE }}
          />
        );
      })}
    </div>
  );
}

type KpiProps = {
  label: string;
  value: number;
  delta30: number;
  weekly: number[];
  to?: string;
  index: number;
};

function Kpi({ label, value, delta30, weekly, to, index }: KpiProps) {
  const body = (
    <div className="flex h-full items-end justify-between gap-4 px-2 py-6 transition-colors duration-300 group-hover:bg-white md:px-7">
      <div className="flex flex-col gap-2">
        <span className="mono text-[10.5px] uppercase tracking-[0.18em] text-graphite">{label}</span>
        <CountUp
          value={value}
          delay={0.1 + index * 0.08}
          className="mono num block text-[clamp(1.8rem,2.7vw,2.5rem)] leading-none tracking-[-0.02em] text-ink"
        />
        <span
          className="mono text-[10px] uppercase tracking-[0.14em]"
          style={{ color: delta30 > 0 ? 'var(--color-signal)' : 'var(--color-graphite)' }}
        >
          {delta30 > 0 ? `+${delta30}` : '0'} in 30 days
        </span>
      </div>
      <SparkBars counts={weekly} />
    </div>
  );

  if (!to) return <div className="h-full">{body}</div>;
  return (
    <Link to={to} className="group block h-full" title={`Open ${label.toLowerCase()}`}>
      {body}
    </Link>
  );
}

/* ── Desk-output panel (navy blueprint) ────────────────────── */

type Channel = {
  key: string;
  label: string;
  color: string;
  counts: number[];
};

function CornerTick({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const place: Record<string, string> = {
    tl: 'left-3 top-3',
    tr: 'right-3 top-3',
    bl: 'bottom-3 left-3',
    br: 'bottom-3 right-3',
  };
  return (
    <span aria-hidden className={`pointer-events-none absolute h-[9px] w-[9px] ${place[pos]}`}>
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2" style={{ background: 'color-mix(in oklab, var(--color-paper) 22%, transparent)' }} />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2" style={{ background: 'color-mix(in oklab, var(--color-paper) 22%, transparent)' }} />
    </span>
  );
}

function ChannelRow({
  channel, unitH, gapH, stackH, hoverWeek, baseDelay,
}: {
  channel: Channel; unitH: number; gapH: number; stackH: number; hoverWeek: number | null; baseDelay: number;
}) {
  const reduce = useReducedMotion();
  const total = channel.counts.reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-end" style={{ gap: ROW_GAP }}>
      <span
        className="mono shrink-0 pb-px text-right text-[9.5px] uppercase tracking-[0.16em]"
        style={{ width: LABEL_W, color: 'color-mix(in oklab, var(--color-paper) 62%, transparent)' }}
      >
        {channel.label}
      </span>

      <div className="flex items-end" style={{ width: CHART_W, height: stackH, gap: COL_GAP }}>
        {channel.counts.map((count, w) => {
          const dimmed = hoverWeek !== null && hoverWeek !== w;
          return (
            <div
              key={w}
              className="flex flex-col-reverse items-stretch transition-opacity duration-200"
              style={{ width: UNIT_W, height: stackH, gap: gapH, opacity: dimmed ? 0.35 : 1 }}
            >
              {count === 0 ? (
                <span className="h-[2px] rounded-[1px]" style={{ background: 'color-mix(in oklab, var(--color-paper) 13%, transparent)' }} />
              ) : (
                Array.from({ length: count }).map((_, u) => (
                  <motion.span
                    key={u}
                    className="rounded-[1px]"
                    style={{ height: unitH, background: channel.color, transformOrigin: 'bottom' }}
                    initial={reduce ? false : { opacity: 0, scaleY: 0.3 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.45, delay: baseDelay + w * 0.03 + u * 0.06, ease: EASE }}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>

      <span className="mono num w-[34px] shrink-0 pb-px text-right text-[12px] text-paper">{total}</span>
    </div>
  );
}

function OutputPanel({
  channels, weekStarts, shipped30, shippedPrev30,
}: {
  channels: Channel[]; weekStarts: number[]; shipped30: number; shippedPrev30: number;
}) {
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);

  const weekMax = Math.max(1, ...channels.flatMap((c) => c.counts));
  /* Blocks shrink as volume grows so the stack never exceeds ~56px. */
  const unitH = Math.max(2, Math.min(5, Math.floor(56 / weekMax) - 1));
  const gapH = weekMax > 9 ? 1 : 2;
  const stackH = Math.max(4 * (unitH + gapH), weekMax * unitH + (weekMax - 1) * gapH);

  const diff = shipped30 - shippedPrev30;
  const totals12w = channels.map((c) => c.counts.reduce((a, b) => a + b, 0));
  const summary = `Publishing activity over the last 12 weeks: ${channels
    .map((c, i) => `${totals12w[i]} ${c.label.toLowerCase()}`)
    .join(', ')}.`;

  const weekLabel = (t: number) =>
    new Date(t).toLocaleDateString('en-PH', { day: '2-digit', month: 'short' }).toUpperCase();

  return (
    <section className="bg-blueprint relative overflow-hidden p-7 md:p-9" aria-label={summary}>
      <CornerTick pos="tl" /><CornerTick pos="tr" /><CornerTick pos="bl" /><CornerTick pos="br" />

      <div className="grid gap-10 lg:grid-cols-[240px_1fr] lg:gap-14">
        {/* Hero figure */}
        <div className="flex flex-col justify-between gap-8">
          <div>
            <div className="eyebrow eyebrow-paper">Desk output</div>
            <p className="mt-3 max-w-[34ch] text-[13px] leading-relaxed" style={{ color: 'color-mix(in oklab, var(--color-paper) 55%, transparent)' }}>
              Notes, reports, and newsletter issues published by the desk.
            </p>
          </div>

          <div>
            <DotMatrixNumber value={shipped30} label={`${plural(shipped30, 'piece')} published in the last 30 days`} />
            <div className="mono mt-4 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'color-mix(in oklab, var(--color-paper) 62%, transparent)' }}>
              Published · last 30 days
            </div>
            <div
              className="mono mt-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]"
              style={{ color: diff > 0 ? 'oklch(0.76 0.11 145)' : 'color-mix(in oklab, var(--color-paper) 55%, transparent)' }}
            >
              {diff !== 0 && (diff > 0 ? <IconArrowUp size={11} /> : <IconArrowDown size={11} />)}
              {diff === 0 ? 'Level with the prior 30 days' : `${diff > 0 ? '+' : ''}${diff} vs prior 30 days`}
            </div>
          </div>
        </div>

        {/* Channel rows: one unit block per published piece. Past xl the rows
            size to content and the brand mark takes the leftover field. */}
        <div className="flex items-stretch gap-10 xl:gap-14">
          <div className="min-w-0 flex-1 overflow-x-auto pb-1 xl:flex-initial" onMouseLeave={() => setHoverWeek(null)}>
            <div className="relative inline-block min-w-full pt-2">
              <div className="flex flex-col gap-5">
                {channels.map((ch, i) => (
                  <ChannelRow
                    key={ch.key}
                    channel={ch}
                    unitH={unitH}
                    gapH={gapH}
                    stackH={stackH}
                    hoverWeek={hoverWeek}
                    baseDelay={0.35 + i * 0.12}
                  />
                ))}
              </div>

              {/* Week axis */}
              <div className="mt-3 flex" style={{ marginLeft: AXIS_INSET, width: CHART_W, gap: COL_GAP }}>
                {weekStarts.map((t, i) => (
                  <span
                    key={i}
                    className="mono shrink-0 whitespace-nowrap text-[8.5px] uppercase tracking-[0.08em]"
                    style={{ width: UNIT_W, color: 'color-mix(in oklab, var(--color-paper) 40%, transparent)' }}
                  >
                    {i === WEEKS_SHOWN - 1 ? 'NOW' : i % 4 === 0 ? weekLabel(t) : ''}
                  </span>
                ))}
              </div>

              {/* Readout strip: 12-week totals at rest, the hovered week on hover */}
              <div
                className="mt-4 flex min-h-[26px] flex-wrap items-center gap-x-6 gap-y-1.5 border-t pt-3"
                style={{ marginLeft: AXIS_INSET, width: CHART_W, borderColor: 'color-mix(in oklab, var(--color-paper) 14%, transparent)' }}
              >
                <span className="mono text-[9px] uppercase tracking-[0.16em]" style={{ color: 'color-mix(in oklab, var(--color-paper) 45%, transparent)' }}>
                  {hoverWeek === null ? '12-week totals' : `Week of ${weekLabel(weekStarts[hoverWeek])}`}
                </span>
                {channels.map((ch, i) => (
                  <span key={ch.key} className="flex items-center gap-2">
                    <span aria-hidden className="h-[5px] w-[5px] rounded-[1px]" style={{ background: ch.color }} />
                    <span className="mono text-[9.5px] uppercase tracking-[0.12em]" style={{ color: 'color-mix(in oklab, var(--color-paper) 68%, transparent)' }}>
                      {ch.label}
                    </span>
                    <span className="mono num text-[10.5px] text-paper">
                      {hoverWeek === null ? totals12w[i] : ch.counts[hoverWeek]}
                    </span>
                  </span>
                ))}
              </div>

              {/* Hover hit strips over the unit columns */}
              <div className="absolute hidden lg:block" style={{ left: AXIS_INSET, width: CHART_W, top: 0, height: '100%' }}>
                {weekStarts.map((_, i) => (
                  <span
                    key={i}
                    className="absolute inset-y-0"
                    style={{ left: i * COL_PITCH - COL_GAP / 2, width: COL_PITCH }}
                    onMouseEnter={() => setHoverWeek(i)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Brand mark. Decorative only, so it stays out of the a11y tree
              and never intercepts the chart's hover strips. */}
          <div aria-hidden className="pointer-events-none relative hidden min-h-[220px] xl:block xl:flex-1">
            <RegisLogo3D
              className="absolute inset-0"
              color="#3f7fd4"
              sideColor="#17427f"
              trackIntensity={0.7}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Pipeline status glyph bar ─────────────────────────────── */

const GLYPH_SLOTS = 26;

/** Midpoint-sample slots across the shares; any nonzero status keeps
    at least one slot so the bar never contradicts its labels. */
function allocateSlots(counts: number[], total: number): number[] {
  if (total === 0) return counts.map(() => 0);
  const bounds: number[] = [];
  let acc = 0;
  for (const c of counts) { acc += c / total; bounds.push(acc); }
  const slots = counts.map(() => 0);
  for (let s = 0; s < GLYPH_SLOTS; s += 1) {
    const frac = (s + 0.5) / GLYPH_SLOTS;
    const idx = bounds.findIndex((b) => frac <= b);
    slots[idx === -1 ? counts.length - 1 : idx] += 1;
  }
  counts.forEach((c, i) => {
    if (c > 0 && slots[i] === 0) {
      const donor = slots.indexOf(Math.max(...slots));
      slots[donor] -= 1;
      slots[i] += 1;
    }
  });
  return slots;
}

const STATUS_META = [
  { key: 'published', label: 'Published', color: 'var(--color-signal)' },
  { key: 'review', label: 'In review', color: 'var(--color-amber-deep)' },
] as const;

function StatusGlyphBar({ counts }: { counts: [number, number] }) {
  const reduce = useReducedMotion();
  const total = counts[0] + counts[1];
  const slots = allocateSlots([...counts], total);
  const cells = slots.flatMap((n, si) => Array.from({ length: n }, () => STATUS_META[si].color));

  return (
    <div>
      <div aria-hidden className="flex gap-[2.5px]">
        {cells.map((color, i) => (
          <motion.span
            key={i}
            className="h-[7px] flex-1 rounded-[1px]"
            style={{ background: color }}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.15 + i * 0.018 }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {STATUS_META.map((s, i) => (
          <span key={s.key} className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-graphite">
            <span aria-hidden className="h-[6px] w-[6px] rounded-[1px]" style={{ background: s.color }} />
            {counts[i]} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Right-rail primitives ─────────────────────────────────── */

function RailHeading({ children, link }: { children: ReactNode; link?: { to: string; label: string } | null }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-[15.5px] font-medium tracking-[-0.01em]">{children}</h2>
      {link && (
        <Link to={link.to} className="mono shrink-0 text-[10px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink">
          {link.label} →
        </Link>
      )}
    </div>
  );
}

function InventoryRow({ label, value, to }: { label: string; value: string; to?: string }) {
  const inner = (
    <span className="flex items-baseline justify-between gap-4 py-3 transition-colors duration-300 group-hover:bg-white">
      <span className="pl-0.5 text-[13px] text-slate">{label}</span>
      <span className="mono num pr-0.5 text-[12.5px] text-ink">{value}</span>
    </span>
  );
  return (
    <li className="group border-b rule last:border-b-0">
      {to ? <Link to={to} className="block">{inner}</Link> : inner}
    </li>
  );
}

/* ── Attention block ───────────────────────────────────────── */

type AttentionItem = { key: string; text: string; to: string | null };

function AttentionBlock({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <section>
        <RailHeading>Needs attention</RailHeading>
        <div className="flex flex-col gap-2 border-y rule py-5">
          <Chip tone="live">All clear</Chip>
          <p className="text-[13px] leading-relaxed text-graphite">Nothing requires a decision right now.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <RailHeading>Needs attention</RailHeading>
      <ul className="border-y rule">
        {items.map((item) => {
          const row = (
            <span className="flex items-center gap-3 py-3.5 transition-colors duration-300 group-hover:bg-white">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: 'var(--color-amber)' }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-amber-deep)' }} />
              </span>
              <span className="flex-1 text-[13px] leading-snug text-ink">{item.text}</span>
              {item.to && <span className="mono text-[11px] text-graphite transition-colors group-hover:text-[color:var(--color-amber-deep)]">→</span>}
            </span>
          );
          return (
            <li key={item.key} className="group border-b rule last:border-b-0">
              {item.to ? <Link to={item.to} className="block">{row}</Link> : row}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── Portal engagement (client-ledger ring) ────────────────── */

type LedgerSummary = { total: number; views: number; downloads: number; clicks: number; actors: number };

/* Ring stack, innermost track first. Colors reuse the event identity the
   Client logs chips already established (view = signal, download = amber,
   click = muted), so the ring reads the same as the ledger. The click ring
   is deliberately gray — muted IS its identity — and sits innermost with
   the least visual weight; each series owns its own track and a labeled
   readout row, so identity never rides on hue alone. */
const ENGAGEMENT_RINGS = [
  { key: 'clicks', label: 'Clicks', color: 'var(--color-graphite)' },
  { key: 'downloads', label: 'Downloads', color: 'var(--color-amber-deep)' },
  { key: 'views', label: 'Views', color: 'var(--color-signal)' },
] as const;

/** Readout order: dominant series first, matching the ledger's tabs. */
const ENGAGEMENT_ROWS = [
  { ringIndex: 2, label: 'Report views' },
  { ringIndex: 1, label: 'Downloads' },
  { ringIndex: 0, label: 'Clicks' },
] as const;

export function PortalEngagement({ now }: { now: number }) {
  const reduce = useReducedMotion();
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryTick, setRetryTick] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    const from = new Date(now - 30 * DAY).toISOString().slice(0, 10);
    apiFetch<{ summary: LedgerSummary }>(`/cms/client-logs?from=${from}`, { audience: 'cms' })
      .then((res) => {
        if (cancelled) return;
        setSummary(res.summary);
        setState('ready');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [now, retryTick]);

  const total = summary?.total ?? 0;

  /* Each ring's sweep is its share of all 30-day events, so the three
     tracks together read as the split of what clients actually did. */
  const rings: RingData[] = useMemo(() => {
    const counts = {
      views: summary?.views ?? 0,
      downloads: summary?.downloads ?? 0,
      clicks: summary?.clicks ?? 0,
    };
    return ENGAGEMENT_RINGS.map((r) => ({
      label: r.label,
      value: counts[r.key],
      maxValue: Math.max(1, summary?.total ?? 0),
      color: r.color,
    }));
  }, [summary]);

  const enterTransition = useMemo<Transition>(
    () => (reduce
      ? { type: 'tween', duration: 0 }
      : { type: 'tween', duration: 0.9, ease: [0.25, 1, 0.5, 1] }),
    [reduce],
  );

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-medium tracking-[-0.01em]">Portal engagement</h2>
          <p className="mono mt-2 text-[10px] uppercase tracking-[0.16em] text-graphite">
            Report views, downloads, and clicks · last 30 days
          </p>
        </div>
        <Link to="/cms/logs" className="mono shrink-0 text-[10.5px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink">
          Open Client logs →
        </Link>
      </div>

      {state === 'loading' && (
        <div aria-hidden className="grid grid-cols-1 items-center gap-x-12 gap-y-8 sm:grid-cols-[auto_1fr]">
          <div className="h-[240px] w-[240px] justify-self-center rounded-full skeleton-bar" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 skeleton-bar" style={{ animationDelay: `${i * 110}ms` }} />
            ))}
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col gap-4 border-y rule py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13.5px] text-graphite">The client ledger did not answer.</p>
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="mono self-start border rule px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate transition-colors hover:border-[color:var(--color-amber-deep)] hover:text-ink"
          >
            Retry
          </button>
        </div>
      )}

      {state === 'ready' && total === 0 && (
        <p className="border-y rule py-8 text-[13.5px] text-graphite">
          No portal activity in the last 30 days. Activity appears the moment a client views, downloads, or clicks a report.
        </p>
      )}

      {state === 'ready' && total > 0 && summary && (
        <div className="grid grid-cols-1 items-center gap-x-12 gap-y-8 sm:grid-cols-[auto_1fr]">
          {/* The readout rows carry the accessible figures; the ring is a
              visual double of them, so its SVG stays out of the a11y tree.
              --border feeds the chart's track color: same mix as `rule`. */}
          <div
            className="justify-self-center"
            style={{ '--border': 'color-mix(in oklab, var(--color-ink) 10%, transparent)' } as CSSProperties}
          >
            <RingChart
              data={rings}
              size={240}
              strokeWidth={13}
              ringGap={5}
              hoveredIndex={hovered}
              onHoverChange={setHovered}
              enterTransition={enterTransition}
              enterStaggerScale={reduce ? 0 : 1}
            >
              {rings.map((r, i) => (
                <Ring key={r.label} index={i} lineCap="butt" showGlow={false} animate={!reduce} />
              ))}
              <RingCenter
                defaultLabel="30-day total"
                valueClassName="mono num font-medium leading-none tracking-[-0.02em] text-ink text-[clamp(0.85rem,20cqw,1.6rem)]"
                labelClassName="mono mt-1.5 uppercase tracking-[0.16em] text-graphite text-[clamp(0.55rem,7cqw,0.625rem)]"
              />
            </RingChart>
          </div>

          <div className="min-w-0">
            <ul className="border-y rule" onMouseLeave={() => setHovered(null)}>
              {ENGAGEMENT_ROWS.map((row) => {
                const ring = rings[row.ringIndex];
                const dimmed = hovered !== null && hovered !== row.ringIndex;
                const share = Math.round((ring.value / total) * 100);
                return (
                  <li
                    key={row.label}
                    onMouseEnter={() => setHovered(row.ringIndex)}
                    className="flex items-center justify-between gap-4 border-b rule py-3.5 transition-opacity duration-200 last:border-b-0"
                    style={{ opacity: dimmed ? 0.4 : 1 }}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden className="h-[5px] w-[5px] shrink-0 rounded-[1px]" style={{ background: ring.color }} />
                      <span className="truncate text-[13.5px] text-ink">{row.label}</span>
                    </span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      <span className="mono num text-[12.5px] text-ink">{ring.value.toLocaleString('en-PH')}</span>
                      <span className="mono num w-[40px] text-right text-[10.5px] text-graphite">{share}%</span>
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex items-baseline justify-between gap-4">
              <span className="text-[13px] text-slate">Active clients</span>
              <span className="mono num text-[12.5px] text-ink">{summary.actors.toLocaleString('en-PH')}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Loading skeleton (layout-matched) ─────────────────────── */

function OverviewSkeleton() {
  return (
    <div aria-hidden className="space-y-14">
      <div>
        <div className="h-3 w-28 skeleton-bar" />
        <div className="mt-5 h-8 w-72 skeleton-bar" />
        <div className="mt-4 h-3.5 w-96 max-w-full skeleton-bar" />
      </div>
      <div className="grid grid-cols-2 gap-px border-y rule py-8 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-2 md:px-7">
            <div className="h-3 w-24 skeleton-bar" style={{ animationDelay: `${i * 90}ms` }} />
            <div className="mt-4 h-9 w-16 skeleton-bar" style={{ animationDelay: `${i * 90 + 40}ms` }} />
            <div className="mt-3 h-2.5 w-20 skeleton-bar" style={{ animationDelay: `${i * 90 + 80}ms` }} />
          </div>
        ))}
      </div>
      <div className="h-[260px] skeleton-bar" />
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 skeleton-bar" style={{ animationDelay: `${i * 110}ms` }} />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 skeleton-bar" style={{ animationDelay: `${i * 130}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Module ────────────────────────────────────────────────── */

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay: i * 0.08 } }),
};

/* Hairline dividers for the 1 / 2 / 4-column instrument grid. The `rule`
   border color has no responsive variants, so only the widths shift. */
const KPI_CELL_BORDERS = [
  '',
  'rule border-t sm:border-t-0 sm:border-l',
  'rule border-t sm:border-t-0 sm:border-l',
];

type AccessSnapshot = { users: Account[] };

export default function Overview() {
  const { session, can } = useAuth();
  const {
    status, articles, reports, people, services, newsletters, subscribers, pages, media, audit,
  } = useCms();
  const reduce = useReducedMotion();

  /* One clock reading per mount keeps every derived bucket stable. */
  const now = useMemo(() => Date.now(), []);

  /* Pending portal approvals, fetched only for roles that manage access. */
  const [pendingClients, setPendingClients] = useState<number | null>(null);
  const canAccess = can('access.manage');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (!canAccess) return undefined;
    apiFetch<AccessSnapshot>('/cms/access', { audience: 'cms' })
      .then((res) => {
        if (!alive.current) return;
        setPendingClients(res.users.filter((u) => u.kind === 'client' && u.status === 'pending').length);
      })
      .catch(() => { /* the tile simply stays hidden */ });
    return () => { alive.current = false; };
  }, [canAccess]);

  /* ── Derived figures ─────────────────────────────────────── */

  const derived = useMemo(() => {
    const published = articles.filter((a) => a.status === 'published');
    const inReview = articles.filter((a) => a.status === 'review');

    const noteDates = published.map((a) => a.date);
    const reportDates = reports.map((r) => r.date);
    const issueDates = newsletters.map((n) => n.date);

    const weekStarts = Array.from(
      { length: WEEKS_SHOWN },
      (_, i) => mondayOf(now) - (WEEKS_SHOWN - 1 - i) * WEEK,
    );

    const notesWeekly = weeklyCounts(noteDates, WEEKS_SHOWN, now);
    const reportsWeekly = weeklyCounts(reportDates, WEEKS_SHOWN, now);
    const issuesWeekly = weeklyCounts(issueDates, WEEKS_SHOWN, now);

    const shippedDates = [...noteDates, ...reportDates, ...issueDates];
    const shipped30 = countWithin(shippedDates, now, 30, 0);
    const shippedPrev30 = countWithin(shippedDates, now, 60, 30);

    const queue = [...inReview];
    const mostRead = published.reduce<Article | null>(
      (top, a) => (a.reads > (top?.reads ?? 0) ? a : top),
      null,
    );

    const categoryCounts = new Map<ReportCategory, number>();
    for (const r of reports) {
      if (r.category) categoryCounts.set(r.category, (categoryCounts.get(r.category) ?? 0) + 1);
    }
    const categories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);

    const latestIssue = newsletters.reduce<typeof newsletters[number] | null>(
      (top, n) => (top === null || n.date > top.date ? n : top),
      null,
    );

    return {
      published, inReview, queue, mostRead,
      weekStarts, notesWeekly, reportsWeekly, issuesWeekly,
      shipped30, shippedPrev30,
      notes30: countWithin(noteDates, now, 30, 0),
      reports30: countWithin(reportDates, now, 30, 0),
      issues30: countWithin(issueDates, now, 30, 0),
      notesWeekly8: weeklyCounts(noteDates, 8, now),
      reportsWeekly8: weeklyCounts(reportDates, 8, now),
      issuesWeekly8: weeklyCounts(issueDates, 8, now),
      categories,
      latestIssue,
      liveServices: services.filter((s) => s.live).length,
      visiblePeople: people.filter((p) => p.visible).length,
    };
  }, [articles, reports, newsletters, subscribers, services, people, now]);

  const firstLoad =
    status === 'loading' &&
    articles.length + reports.length + subscribers.length + audit.length === 0;
  if (firstLoad) return <OverviewSkeleton />;

  const {
    inReview, queue, mostRead, weekStarts,
    notesWeekly, reportsWeekly, issuesWeekly, shipped30, shippedPrev30,
    categories, latestIssue, liveServices, visiblePeople,
  } = derived;

  /* ── Copy ────────────────────────────────────────────────── */

  const hour = deskHour(now);
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const greetingLine = `${greeting}, ${session ? firstName(session.name) : 'there'}.`;

  const attentionParts: string[] = [];
  if (inReview.length > 0) {
    attentionParts.push(`${inReview.length} ${inReview.length === 1 ? 'note is' : 'notes are'} waiting for editorial review`);
  }
  if ((pendingClients ?? 0) > 0) {
    attentionParts.push(`${pendingClients} client ${pendingClients === 1 ? 'registration is' : 'registrations are'} awaiting approval`);
  }
  const attentionLine =
    attentionParts.length === 0
      ? 'Nothing is waiting on you. The site content is current.'
      : `${attentionParts.join(' and ')}.`;

  const attentionItems: AttentionItem[] = [];
  if (inReview.length > 0) {
    attentionItems.push({
      key: 'review',
      text: `${plural(inReview.length, 'note')} in the editorial review queue`,
      to: can('insights.manage') ? '/cms/insights' : null,
    });
  }
  if ((pendingClients ?? 0) > 0) {
    attentionItems.push({
      key: 'approvals',
      text: `${plural(pendingClients as number, 'client registration')} awaiting portal approval`,
      to: '/cms/access',
    });
  }

  const channels: Channel[] = [
    { key: 'notes', label: 'Notes', color: 'var(--color-paper)', counts: notesWeekly },
    { key: 'reports', label: 'Reports', color: 'var(--color-amber)', counts: reportsWeekly },
    { key: 'issues', label: 'Issues', color: 'oklch(0.72 0.055 250)', counts: issuesWeekly },
  ];

  const kpis: KpiProps[] = [
    { label: 'Published notes', value: derived.published.length, delta30: derived.notes30, weekly: derived.notesWeekly8, to: can('insights.manage') ? '/cms/insights' : undefined, index: 0 },
    { label: 'Research reports', value: reports.length, delta30: derived.reports30, weekly: derived.reportsWeekly8, to: can('reports.manage') ? '/cms/reports' : undefined, index: 1 },
    { label: 'Newsletter issues', value: newsletters.length, delta30: derived.issues30, weekly: derived.issuesWeekly8, to: can('newsletter.manage') ? '/cms/newsletter' : undefined, index: 2 },
  ];

  const topCategories = categories.slice(0, 4);
  const maxCategory = Math.max(1, ...topCategories.map(([, n]) => n));

  return (
    <div className="space-y-14">
      {/* Greeting */}
      <motion.section variants={rise} initial={reduce ? false : 'hidden'} animate="show" custom={0}>
        <div className="eyebrow mb-4">00 / Overview</div>
        {/* aria-label carries the whole line so assistive tech never reads a
            half-typed heading. */}
        <h1 className="text-[clamp(1.7rem,2.8vw,2.5rem)]" aria-label={greetingLine}>
          {reduce ? (
            greetingLine
          ) : (
            /* Keyed on the line so it retypes when the session resolves, not on
               every store update. */
            <TextType
              key={greetingLine}
              as="span"
              text={greetingLine}
              typingSpeed={55}
              initialDelay={220}
              pauseDuration={1500}
              deletingSpeed={30}
              loop={false}
              showCursor
              cursorCharacter="_"
              cursorBlinkDuration={0.5}
              cursorClassName="text-[color:var(--color-amber-deep)]"
              style={{ letterSpacing: 'inherit' }}
            />
          )}
        </h1>
        <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-slate">{attentionLine}</p>
      </motion.section>

      {/* Instrument row */}
      <motion.section
        variants={rise} initial={reduce ? false : 'hidden'} animate="show" custom={1}
        className="grid grid-cols-1 border-y rule sm:grid-cols-3"
      >
        {kpis.map((k, i) => (
          <div key={k.label} className={KPI_CELL_BORDERS[i]}>
            <Kpi {...k} />
          </div>
        ))}
      </motion.section>

      {/* Desk output */}
      <motion.div variants={rise} initial={reduce ? false : 'hidden'} animate="show" custom={2}>
        <OutputPanel
          channels={channels}
          weekStarts={weekStarts}
          shipped30={shipped30}
          shippedPrev30={shippedPrev30}
        />
      </motion.div>

      <div className="grid grid-cols-1 gap-x-14 gap-y-14 lg:grid-cols-[1.65fr_1fr]">
        {/* Left column */}
        <div className="min-w-0 space-y-14">
          {/* Production pipeline */}
          <motion.section variants={rise} initial={reduce ? false : 'hidden'} animate="show" custom={3}>
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="text-[17px] font-medium tracking-[-0.01em]">Production pipeline</h2>
              {can('insights.manage') && (
                <Link to="/cms/insights" className="mono shrink-0 text-[10.5px] uppercase tracking-[0.16em] text-graphite transition-colors hover:text-ink">
                  Open Insights →
                </Link>
              )}
            </div>

            {articles.length === 0 ? (
              <p className="border-y rule py-10 text-[13.5px] text-graphite">No notes exist yet. New research lands here first.</p>
            ) : (
              <>
                <StatusGlyphBar counts={[derived.published.length, inReview.length]} />

                {queue.length === 0 ? (
                  <p className="mt-8 border-y rule py-8 text-[13.5px] text-graphite">
                    The production queue is empty. Every note is published.
                  </p>
                ) : (
                  <ul className="mt-8 divide-y rule border-y rule">
                    {queue.slice(0, 6).map((a, i) => {
                      const row = (
                        <span className="grid grid-cols-12 items-baseline gap-3 py-4 transition-colors duration-300 group-hover:bg-white">
                          <span className="mono col-span-3 text-[10.5px] uppercase tracking-[0.16em] text-graphite md:col-span-2">{a.tag}</span>
                          <span className="col-span-9 text-[14px] leading-snug text-ink transition-colors group-hover:text-[color:var(--color-amber-deep)] md:col-span-6">
                            {a.title}
                          </span>
                          <span className="col-span-6 mt-1 text-[12.5px] text-slate md:col-span-2 md:mt-0">{a.author}</span>
                          <span className="col-span-6 mt-1 md:col-span-2 md:mt-0 md:justify-self-end">
                            <Chip tone={a.status === 'review' ? 'amber' : 'muted'}>{a.status}</Chip>
                          </span>
                        </span>
                      );
                      return (
                        <motion.li
                          key={a.id} className="group"
                          variants={rise} initial={reduce ? false : 'hidden'} animate="show" custom={i + 4}
                        >
                          {can('insights.manage') ? <Link to="/cms/insights" className="block">{row}</Link> : row}
                        </motion.li>
                      );
                    })}
                    {queue.length > 6 && (
                      <li className="py-3.5">
                        <span className="mono text-[10.5px] uppercase tracking-[0.16em] text-graphite">
                          +{queue.length - 6} more in the queue
                        </span>
                      </li>
                    )}
                  </ul>
                )}

                {mostRead && mostRead.reads > 0 && (
                  <p className="mt-5 text-[12.5px] leading-relaxed text-graphite">
                    Most read note: <span className="text-slate">“{mostRead.title}”</span> with{' '}
                    <span className="mono num text-ink">{mostRead.reads.toLocaleString('en-PH')}</span> reads.
                  </p>
                )}
              </>
            )}
          </motion.section>

          

          {/* Portal engagement */}
          {can('logs.view') && (
            <motion.section variants={rise} initial={reduce ? false : 'hidden'} animate="show" custom={5}>
              <PortalEngagement now={now} />
            </motion.section>
          )}
        </div>

        {/* Right rail */}
        <motion.aside
          variants={rise} initial={reduce ? false : 'hidden'} animate="show" custom={4}
          className="min-w-0 space-y-12"
        >
          <AttentionBlock items={attentionItems} />

          <section>
            <RailHeading>Site inventory</RailHeading>
            <ul className="border-y rule">
              <InventoryRow
                label="Service lines"
                value={`${liveServices}/${services.length} live`}
                to={can('services.manage') ? '/cms/services' : undefined}
              />
              <InventoryRow
                label="People profiles"
                value={`${visiblePeople}/${people.length} visible`}
                to={can('people.manage') ? '/cms/people' : undefined}
              />
              <InventoryRow
                label="Legal documents"
                value={String(new Set(pages.map((b) => b.page)).size)}
                to={can('pages.manage') ? '/cms/pages' : undefined}
              />
              <InventoryRow label="Media assets" value={String(media.length)} />
            </ul>
          </section>

          <section>
            <RailHeading link={can('newsletter.manage') ? { to: '/cms/newsletter', label: 'Open list' } : null}>
              Newsletter desk
            </RailHeading>
            {latestIssue ? (
              <div className="border-y rule py-5">
                <p className="text-[13.5px] leading-snug text-ink">{latestIssue.subject}</p>
                <div className="mt-2 flex items-center gap-3">
                  <Chip tone="muted">{latestIssue.cadence}</Chip>
                  <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-graphite">{fmtDate(latestIssue.date)}</span>
                </div>
              </div>
            ) : (
              <p className="border-y rule py-5 text-[13px] text-graphite">No issues drafted yet.</p>
            )}
          </section>
        </motion.aside>
      </div>

      {/* Activity ledger */}
      <motion.section variants={rise} initial={reduce ? false : 'hidden'} animate="show" custom={6}>
        <h2 className="mb-6 text-[17px] font-medium tracking-[-0.01em]">Recent activity</h2>
        {audit.length === 0 ? (
          <p className="border-y rule py-8 text-[13.5px] text-graphite">No changes logged yet. Every edit made in the workspace lands here.</p>
        ) : (
          <div className="grid grid-cols-1 border-t rule md:grid-cols-2 md:gap-x-14">
            {audit.slice(0, 8).map((e, i) => (
              <div key={e.id} className="flex items-baseline gap-4 border-b rule py-3.5">
                <span className="mono w-[64px] shrink-0 text-[10px] uppercase tracking-[0.1em] text-graphite">{timeAgo(e.at)}</span>
                <span className="min-w-0 flex-1 text-[13px] leading-relaxed">
                  {i === 0 && (
                    <span aria-hidden className="relative mr-2.5 inline-flex h-1.5 w-1.5 -translate-y-px">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: 'var(--color-amber)' }} />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-amber-deep)' }} />
                    </span>
                  )}
                  <span className="font-medium text-ink">{e.actor}</span>{' '}
                  <span className="text-slate">{e.action.toLowerCase()}</span>{' '}
                  <span className="text-graphite">{e.target}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
